import { motion } from 'framer-motion';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Users, BarChart2, ArrowRight,
  Clock, CheckCircle, XCircle, ArrowUpRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { Avatar } from '../../components/shared/Avatar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { formatDate } from '../../lib/utils';
import { AnnouncementRenderer } from '../../components/announcements/AnnouncementRenderer';

export default function HODDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['requests-summary'],
    queryFn: () => api.getRequestsSummary(),
    refetchInterval: 30000,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: api.getAnnouncements,
    refetchInterval: 60000,
  });

  const totalCount = summaryData?.stats.total ?? 0;
  const pendingCount = summaryData?.stats.pending ?? 0;
  const approvedCount = summaryData?.stats.approved ?? 0;
  const rejectedCount = summaryData?.stats.rejected ?? 0;

  const quickLinks = [
    { label: 'All Requests', description: 'Review & manage student permission requests', icon: ClipboardList, to: '/hod/requests', color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
    { label: 'Faculty Directory', description: 'View department faculty members & workloads', icon: Users, to: '/hod/faculty', color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
    { label: 'Analytics Reports', description: 'Department-wide attendance permission metrics', icon: BarChart2, to: '/hod/reports', color: '#0F172A', bg: 'rgba(15,23,42,0.08)' },
  ];

  const recentRequests = summaryData?.recent ?? [];

  return (
    <PageWrapper role="hod">
      <div className="w-full max-w-[1400px] mx-auto space-y-6 sm:space-y-7 px-2 sm:px-4 pb-20">

        {/* ── Dynamic Opening Animation / Popup Dialog ── */}
        <AnnouncementRenderer announcements={announcements} placement="POPUP" />

        {/* ── Dynamic Top Announcements / Banners ── */}
        <AnnouncementRenderer announcements={announcements} placement="HOME_TOP" />

        {/* ── HOD Profile Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Photo */}
            <div className="sm:w-48 w-full h-64 sm:h-auto flex-shrink-0 bg-slate-100 overflow-hidden relative">
              <img
                src={
                  user?.avatarUrl ??
                  (user?.department === 'CSIT'
                    ? 'https://www.srkrec.ac.in/assets/images/faculty/csit/781.jpeg'
                    : 'https://www.srkrec.ac.in/assets/images/faculty/csd/780.jpeg')
                }
                alt="HOD Profile"
                className="w-full h-full object-cover object-top"
              />
            </div>
            {/* Info */}
            <div className="flex-1 p-5 sm:px-6 sm:py-5 flex flex-col justify-center">
              <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest mb-1.5">
                HOD OVERVIEW
              </p>
              <p className="text-[20px] sm:text-[22px] font-heading font-bold text-slate-900 mb-0.5">{user?.name}</p>
              <p className="text-[13px] sm:text-[14px] text-slate-500 mb-3">Head of Department</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-3 py-1 text-[11px] sm:text-[12px] font-semibold rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                  {user?.department ?? 'CSIT'}
                </span>
                <span className="px-3 py-1 text-[11px] sm:text-[12px] font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  SRKR Engineering College
                </span>
              </div>
              <p className="text-[12px] sm:text-[13px] text-slate-400 font-medium">{user?.email}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Request Statistics Grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="card p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-400">Total Requests</span>
              <ClipboardList size={16} className="text-orange-500" />
            </div>
            <p className="text-[24px] font-heading font-bold text-slate-900">{totalCount}</p>
          </div>

          <div className="card p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-400">Pending Review</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <p className="text-[24px] font-heading font-bold text-amber-600">{pendingCount}</p>
          </div>

          <div className="card p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-400">Approved</span>
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <p className="text-[24px] font-heading font-bold text-emerald-600">{approvedCount}</p>
          </div>

          <div className="card p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-400">Rejected</span>
              <XCircle size={16} className="text-rose-500" />
            </div>
            <p className="text-[24px] font-heading font-bold text-rose-600">{rejectedCount}</p>
          </div>
        </motion.div>

        {/* ── Recent Requests Minimal Expanded Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="card overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xs"
        >
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900">Recent Permission Requests</h2>
              <span className="text-xs text-slate-400 font-medium">({totalCount} total)</span>
            </div>
            <button
              onClick={() => navigate('/hod/requests')}
              className="text-[13px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              View All <ArrowUpRight size={15} />
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-slate-400">Loading requests...</div>
          ) : recentRequests.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-slate-400">No requests submitted yet.</div>
          ) : (
            <>
              {/* Desktop / Tablet Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-4 py-3">Roll No</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Assigned Faculty</th>
                      <th className="px-4 py-3">Date &amp; Periods</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentRequests.map(req => {
                      const studentName = req.student?.name || (req as any).studentName || req.studentId || 'Student';
                      const studentRoll = req.student?.rollNumber || (req as any).rollNumber || (req.studentId?.startsWith('stu-') ? req.studentId.replace('stu-', '').toUpperCase() : req.studentId);
                      const hasMultipleFaculty = Boolean(req.faculties && req.faculties.length > 1);
                      const facultyDisplay = hasMultipleFaculty
                        ? `Multiple (${req.faculties!.length})`
                        : (req.faculties && req.faculties.length === 1 && req.faculties[0]?.name)
                        ? req.faculties[0].name
                        : req.primaryFaculty?.name || req.faculty?.name || (req as any).facultyName || 'Department Faculty';
                      const allFacultyNames = req.faculties && req.faculties.length > 0
                        ? req.faculties.map((f: any) => f.name).join(', ')
                        : facultyDisplay;
                      const reasonLabel = req.reasonLabel || req.reason || 'Permission Request';

                      return (
                        <tr
                          key={req.id}
                          onClick={() => navigate(`/hod/request/${req.id}`)}
                          className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={studentName} src={req.student?.avatarUrl} size="sm" role="student" />
                              <span className="text-[13px] font-semibold text-slate-800 truncate max-w-[180px]">{studentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[12.5px] font-mono text-slate-500">
                            {studentRoll}
                          </td>
                          <td className="px-4 py-3.5 text-[13px] text-slate-700 font-medium">
                            {reasonLabel}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg border inline-block ${
                                hasMultipleFaculty
                                  ? 'text-slate-800 bg-slate-100 border-slate-200'
                                  : 'text-orange-700 bg-orange-50 border-orange-200/80'
                              }`}
                              title={allFacultyNames}
                            >
                              {facultyDisplay}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-medium text-slate-700">{formatDate(req.date)}</span>
                              {req.periods && (
                                <div className="inline-flex items-center gap-0.5 shrink-0">
                                  {req.periods
                                    .split(/[, ]+/)
                                    .filter(Boolean)
                                    .map((p, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          width: '15px',
                                          height: '15px',
                                          minWidth: '15px',
                                          minHeight: '15px',
                                          borderRadius: '50%',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          padding: 0,
                                          lineHeight: 1,
                                          fontSize: '8px',
                                        }}
                                        className={`font-bold font-mono ${
                                          req.status === 'approved'
                                            ? 'bg-orange-500 text-white shadow-2xs'
                                            : 'bg-slate-200 text-slate-700'
                                        }`}
                                        title={`Period ${p}`}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} finalDecisionName={req.finalDecisionName} />
                            {req.status === 'approved' && (req.finalDecisionName || req.faculty?.name) && (
                              <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                                Approved by: <span className="font-semibold text-slate-800">{req.finalDecisionName || req.faculty?.name}</span>
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (Minimal Clean Card List) */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {recentRequests.map(req => {
                  const studentName = req.student?.name || (req as any).studentName || req.studentId || 'Student';
                  const studentRoll = req.student?.rollNumber || (req as any).rollNumber || (req.studentId?.startsWith('stu-') ? req.studentId.replace('stu-', '').toUpperCase() : req.studentId);
                  const hasMultipleFaculty = Boolean(req.faculties && req.faculties.length > 1);
                  const facultyDisplay = hasMultipleFaculty
                    ? `Multiple (${req.faculties!.length})`
                    : (req.faculties && req.faculties.length === 1 && req.faculties[0]?.name)
                    ? req.faculties[0].name
                    : req.primaryFaculty?.name || req.faculty?.name || (req as any).facultyName || 'Department Faculty';
                  const reasonLabel = req.reasonLabel || req.reason || 'Permission Request';

                  return (
                    <div
                      key={req.id}
                      onClick={() => navigate(`/hod/request/${req.id}`)}
                      className="p-3.5 cursor-pointer hover:bg-slate-50/70 transition-colors flex flex-col gap-2"
                    >
                      {/* Top Row: Avatar, Name & Roll No + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={studentName} src={req.student?.avatarUrl} size="sm" role="student" />
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-bold text-slate-800 leading-tight truncate">{studentName}</p>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{studentRoll}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} finalDecisionName={req.finalDecisionName} />
                          {req.status === 'approved' && (req.finalDecisionName || req.faculty?.name) && (
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              By: <span className="font-semibold text-slate-800">{req.finalDecisionName || req.faculty?.name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Middle Row: Reason, Proof & Date / Periods */}
                      <div className="flex items-center justify-between text-[11.5px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">{reasonLabel}</span>
                          {req.periods && (
                            <div className="inline-flex items-center gap-0.5 shrink-0">
                              {req.periods
                                .split(/[, ]+/)
                                .filter(Boolean)
                                .map((p, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      width: '15px',
                                      height: '15px',
                                      minWidth: '15px',
                                      minHeight: '15px',
                                      borderRadius: '50%',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      lineHeight: 1,
                                      fontSize: '8px',
                                    }}
                                    className={`font-bold font-mono ${
                                      req.status === 'approved'
                                        ? 'bg-orange-500 text-white shadow-2xs'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                    title={`Period ${p}`}
                                  >
                                    {p}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">{formatDate(req.date)}</span>
                      </div>

                      {/* Faculty Badge Row */}
                      <div className="flex items-center gap-1 text-[11px] pt-0.5">
                        <span className="text-slate-400">Faculty:</span>
                        <span
                          className={`font-semibold px-2 py-0.2 rounded-md border truncate max-w-[180px] ${
                            hasMultipleFaculty
                              ? 'text-slate-800 bg-slate-100 border-slate-200'
                              : 'text-orange-700 bg-orange-50 border-orange-200/80'
                          }`}
                        >
                          {facultyDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>

        {/* ── Quick Navigation Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {quickLinks.map(link => {
            const Icon = link.icon;
            return (
              <div
                key={link.label}
                onClick={() => navigate(link.to)}
                className="card p-5 cursor-pointer hover:border-orange-200 hover:shadow-subtle transition-all duration-200 group flex items-start gap-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs"
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: link.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={22} style={{ color: link.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                      {link.label}
                    </h3>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-[12px] text-slate-400 leading-snug">
                    {link.description}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* ── Dynamic Bottom Announcements ── */}
        <AnnouncementRenderer announcements={announcements} placement="HOME_BOTTOM" />

      </div>
    </PageWrapper>
  );
}
