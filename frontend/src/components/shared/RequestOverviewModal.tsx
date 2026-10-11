import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Calendar, Clock, Paperclip, CheckCircle2, XCircle, ArrowRight, Eye, Download } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatTime, formatSubmittedAt } from '../../lib/utils';
import type { AttendanceRequest } from '../../types';
import { ProofPreviewModal } from './ProofPreviewModal';
import { VerifiedActivityBadge } from './VerifiedActivityBadge';

interface RequestOverviewModalProps {
  request: AttendanceRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (req: AttendanceRequest) => void;
  onReject?: (req: AttendanceRequest) => void;
  onFullDetails?: (req: AttendanceRequest) => void;
  role?: 'student' | 'faculty' | 'hod';
}

export function RequestOverviewModal({
  request,
  open,
  onClose,
  onApprove,
  onReject,
  onFullDetails,
  role = 'faculty',
}: RequestOverviewModalProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!open || !request) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-extrabold text-orange-600 uppercase tracking-wider bg-orange-100/80 px-2 py-0.5 rounded-full">
                  Request Overview
                </span>
                <StatusBadge status={request.status} finalDecisionBy={request.finalDecisionBy} finalDecisionName={request.finalDecisionName} />
              </div>
              <h2 className="text-[17px] font-bold text-slate-900 leading-tight">
                {request.reasonLabel} Request
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body content — scrollable */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4">

            {/* Student Info Box */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <Avatar
                name={request.student?.name || 'Student'}
                src={request.student?.avatarUrl}
                rollNumber={request.student?.rollNumber}
                size="lg"
                role="student"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-bold text-slate-900 leading-snug truncate">
                    {request.student?.name}
                  </h3>
                  <VerifiedActivityBadge student={request.student} studentId={request.studentId} size="md" />
                </div>
                <p className="text-[12px] text-slate-500 font-mono mt-0.5">
                  Roll: <span className="font-semibold text-slate-800">{request.student?.rollNumber}</span>
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                  <span className="font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/60">
                    {request.student?.department}
                  </span>
                  <span>•</span>
                  <span>Semester {request.student?.semester || 6}</span>
                </div>
              </div>
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-[13px] font-bold text-slate-800">{formatDate(request.date)}</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Timing</p>
                  <p className="text-[13px] font-bold text-slate-800">
                    {formatTime(request.startTime)} – {formatTime(request.endTime)}
                  </p>
                </div>
              </div>
            </div>

            {/* Submitted Time Box */}
            {request.submittedAt && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-[12px]">
                <span className="font-semibold text-slate-500">Submitted Time:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {formatSubmittedAt(request.submittedAt)}
                </span>
              </div>
            )}

            {/* Uploaded Student Proof Document (Only rendered if proof was uploaded) */}
            {Boolean(request.documentName || request.documentUrl) && (
              <div className="p-3.5 bg-orange-50/60 rounded-xl border border-orange-200/80">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Paperclip size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[11px] font-extrabold text-orange-600 uppercase tracking-wider">Uploaded Student Proof</p>
                      <span className="text-[10px] font-bold text-orange-700 bg-orange-200/70 px-2 py-0.5 rounded-full">Proof Document</span>
                    </div>
                    <p className="text-[13px] font-bold text-slate-900 truncate">{request.documentName || 'Uploaded_Proof_Document.pdf'}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-800 underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Preview Proof</span>
                      </button>
                      <span className="text-slate-300">•</span>
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
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Proof Preview Modal Overlay */}
            <ProofPreviewModal
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              documentUrl={request.documentUrl}
              documentName={request.documentName}
            />

            {/* Reason Description */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason Description</p>
              <p className="text-[13px] text-slate-800 leading-relaxed font-normal">
                {request.description}
              </p>
            </div>

            {/* Assigned Faculty Members */}
            {(request.faculties && request.faculties.length > 0) && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Faculty Members</p>
                <div className="flex flex-col gap-2">
                  {request.faculties.map((fac, idx) => (
                    <div key={fac.id || idx} className="flex items-center gap-2.5 text-[12px]">
                      <Avatar name={fac.name} src={fac.avatarUrl} size="xs" role="faculty" />
                      <span className="font-semibold text-slate-800">{fac.name}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{fac.department}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {onFullDetails && (
              <button
                type="button"
                onClick={() => onFullDetails(request)}
                className="text-[13px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Full Page View</span>
                <ArrowRight size={14} />
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {(role === 'faculty' || role === 'hod') && request.status === 'pending' && onReject && (
                <button
                  type="button"
                  onClick={() => onReject(request)}
                  className="px-3.5 py-2 text-[12px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              )}

              {(role === 'faculty' || role === 'hod') && request.status === 'pending' && onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(request)}
                  className="px-4 py-2 text-[12px] font-bold text-white bg-orange-500 hover:bg-orange-600 border border-orange-500 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve Request</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-[12px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
