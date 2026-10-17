import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileText, UserCheck, Eye, Download, ShieldOff, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { formatDate, formatTime, formatSubmittedAt } from '../../lib/utils';
import { ProofPreviewModal } from '../../components/shared/ProofPreviewModal';
import { VerifiedActivityBadge } from '../../components/shared/VerifiedActivityBadge';
import NotFound from '../NotFound';

export default function FacultyRequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  const { data: request, isLoading, isError, error } = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      // Re-throw errors so isError=true fires — especially important for 403
      return await api.getRequest(id!);
    },
    enabled: !!id,
    retry: false, // Don't retry 403/404 — they are definitive
  });

  const reviewMutation = useMutation({
    // Faculty reviews as faculty (asHod=false) so backend applies assignment checks
    mutationFn: (payload: { action: 'approve' | 'reject'; reason?: string; periods?: string }) =>
      api.reviewRequest(id!, payload.action, payload.reason, false, payload.periods),
    onSuccess: (updatedReq) => {
      queryClient.setQueryData(['request', id], updatedReq);
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['facultyRequests'] });
      setConfirmModal(null);
      setRejectionReason('');
    },
  });


  if (isLoading) {
    return (
      <PageWrapper role="faculty" showGreeting={false}>
        <div className="max-w-xl mx-auto text-center py-20">
          <p className="text-[14px] text-[#6B7280]">Loading request details...</p>
        </div>
      </PageWrapper>
    );
  }

  // 403 Forbidden — faculty is not assigned to this request
  const errorMsg = (error as Error)?.message || '';
  const isForbidden = isError && (
    errorMsg.toLowerCase().includes('not assigned') ||
    errorMsg.toLowerCase().includes('forbidden') ||
    errorMsg.toLowerCase().includes('403')
  );

  if (isForbidden) {
    return (
      <PageWrapper role="faculty" showGreeting={false}>
        <div className="max-w-md mx-auto pt-16 pb-8 flex flex-col items-center text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
            <ShieldOff size={28} className="text-rose-500" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 mb-1">Access Denied</h1>
            <p className="text-[14px] text-slate-500 leading-relaxed">
              This request has not been assigned to you. Only the faculty member
              selected by the student can review this request.
            </p>
          </div>
          <div className="w-full bg-rose-50 border border-rose-200 rounded-xl px-5 py-4">
            <p className="text-[13px] font-semibold text-rose-700">
              403 &mdash; You are not assigned to review this request.
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/faculty/requests')}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={15} />
            Back to My Requests
          </Button>
        </div>
      </PageWrapper>
    );
  }

  if (isError || !request) {
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

  return (
    <PageWrapper role="faculty" showGreeting={false}>
      <div className="max-w-xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/faculty/requests')}
          className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111111] transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Requests</span>
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111111]">
              {request.reasonLabel}
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Submitted {formatDate(request.submittedAt)}
            </p>
          </div>
          <StatusBadge status={currentStatus} />
        </div>

        {/* Student Info Card with Photo */}
        <div
          className="mb-4 flex flex-row items-stretch bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden"
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Photo */}
          <div className="w-24 sm:w-28 flex-shrink-0 relative bg-slate-100 flex items-center justify-center overflow-hidden border-r border-slate-100">
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
          <div className="flex-1 p-4 sm:px-5 sm:py-4 flex flex-col justify-center gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Student Profile</p>
            <div className="flex items-center gap-2">
              <p className="text-[16px] font-bold text-slate-900 leading-tight">
                {request.student?.name}
              </p>
              <VerifiedActivityBadge student={request.student} studentId={request.studentId} size="md" />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[13px] text-slate-600 mt-0.5">
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {request.student?.rollNumber}
              </span>
              <span className="font-semibold text-slate-700">
                {request.student?.department}
              </span>
              {request.student?.year && (
                <span className="text-slate-500">
                  · Year {request.student.year}
                </span>
              )}
              {request.student?.semester && (
                <span className="text-slate-500">
                  · {request.student.semester}th Sem
                </span>
              )}
            </div>
            {request.student?.email && (
              <p className="text-[12px] text-slate-400 mt-0.5 truncate">
                {request.student.email}
              </p>
            )}
          </div>
        </div>

        {/* Request Details */}
        <div className="card p-5 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                <Calendar size={15} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-[13px] text-[#6B7280] mb-0.5">Dates</p>
                <p className="text-[14px] font-bold text-slate-900">
                  {formatDate(request.date)}
                  {request.endDate && request.date !== request.endDate && ` – ${formatDate(request.endDate)}`}
                </p>
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
                            title={`Period ${p}${currentStatus === 'approved' ? ' (Approved by Faculty)' : ''}`}
                          >
                            {p}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Assigned Faculty */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0 border border-orange-100">
                <UserCheck size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[13px] text-[#6B7280]">Assigned Faculty</p>
                  {Boolean(request.faculties && request.faculties.length > 1) && (
                    <span className="px-1.5 py-0.2 rounded text-[10.5px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                      Multiple ({request.faculties!.length})
                    </span>
                  )}
                </div>
                {request.faculties && request.faculties.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {request.faculties.map((f: any, idx: number) => (
                      <span
                        key={f?.id || idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                        title={f?.email ? `${f.name} (${f.email})` : f?.name}
                      >
                        {f?.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] font-bold text-slate-900">
                    {request.faculty?.name || request.faculties?.[0]?.name || 'Department Faculty'}
                  </p>
                )}
              </div>
            </div>

            {request.submittedAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                  <Clock size={15} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-[13px] text-[#6B7280] mb-0.5">Submitted On</p>
                  <p className="text-[14px] font-bold text-slate-900 font-mono">
                    {formatSubmittedAt(request.submittedAt)}
                  </p>
                </div>
              </div>
            )}

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
                      {request.finalDecisionName || request.faculty?.name || 'Faculty'}
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
        <div className="card p-5 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
          <p className="text-[13px] font-medium text-[#6B7280] mb-2">Description</p>
          <p className="text-[15px] text-[#111111] leading-relaxed">{request.description}</p>
        </div>

        {/* Rejection Reason (if rejected) */}
        {currentStatus === 'rejected' && Boolean((request as any).rejectionReason) && (
          <div className="card p-5 mb-4 border-rose-200 bg-rose-50/50 rounded-2xl">
            <p className="text-[13px] font-semibold text-rose-700 mb-1">Rejection Reason</p>
            <p className="text-[14px] text-slate-800">{(request as any).rejectionReason}</p>
          </div>
        )}

        {/* Faculty Decision & Override */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-slate-900">
                  Decision &amp; Actions
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
                Approve, reject, or change your decision for this student request.
              </p>
            </div>

            {/* Small Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {currentStatus === 'approved' ? (
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={openApproveModal}
                  className="h-8 px-3 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Change or interchange approved permission periods"
                >
                  <Clock size={13} />
                  <span>Edit Periods</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={reviewMutation.isPending}
                  onClick={openApproveModal}
                  className="h-8 px-3 rounded-lg text-[11.5px] font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Approve Request"
                >
                  <CheckCircle2 size={13} />
                  <span>{currentStatus === 'pending' ? 'Approve' : 'Change to Approve'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() => setConfirmModal('reject')}
                className="h-8 px-2.5 rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                title="Reject Request"
              >
                <XCircle size={13} />
                <span>{currentStatus === 'approved' ? 'Change to Reject' : currentStatus === 'rejected' ? 'Edit Reason' : 'Reject'}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/faculty/requests')}
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
            ? currentStatus === 'approved' ? 'Edit Permission Periods' : currentStatus === 'pending' ? 'Approve Request' : 'Change Decision to Approve'
            : currentStatus === 'pending' ? 'Confirm Rejection' : 'Change Decision to Reject'
        }
      >
        <p className="text-[13.5px] text-slate-600 mb-3 leading-normal">
          {confirmModal === 'approve'
            ? currentStatus === 'approved'
              ? `Select which periods to grant for `
              : `Review and select which periods to approve for `
            : `Are you sure you want to ${currentStatus !== 'pending' ? 'change decision and ' : ''}reject this permission request for `}
          <strong className="text-slate-900">{request.student?.name}</strong>:
        </p>

        {confirmModal === 'approve' && (
          <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 mb-5">
            {/* Student Applied Notice & Minimal Presets */}
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/80">
              <span className="text-[12px] text-slate-600">
                Selected: <strong className="text-slate-900">{selectedPeriods.length === 8 ? 'All 8 Periods (Full Day)' : selectedPeriods.length > 0 ? `Periods ${selectedPeriods.join(', ')}` : 'None'}</strong>
              </span>
              <div className="flex items-center gap-1.5 text-[11.5px]">
                <button
                  type="button"
                  onClick={() => setSelectedPeriods(['1', '2', '3', '4', '5', '6', '7', '8'])}
                  className="px-2 py-0.5 rounded-lg font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-all cursor-pointer"
                  title="Select all 8 periods"
                >
                  All 8
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
                const isChecked = selectedPeriods.includes(p);
                const isCurrent = appliedPeriodsList.includes(p);

                return (
                  <button
                    key={p}
                    type="button"
                    style={{
                      width: '32px',
                      height: '32px',
                      minWidth: '32px',
                      minHeight: '32px',
                      maxWidth: '32px',
                      maxHeight: '32px',
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
                        : isCurrent
                          ? 'bg-white text-orange-700 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50/50'
                          : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                    title={isCurrent ? `Period ${p} (Current/Requested)` : `Period ${p}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Helper text */}
            <p className="text-[11.5px] text-slate-500 mt-2">
              {selectedPeriods.length === 0 ? (
                <span className="text-rose-600 font-semibold">⚠️ Select at least 1 period to grant.</span>
              ) : selectedPeriods.length === 8 ? (
                '✓ Granting All 8 Periods (Full Day).'
              ) : (
                <span>
                  ✓ Granting <strong>Period(s) {selectedPeriods.join(', ')}</strong> ({selectedPeriods.length} period{selectedPeriods.length > 1 ? 's' : ''}).
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
              ? currentStatus === 'approved'
                ? `Update Periods (${selectedPeriods.length})`
                : selectedPeriods.length === 8 ? 'Approve Full Day' : `Approve (${selectedPeriods.length})`
              : 'Reject Request'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
