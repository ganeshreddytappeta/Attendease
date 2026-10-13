import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Send,
  Briefcase,
  Rocket,
  Code,
  Trophy,
  Info,
  ShieldCheck,
  Building
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { EmptyState } from '../../components/shared/EmptyState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import type { CertificateRequest, StudentActivity, ActivityCategory } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const CATEGORY_MAP: Record<ActivityCategory, { label: string; icon: any; color: string; bg: string }> = {
  internship: { label: 'Internship', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
  startup: { label: 'Startup', icon: Rocket, color: 'text-purple-600', bg: 'bg-purple-50' },
  project_work: { label: 'Project Work', icon: Code, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  sports: { label: 'Sports', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  house_events: { label: 'House Events', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
};

export default function StudentCertificates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Active view: 'my-certificates' | 'available-activities'
  const [activeTab, setActiveTab] = useState<'certificates' | 'activities'>('certificates');

  // Request modal
  const [selectedActivity, setSelectedActivity] = useState<StudentActivity | null>(null);
  const [remarks, setRemarks] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Student's own certificate requests
  const { data: certData, isLoading: loadingCerts } = useQuery({
    queryKey: ['my-certificate-requests'],
    queryFn: () => api.getMyCertificateRequests(),
  });

  const certRequests: CertificateRequest[] = certData?.requests || [];

  // 2. Fetch Student's registered activities
  const { data: activitiesData, isLoading: loadingActivities } = useQuery({
    queryKey: ['my-registered-activities'],
    queryFn: async () => {
      const res = await api.getStudentActivities({ category: 'all' });
      const all: StudentActivity[] = Array.isArray(res) ? res : ((res as any)?.activities || []);
      // Filter for this student's activities
      const myId = (user?.userId || user?.id || '').toLowerCase().trim();
      const myRoll = (user?.rollNumber || '').toLowerCase().trim();
      return all.filter((a: any) => {
        const sId = (a.studentId || a.student?.userId || a.student?.id || '').toLowerCase().trim();
        const sRoll = (a.student?.rollNumber || '').toLowerCase().trim();
        return (myId && sId === myId) || (myRoll && sRoll === myRoll);
      });
    },
  });

  const myActivities: StudentActivity[] = activitiesData || [];

  // Submit Certificate Request Mutation
  const requestMutation = useMutation({
    mutationFn: ({ activityId, studentRemarks }: { activityId: string; studentRemarks?: string }) =>
      api.submitCertificateRequest(activityId, studentRemarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-certificate-requests'] });
      setSelectedActivity(null);
      setRemarks('');
      showToast('success', 'Certificate request submitted successfully for coordinator review.');
      setActiveTab('certificates');
    },
    onError: (err: any) => {
      showToast('error', err.message || 'Failed to submit request.');
    },
  });

  const handleCopyLink = (token: string, reqId: string) => {
    const url = `${window.location.origin}/verify/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(reqId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Find if an activity already has a pending or approved request
  const getExistingRequestForActivity = (activityId: string) => {
    return certRequests.find((r) => r.activityId === activityId);
  };

  return (
    <PageWrapper role="student">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-semibold border ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{toast.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Activity Certificates
            </h1>
            <p className="text-sm text-slate-500">
              Request institutional participation certificates and access verified credentials.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('certificates')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'certificates'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Certificates ({certRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'activities'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Eligible Activities ({myActivities.length})
            </button>
          </div>
        </div>

        {/* TAB 1: My Certificates */}
        {activeTab === 'certificates' && (
          <div className="space-y-4">
            {loadingCerts ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Loading your certificate records...
              </div>
            ) : certRequests.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No certificate requests yet"
                description="You haven't requested any certificates. Switch to 'Eligible Activities' to apply for verified certificates for your internships, startups, sports, or projects."
                actionLabel="View Eligible Activities"
                onAction={() => setActiveTab('activities')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {certRequests.map((req) => {
                  const catConfig = CATEGORY_MAP[req.activity?.category as ActivityCategory] || {
                    label: req.activity?.category || 'Activity',
                    icon: Award,
                    color: 'text-slate-700',
                    bg: 'bg-slate-50',
                  };
                  const CatIcon = catConfig.icon;
                  const isApproved = req.status === 'approved' && req.certificate && !req.certificate.revokedAt;
                  const isRevoked = req.status === 'revoked' || Boolean(req.certificate?.revokedAt);
                  const isPending = req.status === 'pending';
                  const isRejected = req.status === 'rejected';

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Left Details */}
                        <div className="flex items-start gap-3.5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${catConfig.bg} ${catConfig.color}`}>
                            <CatIcon className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {catConfig.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isPending
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {isApproved ? 'Approved & Issued' : isPending ? 'Pending Coordinator Review' : isRejected ? 'Declined' : 'Revoked'}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-slate-900">
                              {req.activity?.titleOrCompany || 'Activity Certificate'}
                            </h3>

                            {req.activity?.roleOrPosition && (
                              <p className="text-xs text-slate-600">
                                Role: <span className="font-semibold text-slate-800">{req.activity.roleOrPosition}</span>
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Effective: {req.capturedStartDate || 'N/A'} &rarr; {req.capturedEndDate || 'Ongoing'}
                              </span>
                              <span>&bull;</span>
                              <span>Tenure: <span className="font-medium text-slate-700 capitalize">{req.tenure}</span></span>
                              <span>&bull;</span>
                              <span>Requested: {new Date(req.requestedAt).toLocaleDateString()}</span>
                            </div>

                            {/* Remarks */}
                            {req.coordinatorRemarks && (
                              <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700">
                                <span className="font-semibold text-slate-900">Coordinator Remarks: </span>
                                {req.coordinatorRemarks}
                              </div>
                            )}

                            {req.studentRemarks && (
                              <div className="mt-1 text-xs text-slate-500">
                                Your note: "{req.studentRemarks}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Action buttons */}
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          {isApproved && req.certificate && (
                            <>
                              <button
                                onClick={() => handleCopyLink(req.certificate!.verificationToken, req.id)}
                                className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs"
                                title="Copy public verification link"
                              >
                                {copiedId === req.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedId === req.id ? 'Copied' : 'Share'}</span>
                              </button>

                              <Link
                                to={`/verify/${req.certificate.verificationToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>View Certificate</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Eligible Activities */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            {loadingActivities ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Loading your registered activities...
              </div>
            ) : myActivities.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No activities registered"
                description="You have no registered activities in the department database. Contact your faculty coordinator to add your internship, startup, or project records."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {myActivities.map((act) => {
                  const catConfig = CATEGORY_MAP[act.category] || {
                    label: act.category,
                    icon: Award,
                    color: 'text-slate-700',
                    bg: 'bg-slate-50',
                  };
                  const CatIcon = catConfig.icon;
                  const existingReq = getExistingRequestForActivity(act.id);
                  const canRequest = !existingReq || existingReq.status === 'rejected' || existingReq.status === 'revoked';

                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${catConfig.bg} ${catConfig.color}`}>
                          <CatIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {catConfig.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              act.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {act.status === 'completed' ? 'Completed' : 'Active'}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-900">
                            {act.titleOrCompany}
                          </h3>

                          {act.roleOrPosition && (
                            <p className="text-xs text-slate-600">
                              Role / Area: <span className="font-semibold text-slate-800">{act.roleOrPosition}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {act.startDate || 'Start Date N/A'} &rarr; {act.endDate || (act.status === 'active' ? 'Present' : 'Completed')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="self-end sm:self-center shrink-0">
                        {existingReq && (existingReq.status === 'pending' || existingReq.status === 'approved') ? (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                            existingReq.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {existingReq.status === 'approved' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Certificate Issued</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Request Pending</span>
                              </>
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedActivity(act)}
                            className="h-9 px-4 rounded-xl bg-orange-600 text-white hover:bg-orange-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Request Certificate</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal: Request Confirmation */}
        <AnimatePresence>
          {selectedActivity && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Request Participation Certificate</h3>
                  <p className="text-xs text-slate-500">
                    Submit your application to the assigned coordinator for verification and issuance.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Activity:</span>
                    <span className="font-semibold text-slate-900">{selectedActivity.titleOrCompany}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Category:</span>
                    <span className="font-semibold text-slate-900 capitalize">{selectedActivity.category.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tenure State:</span>
                    <span className="font-semibold text-slate-900 capitalize">{selectedActivity.status}</span>
                  </div>
                  {selectedActivity.status === 'active' && (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 text-blue-800 text-[11px] leading-relaxed mt-2 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        For active participation, today's application date is captured as the tenure end date. The certificate will note that participation is ongoing as of this date.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional Remarks / Message for Coordinator
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Completed summer internship project on web frontend..."
                    className="w-full h-20 text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setSelectedActivity(null)}
                    disabled={requestMutation.isPending}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      requestMutation.mutate({
                        activityId: selectedActivity.id,
                        studentRemarks: remarks,
                      })
                    }
                    disabled={requestMutation.isPending}
                    className="px-4 py-2 text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
                  >
                    {requestMutation.isPending ? 'Submitting...' : 'Confirm Request'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
