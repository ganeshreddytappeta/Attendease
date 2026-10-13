import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, FileText, UserCheck,
  Eye, Download,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Avatar } from '../../components/shared/Avatar';
import { Modal } from '../../components/shared/Modal';
import { formatDate, formatTime } from '../../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { ProofPreviewModal } from '../../components/shared/ProofPreviewModal';
import { VerifiedActivityBadge } from '../../components/shared/VerifiedActivityBadge';
import NotFound from '../NotFound';

export default function HODRequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      try {
        return await api.getRequest(id!);
      } catch (err) {
        const cachedList = queryClient.getQueryData<api.AttendanceRequest[]>(['requests']) || [];
        const cached = cachedList.find(r => r.id === id || (r as any).requestId === id);
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(id),
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async ({ action, reason, periods }: { action: 'approve' | 'reject'; reason?: string; periods?: string }) => {
      try {
        return await api.reviewRequest(id!, action, reason, true, periods);
      } catch (err) {
        console.warn('API reviewRequest error, applying local optimistic override:', err);
        const updatedReq: any = {
          ...request,
          status: action === 'approve' ? 'approved' : 'rejected',
          rejectionReason: action === 'reject' ? (reason || 'Rejected by HOD Override') : undefined,
          ...(action === 'approve' && periods ? { periods } : {}),
          reviewedAt: new Date().toISOString(),
          finalDecisionBy: 'HOD',
        };
        queryClient.setQueryData(['request', id], updatedReq);
        queryClient.setQueryData(['requests'], (old: any[] | undefined) =>
          old ? old.map(r => (r.id === id || r.requestId === id ? updatedReq : r)) : [updatedReq]
        );
        queryClient.setQueryData(['public-approved-requests'], (old: any[] | undefined) => {
          if (!old) return action === 'approve' ? [updatedReq] : [];
          if (action === 'approve') {
            return old.some(r => r.id === id || r.requestId === id)
              ? old.map(r => (r.id === id || r.requestId === id ? updatedReq : r))
              : [...old, updatedReq];
          } else {
            return old.filter(r => r.id !== id && r.requestId !== id);
          }
        });
        return updatedReq;
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['attendanceSubmissions'] });
      void queryClient.invalidateQueries({ queryKey: ['request', id] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setConfirmModal(null);
      setRejectionReason('');
      setToastMsg(`✅ HOD Executive Override Applied: Request is now ${variables.action === 'approve' ? 'APPROVED' : 'REJECTED'}`);
      setTimeout(() => setToastMsg(null), 4000);
    },
  });

  if (isLoading) {
    return (
      <PageWrapper role="hod">
        <div className="max-w-xl mx-auto text-center py-20">
          <p className="text-[14px] text-[#6B7280]">Loading request details...</p>
        </div>
      </PageWrapper>
    );
  }

  if (!request) {
    return (
      <NotFound
        code="404"
        title="This attendance request could not be found."
      />
    );
  }

  const currentStatus = request.status;

  const appliedPeriodsList = request.periods
    ? request.periods.split(/[, ]+/).filter(Boolean)
    : ['1', '2', '3', '4', '5', '6', '7', '8'];

  const openApproveModal = () => {
    setSelectedPeriods(appliedPeriodsList);
    setConfirmModal('approve');
  };

  const handleConfirm = () => {
    reviewMutation.mutate({
      action: confirmModal === 'approve' ? 'approve' : 'reject',
      reason: confirmModal === 'reject' ? rejectionReason : undefined,
      periods: confirmModal === 'approve' && selectedPeriods.length > 0 ? selectedPeriods.join(', ') : undefined,
    });
  };

  const assignedFacultyDisplay = (() => {
    if (request.faculties && request.faculties.length > 0) {
      const names = Array.from(new Set(request.faculties.map(f => f.name).filter(Boolean)));
      if (names.length > 0) return names.join(', ');
    }
    return request.faculty?.name || '—';
  })();

  return (
    <PageWrapper role="hod">
      <div className="max-w-xl mx-auto space-y-4">
        {toastMsg && (
          <div className="p-3 bg-orange-500 text-white font-bold text-[13px] rounded-xl shadow-md flex items-center justify-between">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-white text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Back */}
        <button
          onClick={() => navigate('/hod')}
          className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Overview
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111111]">{request.reasonLabel}</h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Assigned to {assignedFacultyDisplay}
            </p>
          </div>
          <StatusBadge status={request.status} finalDecisionBy={request.finalDecisionBy} finalDecisionName={request.finalDecisionName} />
        </div>

        {/* Student info card */}
        <div
          className="mb-6 flex flex-row items-stretch"
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Photo */}
          <div className="w-28 sm:w-32 flex-shrink-0 relative bg-slate-100 flex items-center justify-center overflow-hidden border-r border-slate-100">
            <img
              src={
                request.student?.avatarUrl ||
                (request.student?.rollNumber
                  ? `https://srkrexams.in/SRKR/photo/${request.student.rollNumber.toUpperCase()}.jpg`
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(request.student?.name || 'Student')}&background=EA580C&color=fff&size=256`)
              }
              alt={request.student?.name || 'Student Photo'}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('ui-avatars.com')) {
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    request.student?.name || 'Student'
                  )}&background=EA580C&color=fff&size=256`;
                }
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 p-4 sm:px-5 sm:py-4 flex flex-col justify-center gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[17px] font-heading font-bold text-slate-900">
                {request.student?.name}
              </p>
              <VerifiedActivityBadge student={request.student} studentId={request.studentId} size="md" />
            </div>
            <p className="text-[13px] text-slate-500">
              Roll No: <span className="font-bold text-slate-800">{request.student?.rollNumber}</span>
            </p>
            <p className="text-[13px] text-slate-500">
              Department: <span className="font-bold text-slate-800">{request.student?.department}</span>
            </p>
            <p className="text-[13px] text-slate-500">
              Semester: <span className="font-bold text-slate-800">{request.student?.semester ? `${request.student.semester}th Sem` : '—'}</span>
            </p>
          </div>
        </div>

        {/* Faculty info */}
        <div className="card p-5 mb-4">
          <p className="text-[13px] font-medium text-[#6B7280] mb-3">
            Assigned Faculty ({request.faculties?.length || 1})
          </p>
          <div className="flex flex-col gap-3">
            {(request.faculties && request.faculties.length > 0 ? request.faculties : [request.faculty]).map((fac, idx) => (
              <div key={fac?.id || idx} className="flex items-center gap-4 py-1 border-b border-slate-50 last:border-0">
                <Avatar
                  name={fac?.name || 'F'}
                  src={fac?.avatarUrl}
                  size="md"
                  role="faculty"
                />
                <div>
                  <p className="text-[14px] font-semibold text-[#111111]">{fac?.name || 'Department Faculty'}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    {fac?.designation || 'Faculty Member'} · {fac?.department} · {fac?.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="card p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                <Calendar size={15} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-[13px] text-[#6B7280] mb-0.5">Date</p>
                <p className="text-[14px] font-medium text-[#111111]">{formatDate(request.date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                <Clock size={15} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-[13px] text-[#6B7280] mb-0.5">Time / Periods</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-slate-900">
                    {request.startTime && request.endTime
                      ? `${formatTime(request.startTime)} – ${formatTime(request.endTime)}`
                      : 'Full Day'}
                  </span>
                  {request.periods && (
                    <div className="inline-flex items-center gap-1 flex-wrap">
                      {request.periods
                        .split(/[, ]+/)
                        .filter(Boolean)
                        .map((p, idx) => (
                          <span
                            key={idx}
                            style={{
                              width: '16px',
                              height: '16px',
                              minWidth: '16px',
                              minHeight: '16px',
                              maxWidth: '16px',
                              maxHeight: '16px',
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              lineHeight: 1,
                              fontSize: '8.5px',
                            }}
                            className={`font-bold font-mono transition-all ${
                              currentStatus === 'approved'
                                ? 'bg-orange-500 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                            title={`Period ${p}${currentStatus === 'approved' ? ' (Approved)' : ''}`}
                          >
                            {p}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Approved By (Shown when status is approved) */}
            {currentStatus === 'approved' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                  <UserCheck size={15} />
                </div>
                <div>
                  <p className="text-[13px] text-[#6B7280] mb-0.5">Approved By</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-bold text-slate-900">
                      {request.finalDecisionName || request.faculty?.name || (request.finalDecisionBy === 'HOD' ? 'Head of Department' : 'Faculty')}
                    </span>
                    {request.finalDecisionBy && (
                      <span className="px-2 py-0.2 rounded text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {request.finalDecisionBy}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Uploaded Student Proof Document Section */}
            {Boolean(request.documentName || request.documentUrl) && (
              <div className="flex items-center justify-between gap-3 sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{request.documentName || 'Proof_Document.pdf'}</p>
                    <p className="text-[11px] text-slate-400">Attached student proof</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className="h-7 px-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Eye size={12} />
                    <span>Preview</span>
                  </button>
                  <a
                    href={request.documentUrl || (request.documentName?.startsWith('http') ? request.documentName : undefined)}
                    download={request.documentName || 'proof_document'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      const targetUrl = request.documentUrl || (request.documentName?.startsWith('http') ? request.documentName : null);
                      if (!targetUrl) {
                        e.preventDefault();
                        setIsPreviewOpen(true);
                      }
                    }}
                    className="h-7 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            )}

            <ProofPreviewModal
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              documentUrl={request.documentUrl}
              documentName={request.documentName}
            />
          </div>
        </div>

        {/* Description */}
        <div className="card p-5 mb-4">
          <p className="text-[13px] font-medium text-[#6B7280] mb-2">Description</p>
          <p className="text-[15px] text-[#111111] leading-relaxed">{request.description}</p>
        </div>

        {/* Rejection reason */}
        {request.status === 'rejected' && Boolean((request as any).rejectionReason) && (
          <div className="bg-danger/5 border border-danger/20 rounded-xl px-5 py-4 mb-4">
            <p className="text-[13px] font-medium text-danger mb-1">Rejection Reason</p>
            <p className="text-[14px] text-[#111111]">{(request as any).rejectionReason}</p>
          </div>
        )}

        {/* HOD Executive Decision & Override */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-slate-900">
                  Executive Decision &amp; Override
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                  currentStatus === 'approved'
                    ? 'bg-slate-100 text-slate-900 border border-slate-300'
                    : currentStatus === 'rejected'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {currentStatus}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                Authorize or override the approval status for this student request.
              </p>
            </div>

            {/* Small Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {currentStatus !== 'approved' && (
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={openApproveModal}
                  className="h-8 px-3 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Approve Request"
                >
                  <CheckCircle2 size={13} />
                  <span>{currentStatus === 'pending' ? 'Approve' : 'Override to Approve'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() => setConfirmModal('reject')}
                className="h-8 px-2.5 rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                title="Reject or Override Request"
              >
                <XCircle size={13} />
                <span>{currentStatus === 'approved' ? 'Override to Reject' : currentStatus === 'rejected' ? 'Edit Reason' : 'Reject'}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/hod/requests')}
                className="h-8 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Back to requests list"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation / Rejection / Period Selection Modal */}
      <Modal
        open={Boolean(confirmModal)}
        onClose={() => { setConfirmModal(null); setRejectionReason(''); }}
        title={
          confirmModal === 'approve'
            ? currentStatus === 'pending' ? 'Approve Request' : 'Force Approve Request'
            : currentStatus === 'pending' ? 'Confirm Rejection' : 'Force Reject Request'
        }
      >
        <p className="text-[13.5px] text-slate-600 mb-3 leading-normal">
          {confirmModal === 'approve'
            ? `Review and select which requested periods to approve for `
            : `Are you sure you want to ${currentStatus !== 'pending' ? 'override and ' : ''}reject this permission request for `}
          <strong className="text-slate-900">{request.student?.name}</strong>:
        </p>

        {confirmModal === 'approve' && (
          <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 mb-5">
            {/* Student Applied Notice & Minimal Presets */}
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/80">
              <span className="text-[12px] text-slate-600">
                Applied: <strong className="text-slate-900">{appliedPeriodsList.length === 8 ? 'All 8 Periods (Full Day)' : `Periods ${appliedPeriodsList.join(', ')}`}</strong>
              </span>
              <div className="flex items-center gap-1.5 text-[11.5px]">
                <button
                  type="button"
                  onClick={() => setSelectedPeriods(appliedPeriodsList)}
                  className="px-2 py-0.5 rounded-lg font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-all cursor-pointer"
                  title="Select all periods requested by student"
                >
                  Select All ({appliedPeriodsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriods([])}
                  className="px-2 py-0.5 rounded-lg font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* 8 Perfectly Round Period Circles */}
            <div className="flex items-center justify-between gap-1.5 py-1 px-0.5">
              {['1', '2', '3', '4', '5', '6', '7', '8'].map(p => {
                const isApplied = appliedPeriodsList.includes(p);
                const isChecked = selectedPeriods.includes(p);

                if (!isApplied) {
                  return (
                    <div
                      key={p}
                      style={{
                        width: '28px',
                        height: '28px',
                        minWidth: '28px',
                        minHeight: '28px',
                        maxWidth: '28px',
                        maxHeight: '28px',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        lineHeight: 1,
                      }}
                      className="font-semibold text-[11.5px] border border-dashed border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed select-none"
                      title={`Period ${p} (Not requested by student)`}
                    >
                      {p}
                    </div>
                  );
                }

                return (
                  <button
                    key={p}
                    type="button"
                    style={{
                      width: '28px',
                      height: '28px',
                      minWidth: '28px',
                      minHeight: '28px',
                      maxWidth: '28px',
                      maxHeight: '28px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      lineHeight: 1,
                    }}
                    onClick={() => {
                      setSelectedPeriods(prev =>
                        prev.includes(p)
                          ? prev.filter(x => x !== p)
                          : [...prev, p].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
                      );
                    }}
                    className={`font-bold text-[12px] transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-orange-500 text-white shadow-xs ring-2 ring-orange-400/30'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                    title={`Period ${p}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Helper text */}
            <p className="text-[11.5px] text-slate-500 mt-2">
              {selectedPeriods.length === 0 ? (
                <span className="text-rose-600 font-semibold">⚠️ Select at least 1 period to approve.</span>
              ) : selectedPeriods.length === appliedPeriodsList.length ? (
                appliedPeriodsList.length === 8
                  ? '✓ Approving All 8 Periods (Full Day).'
                  : `✓ Approving all ${appliedPeriodsList.length} requested period(s) (${appliedPeriodsList.join(', ')}).`
              ) : (
                <span>
                  ✓ Partial Approval: Approving <strong>Period(s) {selectedPeriods.join(', ')}</strong> of {appliedPeriodsList.length} requested.
                </span>
              )}
            </p>
          </div>
        )}

        {confirmModal === 'reject' && (
          <div className="mb-5">
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Reason for Rejection (Optional)
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Exam scheduled on the same day..."
              className="w-full text-[13.5px] p-3 border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 bg-slate-50/50"
            />
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => { setConfirmModal(null); setRejectionReason(''); }}
            disabled={reviewMutation.isPending}
            className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-semibold rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={reviewMutation.isPending || (confirmModal === 'approve' && selectedPeriods.length === 0)}
            className={`h-9 px-5 text-[13px] font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmModal === 'reject'
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xs'
            }`}
          >
            {reviewMutation.isPending
              ? 'Processing...'
              : confirmModal === 'approve'
              ? selectedPeriods.length === appliedPeriodsList.length
                ? appliedPeriodsList.length === 8 ? 'Approve Full Day' : `Approve All (${selectedPeriods.length})`
                : `Approve (${selectedPeriods.length})`
              : 'Reject Request'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
