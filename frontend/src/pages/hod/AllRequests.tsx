import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, RotateCcw, Check, X, Paperclip, ShieldCheck, Loader2 } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Avatar } from '../../components/shared/Avatar';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/ui/Button';
import { VerifiedActivityBadge } from '../../components/shared/VerifiedActivityBadge';
import { formatDate, DEPARTMENTS } from '../../lib/utils';

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as api from '../../lib/api';
import type { AttendanceRequest } from '../../types';
import { HODDirectExemptionModal } from './components/HODDirectExemptionModal';

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const itemVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

type TabValue = 'all' | 'pending' | 'approved' | 'rejected';

export default function HODAllRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch]     = useState('');
  const [department, setDept]   = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [tab, setTab]           = useState<TabValue>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(25);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isExemptionModalOpen, setIsExemptionModalOpen] = useState(false);

  const { data: requestsList = [], isFetching, isLoading } = useQuery({
    queryKey: ['requests', displayLimit, tab],
    queryFn: () => api.getRequests({
      limit: displayLimit,
      status: tab !== 'all' ? tab : undefined,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      return await api.reviewRequest(id, action, undefined, true);
    },
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });
      const previousRequests = queryClient.getQueryData(['requests', displayLimit, tab]);

      setProcessingIds(prev => new Set(prev).add(id));

      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const mapped = old.map((r: AttendanceRequest) =>
          (r.id === id || r.requestId === id)
            ? { ...r, status: action === 'approve' ? 'approved' as const : 'rejected' as const, finalDecisionBy: 'HOD', finalDecisionName: 'HOD' }
            : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });

      return { previousRequests, id };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousRequests) {
        queryClient.setQueryData(['requests', displayLimit, tab], context.previousRequests);
      }
      console.warn('API reviewRequest error:', err);
    },
    onSuccess: (updated) => {
      if (updated) {
        queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          const mapped = old.map((r: AttendanceRequest) =>
            (r.id === updated.id || r.requestId === updated.id) ? { ...r, ...updated } : r
          );
          (mapped as any).total = (old as any).total;
          (mapped as any).hasMore = (old as any).hasMore;
          return mapped;
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
    },
    onSettled: (_, __, vars) => {
      const rowId = vars?.id;
      if (rowId) {
        setProcessingIds(prev => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }
    },
  });

  const filtered = requestsList.filter((req: AttendanceRequest) => {
    const matchesTab    = tab === 'all' || req.status === tab;
    const matchesSearch =
      (req.student?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (req.reasonLabel ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (req.student?.rollNumber ?? req.studentId ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesDept = !department || req.student?.department === department;
    const studentYear = req.student?.year || (req.student?.semester ? `${Math.ceil(req.student.semester / 2)}${Math.ceil(req.student.semester / 2) === 1 ? 'st' : Math.ceil(req.student.semester / 2) === 2 ? 'nd' : Math.ceil(req.student.semester / 2) === 3 ? 'rd' : 'th'} Year` : '');
    const matchesYear = !yearFilter || studentYear === yearFilter;
    return matchesTab && matchesSearch && matchesDept && matchesYear;
  });

  return (
    <PageWrapper role="hod">
      <div className="w-full max-w-[1400px] mx-auto pb-24 px-2 sm:px-4">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <p className="text-[11px] sm:text-[12px] font-bold text-orange-500 uppercase tracking-widest mb-1">HOD Portal</p>
            <h1 className="text-[22px] sm:text-[26px] font-heading font-bold text-slate-900">All Student Requests</h1>
            <p className="text-[13px] sm:text-[14px] text-slate-400 mt-0.5">Every attendance permission request across all department faculty</p>
          </div>

          <button
            onClick={() => setIsExemptionModalOpen(true)}
            style={{
              height: 40,
              padding: '0 16px',
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              color: '#EA580C',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#EA580C';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#EA580C';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#FFF7ED';
              e.currentTarget.style.color = '#EA580C';
              e.currentTarget.style.borderColor = '#FED7AA';
            }}
            className="self-start sm:self-auto shadow-2xs"
          >
            <ShieldCheck size={16} />
            <span>Grant Direct Exemption</span>
          </button>
        </motion.div>

        {/* ── Filters ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-4"
        >
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search by student name, roll number, or reason..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-[40px] pl-9 pr-4 text-[13px] sm:text-[13.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/12 transition-all shadow-subtle"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:flex-initial">
                <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <select
                  value={department}
                  onChange={e => setDept(e.target.value)}
                  className="w-full sm:w-auto h-[40px] pl-8 pr-8 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 appearance-none cursor-pointer text-slate-700 min-w-[130px] shadow-subtle font-medium"
                >
                  <option value="">All Branches</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="MECH">MECH</option>
                  <option value="CIVIL">CIVIL</option>
                </select>
              </div>

              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="h-[40px] px-3 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 cursor-pointer text-slate-700 shadow-subtle font-medium"
              >
                <option value="">All Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>

              <select
                value={tab}
                onChange={e => setTab(e.target.value as TabValue)}
                className="h-[40px] px-3 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 cursor-pointer text-slate-700 shadow-subtle font-medium"
              >
                <option value="all">All Statuses ({requestsList.length})</option>
                <option value="pending">Pending ({requestsList.filter(r => r.status === 'pending').length})</option>
                <option value="approved">Approved ({requestsList.filter(r => r.status === 'approved').length})</option>
                <option value="rejected">Rejected ({requestsList.filter(r => r.status === 'rejected').length})</option>
              </select>

              {(search || department || yearFilter || tab !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setDept(''); setYearFilter(''); setTab('all'); }}
                  className="h-[40px] px-3.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 border border-rose-200 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-subtle cursor-pointer whitespace-nowrap flex-shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Table / Mobile Cards ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
              <Loader2 size={22} className="text-orange-500 animate-spin" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#111111] mb-1">Loading requests...</h3>
            <p className="text-[14px] text-[#6B7280] max-w-xs">Fetching latest student attendance requests</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No requests found"
            description="Try adjusting your filters."
            action={
              <Button variant="secondary" onClick={() => { setSearch(''); setDept(''); setTab('all'); }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="card overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xs"
          >
            {/* Desktop / Tablet View (Table) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">Student</th>
                    <th className="px-3 py-3">Roll No</th>
                    <th className="px-3 py-3">Branch &amp; Year</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-3 py-3 text-center">Proof</th>
                    <th className="px-3 py-3">Assigned Faculty</th>
                    <th className="px-4 py-3">Date &amp; Periods</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="text-right px-5 py-3">Action / Override</th>
                  </tr>
                </thead>
                <motion.tbody variants={listVariants} initial="hidden" animate="visible">
                  {filtered.map(req => {
                    const proofDocName = req.documentName || null;
                    return (
                      <motion.tr
                        key={req.id}
                        variants={itemVariants}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <div className="flex items-center gap-2">
                            <Avatar name={req.student?.name || 'S'} src={req.student?.avatarUrl} size="sm" role="student" />
                            <span className="text-[13px] font-semibold text-slate-800 truncate max-w-[170px]">{req.student?.name}</span>
                            <VerifiedActivityBadge student={req.student} />
                          </div>
                        </td>
                        <td className="px-3 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <span className="text-[12.5px] font-mono text-slate-500">{req.student?.rollNumber}</span>
                        </td>
                        <td className="px-3 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-orange-50 text-orange-700 border border-orange-200/80">
                              {req.student?.department || 'CSIT'}
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {req.student?.year || (req.student?.semester ? `${Math.ceil(req.student.semester / 2)}${Math.ceil(req.student.semester / 2) === 1 ? 'st' : Math.ceil(req.student.semester / 2) === 2 ? 'nd' : Math.ceil(req.student.semester / 2) === 3 ? 'rd' : 'th'} Yr` : '3rd Yr')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <span className="text-[13px] text-slate-700 font-medium">{req.reasonLabel}</span>
                        </td>
                        <td className="px-3 py-3 text-center cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          {proofDocName ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-lg">
                              <Paperclip size={11} className="text-orange-500" />
                              Proof
                            </span>
                          ) : (
                            <span className="text-[12px] text-slate-300 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          {req.faculties && req.faculties.length > 1 ? (
                            <span
                              className="text-[11px] font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 inline-block"
                              title={req.faculties.map((f: any) => f.name).join(', ')}
                            >
                              Multiple ({req.faculties.length})
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-200/80 inline-block">
                              {req.faculties && req.faculties.length === 1
                                ? req.faculties[0].name
                                : req.primaryFaculty?.name || req.faculty?.name || 'Department Faculty'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium text-slate-700">
                              {formatDate(req.date)}{req.endDate && req.endDate !== req.date ? ` – ${formatDate(req.endDate)}` : ''}
                            </span>
                            {req.endDate && req.endDate !== req.date && (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                Multi-Day
                              </span>
                            )}
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
                        <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/hod/request/${req.id}`)}>
                          <StatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} finalDecisionName={req.finalDecisionName} />
                          {req.status === 'approved' && (req.finalDecisionName || req.faculty?.name) && (
                            <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                              Approved by: <span className="font-semibold text-slate-800">{req.finalDecisionName || req.faculty?.name}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            {req.status !== 'approved' && (
                              <button
                                disabled={processingIds.has(req.id)}
                                onClick={() => reviewMutation.mutate({ id: req.id, action: 'approve' })}
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                                title="Approve Request"
                              >
                                {processingIds.has(req.id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                <span>Approve</span>
                              </button>
                            )}
                            <button
                              disabled={processingIds.has(req.id)}
                              onClick={() => reviewMutation.mutate({ id: req.id, action: 'reject' })}
                              className="h-7 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10.5px] rounded-lg border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                              title={req.status === 'approved' ? 'Force Reject Approved Request' : 'Reject Request'}
                            >
                              {processingIds.has(req.id) ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                              <span>{req.status === 'approved' ? 'Force Reject' : 'Reject'}</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile View (Minimal Clean Card List) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              <motion.div variants={listVariants} initial="hidden" animate="visible">
                {filtered.map(req => {
                  const proofDocName = req.documentName || null;
                  const hasMultipleFaculty = Boolean(req.faculties && req.faculties.length > 1);
                  const facultyDisplay = hasMultipleFaculty
                    ? `Multiple (${req.faculties!.length})`
                    : (req.faculties && req.faculties.length === 1 && req.faculties[0]?.name)
                    ? req.faculties[0].name
                    : req.primaryFaculty?.name || req.faculty?.name || 'Department Faculty';

                  return (
                    <motion.div
                      key={req.id}
                      variants={itemVariants}
                      onClick={() => navigate(`/hod/request/${req.id}`)}
                      className="p-3.5 cursor-pointer hover:bg-slate-50/70 transition-colors flex flex-col gap-2"
                    >
                      {/* Top Row: Avatar, Name & Roll No + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={req.student?.name || 'S'} src={req.student?.avatarUrl} size="sm" role="student" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[13.5px] font-bold text-slate-800 leading-tight truncate">{req.student?.name}</p>
                              <VerifiedActivityBadge student={req.student} />
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{req.student?.rollNumber}</p>
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
                          <span className="font-semibold text-slate-800 truncate max-w-[130px]">{req.reasonLabel}</span>
                          {proofDocName && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-100/70 border border-orange-200 px-1.5 py-0.2 rounded">
                              <Paperclip size={10} className="text-orange-500" />
                              Proof
                            </span>
                          )}
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
                        <div className="flex items-center gap-1 text-slate-400 shrink-0 text-[11px]">
                          <span>
                            {formatDate(req.date)}{req.endDate && req.endDate !== req.date ? ` – ${formatDate(req.endDate)}` : ''}
                          </span>
                          {req.endDate && req.endDate !== req.date && (
                            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                              Multi-Day
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Faculty Badge & Quick Action Row */}
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-slate-400">Faculty:</span>
                          <span
                            className={`font-semibold px-2 py-0.2 rounded-md border truncate max-w-[160px] ${
                              hasMultipleFaculty
                                ? 'text-slate-800 bg-slate-100 border-slate-200'
                                : 'text-orange-700 bg-orange-50 border-orange-200/80'
                            }`}
                          >
                            {facultyDisplay}
                          </span>
                        </div>

                        {/* Quick action buttons on mobile */}
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {req.status !== 'approved' && (
                            <button
                              disabled={processingIds.has(req.id)}
                              onClick={() => reviewMutation.mutate({ id: req.id, action: 'approve' })}
                              className="h-6 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                              title="Approve Request"
                            >
                              {processingIds.has(req.id) ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              <span>Approve</span>
                            </button>
                          )}
                          <button
                            disabled={processingIds.has(req.id)}
                            onClick={() => reviewMutation.mutate({ id: req.id, action: 'reject' })}
                            className="h-6 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] rounded-md border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                            title={req.status === 'approved' ? 'Force Reject Approved Request' : 'Reject Request'}
                          >
                            {processingIds.has(req.id) ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                            <span>{req.status === 'approved' ? 'Force Reject' : 'Reject'}</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* ── Load More Controls ── */}
            {(requestsList.hasMore || filtered.length < (requestsList.total || 0)) && (
              <div className="py-3.5 px-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[12px] text-slate-400 font-medium">
                  Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
                  <span className="font-semibold text-slate-700">{requestsList.total || requestsList.length}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDisplayLimit(prev => prev + 25)}
                  disabled={isFetching}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-[12px] font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isFetching && <Loader2 size={12} className="animate-spin text-slate-400" />}
                  <span>Load more</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

      </div>

      <HODDirectExemptionModal
        open={isExemptionModalOpen}
        onClose={() => setIsExemptionModalOpen(false)}
      />
    </PageWrapper>
  );
}
