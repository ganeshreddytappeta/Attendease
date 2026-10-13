import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, User, Eye, Pencil, Trash2, Download } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { WhatsAppShareButton } from '../../components/shared/WhatsAppShareButton';
import { Button } from '../../components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { formatDate, formatTime, formatSubmittedAt } from '../../lib/utils';
import { ProofPreviewModal } from '../../components/shared/ProofPreviewModal';
import { EditRequestModal } from '../../components/shared/EditRequestModal';
import { useState } from 'react';

/** Calculate duration between times or dates */
function calculateDuration(startTime?: string, endTime?: string, date?: string, endDate?: string): string {
  if (date && endDate && date !== endDate) {
    const d1 = new Date(date);
    const d2 = new Date(endDate);
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 1) return `${diffDays} Days`;
  }
  if (startTime && endTime) {
    const parseMins = (t: string) => {
      const parts = t.trim().split(':');
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
      return 0;
    };
    const m1 = parseMins(startTime);
    const m2 = parseMins(endTime);
    if (m2 > m1) {
      const diffMins = m2 - m1;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
      if (hours > 0) return `${hours} Hour${hours > 1 ? 's' : ''}`;
      return `${mins} Mins`;
    }
  }
  return '3 Hours';
}

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const { data: request, isLoading, isError } = useQuery({
    queryKey: ['request', id],
    queryFn: () => api.getRequest(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <PageWrapper role="student">
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 14 }}>Loading...</div>
      </PageWrapper>
    );
  }

  if (isError || !request) {
    return (
      <PageWrapper role="student">
        <div className="max-w-xl mx-auto text-center py-20">
          <p className="text-[16px] text-[#6B7280]">Request not found.</p>
          <Button className="mt-4" onClick={() => navigate('/student/history')}>
            Back to History
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const facultyList = request.faculties && request.faculties.length > 0
    ? request.faculties
    : (request.faculty ? [request.faculty] : []);

  const facultyNames = facultyList.map((f: any) => f.name).filter(Boolean).join(', ') || '—';

  const appliedPeriodsList = request.periods
    ? request.periods.split(/[, ]+/).filter(Boolean)
    : ['5', '6', '7', '8'];

  const studentPhotoUrl =
    request.student?.avatarUrl ||
    (request.student?.rollNumber
      ? `https://srkrexams.in/SRKR/photo/${request.student.rollNumber.toUpperCase()}.jpg`
      : undefined);

  const durationText = calculateDuration(request.startTime, request.endTime, request.date, request.endDate);

  return (
    <PageWrapper role="student">
      <div className="max-w-xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/student/history')}
          className="flex items-center gap-2 text-[14px] text-[#6B7280] hover:text-[#111111] transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to History
        </button>

        {/* Title row */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-semibold text-[#111111]">
              {request.reasonLabel}
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Submitted to <span className="font-medium text-slate-900">{facultyNames}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} finalDecisionBy={request.finalDecisionBy} finalDecisionName={request.finalDecisionName} />
          </div>
        </div>

        {/* ── CARD 1: Student & Details Overview Card ── */}
        <div
          className="p-5 sm:p-6 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}
        >
          {/* Top Section: Student Info & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
            {/* Student Info with Profile Photo */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200/90 flex-shrink-0 flex items-center justify-center">
                {studentPhotoUrl && !photoError ? (
                  <img
                    src={studentPhotoUrl}
                    alt={request.student?.name || 'Student Photo'}
                    className="w-full h-full object-cover object-top"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <User size={22} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-400">Student</p>
                <p className="text-[15px] sm:text-[16px] font-bold text-slate-900 leading-tight uppercase truncate">
                  {request.student?.name || 'Student'}
                </p>
                <p className="text-[13px] font-medium text-slate-500 font-mono mt-0.5">
                  {request.student?.rollNumber || request.studentId}
                </p>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-3.5 sm:border-l sm:border-slate-100 sm:pl-6">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 flex-shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-400">Date</p>
                <p className="text-[15px] font-bold text-slate-900">
                  {formatDate(request.date)}
                  {request.endDate && request.endDate !== request.date && (
                    <span> – {formatDate(request.endDate)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Middle Section: Time | Submitted On | Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-slate-100">
            <div>
              <p className="text-[12px] font-medium text-slate-400 mb-1">Time</p>
              <p className="text-[14px] font-bold text-slate-900">
                {formatTime(request.startTime)} – {formatTime(request.endTime)}
              </p>
            </div>
            <div className="sm:border-l sm:border-slate-100 sm:pl-4">
              <p className="text-[12px] font-medium text-slate-400 mb-1">Submitted On</p>
              <p className="text-[14px] font-bold text-slate-900 font-mono">
                {formatSubmittedAt(request.submittedAt)}
              </p>
            </div>
            <div className="sm:border-l sm:border-slate-100 sm:pl-4">
              <p className="text-[12px] font-medium text-slate-400 mb-1">Duration</p>
              <p className="text-[14px] font-bold text-slate-900">
                {durationText}
              </p>
            </div>
          </div>

          {/* Bottom Section: Periods Row */}
          <div className="flex items-center gap-4 pt-4">
            <span className="text-[12.5px] font-medium text-slate-500">Periods</span>
            <div className="flex items-center gap-2 flex-wrap">
              {appliedPeriodsList.map((periodNum, i) => (
                <span
                  key={i}
                  className="w-8 h-8 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C] font-bold text-xs flex items-center justify-center shadow-2xs"
                >
                  {periodNum}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── CARD 2: Assigned Faculty Reviewers ── */}
        <div
          className="p-5 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}
        >
          <p className="text-[13.5px] font-bold text-slate-700 mb-3">
            Assigned Faculty Reviewer{facultyList.length > 1 ? `s (${facultyList.length})` : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {facultyList.map((fac: any, idx: number) => {
              const initial = fac.name ? fac.name.trim().charAt(0).toUpperCase() : 'F';
              return (
                <div
                  key={fac.id || fac.userId || idx}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex items-center gap-3.5"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C] font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-slate-900 truncate">
                      {fac.name}
                    </p>
                    <p className="text-[12px] font-medium text-slate-500 truncate">
                      {fac.department || 'Faculty'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CARD 3: Description ── */}
        <div
          className="p-5 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}
        >
          <p className="text-[13.5px] font-bold text-slate-700 mb-2">Description</p>
          <p className="text-[14px] font-medium text-slate-900 leading-relaxed">
            {request.description}
          </p>
        </div>

        {/* Proof Document Card (if attached) */}
        {Boolean(request.documentName || request.documentUrl) && (
          <div
            className="p-5 mb-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
            style={{
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #E8ECF0',
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-slate-400">Proof Document</p>
                  <p className="text-[13.5px] font-bold text-slate-900 truncate">
                    {request.documentName || 'Proof Document'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Preview Proof"
                  onClick={() => setIsPreviewOpen(true)}
                  className="w-8 h-8 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Eye size={15} />
                </button>
                <a
                  href={request.documentUrl || (request.documentName?.startsWith('http') ? request.documentName : undefined)}
                  download={request.documentName || 'proof_document'}
                  title="Download Proof"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    const targetUrl = request.documentUrl || (request.documentName?.startsWith('http') ? request.documentName : null);
                    if (!targetUrl) {
                      e.preventDefault();
                      setIsPreviewOpen(true);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>

            <ProofPreviewModal
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              documentUrl={request.documentUrl}
              documentName={request.documentName}
            />
          </div>
        )}

        {/* Rejection reason */}
        {request.status === 'rejected' && request.rejectionReason && (
          <div className="bg-danger/5 border border-danger/20 rounded-xl px-5 py-4 mb-4">
            <p className="text-[13px] font-medium text-danger mb-1">Rejection Reason</p>
            <p className="text-[14px] text-[#111111]">{request.rejectionReason}</p>
          </div>
        )}

        {/* ── CARD 4: Approval Timeline (Horizontal Stepper) ── */}
        <div
          className="p-6 mb-8 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #E8ECF0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}
        >
          <p className="text-[13.5px] font-bold text-slate-700 mb-6">Approval Timeline</p>

          {/* Stepper container with perfectly aligned background connector line */}
          <div className="relative max-w-md mx-auto mb-6">
            {/* Connecting lines between circle centers */}
            <div
              className="absolute top-4 left-0 right-0 flex -translate-y-1/2 pointer-events-none z-0"
              style={{ paddingLeft: '16.666%', paddingRight: '16.666%' }}
            >
              <div
                className={`h-0.5 flex-1 transition-colors duration-200 ${
                  request.status !== 'pending' ? 'bg-slate-900' : 'bg-slate-200'
                }`}
              />
              <div
                className={`h-0.5 flex-1 transition-colors duration-200 ${
                  request.status === 'approved'
                    ? 'bg-emerald-600'
                    : request.status === 'rejected'
                      ? 'bg-rose-600'
                      : 'bg-slate-200'
                }`}
              />
            </div>

            {/* Stepper items */}
            <div className="relative flex items-start justify-between z-10">
              {/* Step 1: Submitted */}
              <div className="flex-1 flex flex-col items-center text-center px-1">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  1
                </div>
                <p className="text-[12px] font-bold text-slate-900 mt-2.5 leading-tight">Submitted</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight font-mono">
                  {formatSubmittedAt(request.submittedAt) || 'Done'}
                </p>
              </div>

              {/* Step 2: Faculty Review */}
              <div className="flex-1 flex flex-col items-center text-center px-1">
                <div
                  className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shadow-xs ${
                    request.status !== 'pending'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  2
                </div>
                <p className="text-[12px] font-bold text-slate-900 mt-2.5 leading-tight">Faculty Review</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight">
                  {request.status === 'pending'
                    ? 'Pending'
                    : request.reviewedAt
                      ? formatSubmittedAt(request.reviewedAt)
                      : 'Reviewed'}
                </p>
              </div>

              {/* Step 3: Approved / Rejected */}
              <div className="flex-1 flex flex-col items-center text-center px-1">
                <div
                  className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shadow-xs ${
                    request.status === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : request.status === 'rejected'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  3
                </div>
                <p className="text-[12px] font-bold text-slate-900 mt-2.5 leading-tight">
                  {request.status === 'rejected' ? 'Rejected' : 'Approved'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-tight">
                  {request.status === 'approved'
                    ? 'Approved'
                    : request.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Info Notice Banner */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-600">
            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
              i
            </div>
            <p className="flex-1 leading-snug">
              {request.status === 'pending'
                ? 'Your request is under review by the assigned faculty members.'
                : request.status === 'approved'
                  ? `Your request has been approved${request.finalDecisionName ? ' by ' + request.finalDecisionName : ''
                  }.`
                  : `Your request has been rejected.${request.rejectionReason ? ' Reason: ' + request.rejectionReason : ''
                  }`}
            </p>
          </div>
        </div>

        {/* ── Round Icon Action Buttons ── */}
        <div className="flex flex-col items-center justify-center gap-2 mt-6 pt-2">
          <div className="flex items-center justify-center gap-4">
            <WhatsAppShareButton
              request={request}
              variant="round"
              className="w-13 h-13 shadow-md shadow-[#25D366]/30"
            />

            {request.status !== 'approved' && (
              <button
                type="button"
                title="Edit Request"
                onClick={() => setIsEditOpen(true)}
                className="w-13 h-13 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer border-none"
              >
                <Pencil size={20} />
              </button>
            )}

            {request.status === 'pending' && (
              <button
                type="button"
                title="Cancel Request"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to cancel and delete this request?')) {
                    try {
                      await api.deleteRequest(request.id);
                      navigate('/student/history');
                    } catch (err) {
                      alert('Failed to delete request.');
                    }
                  }
                }}
                className="w-13 h-13 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              type="button"
              title="Back to History"
              onClick={() => navigate('/student/history')}
              className="w-13 h-13 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200 active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
        </div>

        {/* Inline Edit Request Modal Overlay */}
        <EditRequestModal
          request={request}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      </div>
    </PageWrapper>
  );
}
