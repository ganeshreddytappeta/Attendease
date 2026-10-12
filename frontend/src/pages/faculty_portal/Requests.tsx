import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, CheckCheck,
  CheckCircle2, AlertCircle, Paperclip,
  Check, Loader2, X,
} from 'lucide-react';
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

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const itemVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

type TabValue = 'all' | 'pending' | 'approved' | 'rejected';

export default function FacultyRequests() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch]         = useState('');
  const [department, setDept]       = useState('');
  const [yearFilter, setYearFilter] = useState('');
  // Default to pending requests so pending requests load immediately without blocking
  const [tab, setTab]               = useState<TabValue>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [displayLimitPending, setDisplayLimitPending] = useState<number>(50);
  const [displayLimitHistorical, setDisplayLimitHistorical] = useState<number>(25);
  const [toastMsg, setToastMsg]     = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 1. Instant Lightweight Summary Counts: provides true numbers for tabs with zero delay
  const { data: summaryData } = useQuery({
    queryKey: ['requests-summary'],
    queryFn: () => api.getRequestsSummary(),
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // 2. High-Priority: Immediately fetch ONLY the latest 10 Pending Requests on initial load
  const {
    data: initialPendingRequests,
    isLoading: isLoadingInitialPending,
    isFetching: isFetchingInitialPending,
  } = useQuery({
    queryKey: ['requests', 'pending', 10],
    queryFn: () => api.getRequests({
      status: 'pending',
      limit: 10,
    }),
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // 3. Progressive Background Fetch: Fetch additional pending requests progressively
  const {
    data: fullPendingRequests,
    isFetching: isFetchingMorePending,
  } = useQuery({
    queryKey: ['requests', 'pending', displayLimitPending],
    queryFn: () => api.getRequests({
      status: 'pending',
      limit: displayLimitPending,
    }),
    placeholderData: keepPreviousData,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // 4. Lazy Historical Fetch: Only fetched when user switches to Approved, Rejected, or All
  const isHistoricalTab = tab !== 'pending';

  const {
    data: historicalRequests,
    isLoading: isLoadingHistorical,
    isFetching: isFetchingHistorical,
  } = useQuery({
    queryKey: ['requests', tab, displayLimitHistorical],
    queryFn: () => api.getRequests({
      status: tab === 'all' ? undefined : tab,
      limit: displayLimitHistorical,
    }),
    enabled: isHistoricalTab,
    placeholderData: keepPreviousData,
    staleTime: 30000,
    refetchInterval: isHistoricalTab ? 30000 : false,
  });

  // 5. Preload historical lists lazily in the background with low priority after initial pending load finishes
  useEffect(() => {
    if (initialPendingRequests && !isFetchingInitialPending) {
      const timer = setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: ['requests', 'approved', 25],
          queryFn: () => api.getRequests({ status: 'approved', limit: 25 }),
          staleTime: 30000,
        });
        void queryClient.prefetchQuery({
          queryKey: ['requests', 'rejected', 25],
          queryFn: () => api.getRequests({ status: 'rejected', limit: 25 }),
          staleTime: 30000,
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [initialPendingRequests, isFetchingInitialPending, queryClient]);

  // Combined requests list based on active tab
  const pendingRequestsList = fullPendingRequests ?? initialPendingRequests ?? [];
  const requestsList = tab === 'pending'
    ? pendingRequestsList
    : (historicalRequests ?? []);

  // Track if progressive pending fetch is actively in flight
  const isProgressiveLoadingPending =
    tab === 'pending' &&
    isFetchingMorePending &&
    Boolean(initialPendingRequests || fullPendingRequests);

  // Full-page loading only occurs if initial 10 pending requests haven't arrived yet
  const isInitialLoading = tab === 'pending'
    ? (isLoadingInitialPending && !initialPendingRequests && !fullPendingRequests)
    : (isLoadingHistorical && !historicalRequests);

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

  const pendingFiltered = filtered.filter(r => r.status === 'pending');
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(r => selectedIds.has(r.id));

  const toggleSelect = (id: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map(r => r.id)));
    }
  };

  // Bulk Accept Mutation with Optimistic UI
  const bulkAcceptMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkReviewRequests(ids, 'approve'),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });

      setProcessingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });

      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const idSet = new Set(ids);
        const mapped = old.map((r: AttendanceRequest) =>
          (idSet.has(r.id) || idSet.has(r.requestId))
            ? { ...r, status: 'approved' as const, finalDecisionBy: 'Faculty', finalDecisionName: 'You' }
            : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });

      return { ids };
    },
    onError: (err: Error) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      showToast(err.message || 'Failed to approve requests', true);
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      showToast(`Successfully approved ${data.count} request(s)!`);
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
    },
    onSettled: (_, __, ids) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    },
  });

  // Bulk Reject Mutation with Optimistic UI
  const bulkRejectMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkReviewRequests(ids, 'reject', 'Rejected by Faculty (Bulk)'),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });

      setProcessingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });

      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const idSet = new Set(ids);
        const mapped = old.map((r: AttendanceRequest) =>
          (idSet.has(r.id) || idSet.has(r.requestId))
            ? { ...r, status: 'rejected' as const, finalDecisionBy: 'Faculty', finalDecisionName: 'You' }
            : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });

      return { ids };
    },
    onError: (err: Error) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      showToast(err.message || 'Failed to reject requests', true);
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      showToast(`Rejected ${data.count} request(s).`, true);
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
    },
    onSettled: (_, __, ids) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    },
  });

  // Single Quick Accept Mutation with 0ms Optimistic UI & Row-Level Concurrency
  const quickAcceptMutation = useMutation({
    mutationFn: (id: string) => api.reviewRequest(id, 'approve'),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });

      setProcessingIds(prev => new Set(prev).add(id));

      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const mapped = old.map((r: AttendanceRequest) =>
          (r.id === id || r.requestId === id)
            ? { ...r, status: 'approved' as const, finalDecisionBy: 'Faculty', finalDecisionName: 'You' }
            : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });

      return { id };
    },
    onError: (err: Error) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      showToast(err.message || 'Failed to approve request', true);
    },
    onSuccess: (updated, id) => {
      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const mapped = old.map((r: AttendanceRequest) =>
          (r.id === updated.id || r.requestId === updated.id) ? { ...r, ...updated } : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast(`Approved request for ${updated.student?.name || 'student'}!`);
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
    },
    onSettled: (_, __, id) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // Single Quick Reject Mutation with 0ms Optimistic UI & Row-Level Concurrency
  const quickRejectMutation = useMutation({
    mutationFn: (id: string) => api.reviewRequest(id, 'reject', 'Rejected by Faculty'),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['requests'] });

      setProcessingIds(prev => new Set(prev).add(id));

      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const mapped = old.map((r: AttendanceRequest) =>
          (r.id === id || r.requestId === id)
            ? { ...r, status: 'rejected' as const, finalDecisionBy: 'Faculty', finalDecisionName: 'You' }
            : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });

      return { id };
    },
    onError: (err: Error) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      showToast(err.message || 'Failed to reject request', true);
    },
    onSuccess: (updated, id) => {
      queryClient.setQueriesData({ queryKey: ['requests'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const mapped = old.map((r: AttendanceRequest) =>
          (r.id === updated.id || r.requestId === updated.id) ? { ...r, ...updated } : r
        );
        (mapped as any).total = (old as any).total;
        (mapped as any).hasMore = (old as any).hasMore;
        return mapped;
      });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast(`Rejected request for ${updated.student?.name || 'student'}.`, true);
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['requests-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['public-approved-requests-for-attendance'] });
    },
    onSettled: (_, __, id) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const handleBulkAccept = () => {
    if (selectedIds.size === 0) return;
    bulkAcceptMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    bulkRejectMutation.mutate(Array.from(selectedIds));
  };

  return (
    <PageWrapper role="faculty" showGreeting={false}>
      <div className="w-full max-w-[1400px] mx-auto pb-24 px-2 sm:px-4">

        {/* Toast Alert */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-white text-[13px] font-bold ${
                toastMsg.isError ? 'bg-rose-600' : 'bg-orange-500 shadow-orange-500/20'
              }`}
            >
              {toastMsg.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{toastMsg.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11.5px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Faculty Portal</p>
            <h1 className="text-[24px] font-heading font-bold text-slate-900">Student Requests</h1>
            <p className="text-[13px] text-slate-400">Review and action student attendance permission requests</p>
          </div>

          {/* Quick Select All Pending button if pending requests exist */}
          {pendingFiltered.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllPending}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                allPendingSelected
                  ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-subtle'
              }`}
            >
              <CheckCheck size={14} className={allPendingSelected ? 'text-orange-600' : 'text-slate-400'} />
              <span>{allPendingSelected ? 'Deselect All Pending' : `Select All Pending (${pendingFiltered.length})`}</span>
            </button>
          )}
        </motion.div>

        {/* ── Controls ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 }}
          className="mb-4"
        >
          {/* Search + Department Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="Search by student, reason, or roll no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-[13.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/12 transition-all shadow-subtle"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:flex-initial">
                <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <select
                  value={department}
                  onChange={e => setDept(e.target.value)}
                  className="w-full sm:w-auto h-[38px] pl-8 pr-4 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 appearance-none cursor-pointer text-slate-700 min-w-[130px] shadow-subtle font-medium"
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
                className="h-[38px] px-3 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 cursor-pointer text-slate-700 shadow-subtle font-medium"
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
                className="h-[38px] px-3 text-[12.5px] bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 cursor-pointer text-slate-700 shadow-subtle font-medium"
              >
                <option value="pending">Pending ({summaryData?.stats.pending ?? pendingRequestsList.length})</option>
                <option value="all">All Statuses ({summaryData?.stats.total ?? (tab === 'all' ? requestsList.length : '…')})</option>
                <option value="approved">Approved ({summaryData?.stats.approved ?? (tab === 'approved' ? requestsList.length : '…')})</option>
                <option value="rejected">Rejected ({summaryData?.stats.rejected ?? (tab === 'rejected' ? requestsList.length : '…')})</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* ── Requests List ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14 }}
        >
          {isInitialLoading ? (
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
                <Button variant="secondary" onClick={() => { setSearch(''); setDept(''); setTab('pending'); }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {/* Progressive Loading State Banner */}
              {isProgressiveLoadingPending && (
                <div className="mb-3 px-3.5 py-2.5 bg-orange-50/90 border border-orange-200/80 rounded-xl flex items-center justify-between text-xs text-orange-700 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-orange-500 shrink-0" />
                    <span className="font-bold">Loading more requests…</span>
                  </div>
                  <span className="text-[11.5px] text-orange-600/90 font-medium hidden sm:inline">
                    Fetching remaining pending requests progressively in background
                  </span>
                </div>
              )}

              <div className="card overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xs">

              {/* Desktop Minimal Expanded Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allPendingSelected && pendingFiltered.length > 0}
                          onChange={toggleSelectAllPending}
                          disabled={pendingFiltered.length === 0}
                          className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
                          title={allPendingSelected ? 'Deselect all pending' : 'Select all pending'}
                        />
                      </th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-3 py-3">Roll No</th>
                      <th className="px-3 py-3">Branch &amp; Year</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-3 py-3 text-center">Proof</th>
                      <th className="px-4 py-3">Date &amp; Periods</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <motion.tbody variants={listVariants} initial="hidden" animate="visible">
                    {filtered.map(req => {
                      const proofDocName = req.documentName || null;
                      const isSelected = selectedIds.has(req.id);
                      const isPending = req.status === 'pending';

                      return (
                        <motion.tr
                          key={req.id}
                          variants={itemVariants}
                          onClick={() => {
                            if (selectedIds.size > 0) {
                              toggleSelect(req.id);
                            } else {
                              navigate(`/faculty/request/${req.id}`);
                            }
                          }}
                          className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${
                            isSelected ? 'bg-orange-50/70 hover:bg-orange-50/90' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td
                            className="w-10 px-4 py-3 text-center"
                            onClick={e => {
                              e.stopPropagation();
                              toggleSelect(req.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 pointer-events-none"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={req.student?.name || 'S'} src={req.student?.avatarUrl} size="sm" role="student" />
                              <span className="text-[13px] font-semibold text-slate-800 truncate max-w-[180px]">{req.student?.name}</span>
                              <VerifiedActivityBadge student={req.student} />
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-[12.5px] font-mono text-slate-500">{req.student?.rollNumber}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-orange-50 text-orange-700 border border-orange-200/80">
                                {req.student?.department || 'CSIT'}
                              </span>
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                {req.student?.year || (req.student?.semester ? `${Math.ceil(req.student.semester / 2)}${Math.ceil(req.student.semester / 2) === 1 ? 'st' : Math.ceil(req.student.semester / 2) === 2 ? 'nd' : Math.ceil(req.student.semester / 2) === 3 ? 'rd' : 'th'} Yr` : '3rd Yr')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[13px] text-slate-700 font-medium">{req.reasonLabel}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {proofDocName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-lg">
                                <Paperclip size={11} className="text-orange-500" />
                                Proof
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-300 font-medium">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3">
                            <StatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} finalDecisionName={req.finalDecisionName} />
                            {req.status === 'approved' && (req.finalDecisionName || req.faculty?.name) && (
                              <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                                Approved by: <span className="font-semibold text-slate-800">{req.finalDecisionName || req.faculty?.name}</span>
                              </p>
                            )}
                          </td>

                          {/* Quick Row Actions */}
                          <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={processingIds.has(req.id)}
                                  onClick={() => quickAcceptMutation.mutate(req.id)}
                                  title="Accept Request"
                                  className="w-7 h-7 bg-orange-500/15 hover:bg-orange-500 active:scale-90 text-orange-600 hover:text-white border border-orange-400/40 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  {processingIds.has(req.id) ? (
                                    <Loader2 size={13} className="animate-spin text-orange-500" />
                                  ) : (
                                    <Check size={13} className="stroke-[3.5]" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={processingIds.has(req.id)}
                                  onClick={() => quickRejectMutation.mutate(req.id)}
                                  title="Reject Request"
                                  className="w-7 h-7 bg-rose-500/15 hover:bg-rose-500 active:scale-90 text-rose-600 hover:text-white border border-rose-400/40 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  {processingIds.has(req.id) ? (
                                    <Loader2 size={13} className="animate-spin text-rose-500" />
                                  ) : (
                                    <X size={13} className="stroke-[3.5]" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300 font-medium">—</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {/* Mobile Bulk Select Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-orange-50/60 border-b border-orange-100/80 text-xs font-bold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allPendingSelected && pendingFiltered.length > 0}
                      onChange={toggleSelectAllPending}
                      disabled={pendingFiltered.length === 0}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
                    />
                    <span>Select All Pending ({pendingFiltered.length})</span>
                  </label>
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-orange-600 font-extrabold hover:text-orange-700 active:underline text-[11.5px]"
                    >
                      Clear ({selectedIds.size})
                    </button>
                  )}
                </div>

                <motion.div variants={listVariants} initial="hidden" animate="visible">
                  {filtered.map(req => {
                    const proofDocName = req.documentName || null;
                    const isSelected = selectedIds.has(req.id);
                    const isPending = req.status === 'pending';

                    return (
                      <motion.div
                        key={req.id}
                        variants={itemVariants}
                        onClick={() => {
                          if (selectedIds.size > 0) {
                            toggleSelect(req.id);
                          } else {
                            navigate(`/faculty/request/${req.id}`);
                          }
                        }}
                        className={`p-3.5 cursor-pointer transition-all flex flex-col gap-2.5 ${
                          isSelected
                            ? 'bg-orange-50/90 ring-1 ring-orange-300'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Name, Roll No & Actions Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              onClick={e => {
                                e.stopPropagation();
                                toggleSelect(req.id);
                              }}
                              className="p-2 -m-2 flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 pointer-events-none"
                              />
                            </div>
                            <Avatar name={req.student?.name || 'S'} src={req.student?.avatarUrl} size="sm" role="student" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[13.5px] font-bold text-slate-800 leading-tight truncate">{req.student?.name}</p>
                                <VerifiedActivityBadge student={req.student} />
                              </div>
                              <p className="text-[11px] font-mono text-slate-400 mt-0.5">{req.student?.rollNumber}</p>
                            </div>
                          </div>

                          {/* Right Side: Simple Transparent Orange Rounded Thick Mark and Wrong Mark or Status Badge */}
                          <div className="shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {isPending ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={processingIds.has(req.id)}
                                  onClick={() => quickAcceptMutation.mutate(req.id)}
                                  className="w-8 h-8 bg-orange-500/15 hover:bg-orange-500 active:scale-90 text-orange-600 hover:text-white border border-orange-400/40 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                  title="Accept Request"
                                >
                                  {processingIds.has(req.id) ? (
                                    <Loader2 size={15} className="animate-spin text-orange-500" />
                                  ) : (
                                    <Check size={16} className="stroke-[3.5]" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={processingIds.has(req.id)}
                                  onClick={() => quickRejectMutation.mutate(req.id)}
                                  className="w-8 h-8 bg-rose-500/15 hover:bg-rose-500 active:scale-90 text-rose-600 hover:text-white border border-rose-400/40 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                  title="Reject Request"
                                >
                                  {processingIds.has(req.id) ? (
                                    <Loader2 size={15} className="animate-spin text-rose-500" />
                                  ) : (
                                    <X size={16} className="stroke-[3.5]" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <StatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} finalDecisionName={req.finalDecisionName} />
                            )}
                          </div>
                        </div>

                        {/* Reason, Days, Proof & Periods Row */}
                        <div className="flex items-center justify-between text-[11.5px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="font-semibold text-slate-700 truncate max-w-[130px]">{req.reasonLabel}</span>
                            {proofDocName && (
                              <span className="flex items-center gap-1 text-[9.5px] font-bold text-orange-600 bg-orange-100/70 px-1.5 py-0.5 rounded-md shrink-0">
                                <Paperclip size={9} />
                                Proof
                              </span>
                            )}
                            {/* Small Perfect Static Circles for Periods */}
                            {req.periods && (
                              <div className="inline-flex items-center gap-1 shrink-0">
                                {req.periods
                                  .split(/[, ]+/)
                                  .filter(Boolean)
                                  .map((p, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        minWidth: '18px',
                                        minHeight: '18px',
                                        maxWidth: '18px',
                                        maxHeight: '18px',
                                        borderRadius: '50%',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        lineHeight: 1,
                                        fontSize: '9.5px',
                                      }}
                                      className={`font-bold font-mono transition-all ${
                                        req.status === 'approved'
                                          ? 'bg-orange-500 text-white shadow-xs'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                      title={`Period ${p}${req.status === 'approved' ? ' (Approved)' : ''}`}
                                    >
                                      {p}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 shrink-0 text-[11px]">
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
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>

              {/* Progressive Loading indicator in table/card footer */}
              {isProgressiveLoadingPending && (
                <div className="py-3 px-4 bg-orange-50/50 border-t border-orange-100/80 flex items-center justify-center gap-2 text-[12.5px] text-orange-600 font-semibold">
                  <Loader2 size={13} className="animate-spin text-orange-500" />
                  <span>Loading more requests…</span>
                </div>
              )}

              {/* ── Load More Controls ── */}
              {!isProgressiveLoadingPending && (requestsList.hasMore || filtered.length < (requestsList.total || 0)) && (
                <div className="py-3.5 px-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-slate-400 font-medium">
                    Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
                    <span className="font-semibold text-slate-700">{requestsList.total || requestsList.length}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (tab === 'pending') {
                        setDisplayLimitPending(prev => prev + 25);
                      } else {
                        setDisplayLimitHistorical(prev => prev + 25);
                      }
                    }}
                    disabled={tab === 'pending' ? isFetchingMorePending : isFetchingHistorical}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-[12px] font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {(tab === 'pending' ? isFetchingMorePending : isFetchingHistorical) && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    <span>Load more</span>
                  </button>
                </div>
              )}

            </div>
          </>
          )}
        </motion.div>

        {/* ── Minimal Floating Batch Action Pill (White & Transparent Orange Theme) ── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <div className="fixed bottom-20 sm:bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: '1px solid rgba(254, 215, 170, 0.85)',
                  boxShadow: '0 20px 40px -12px rgba(249, 115, 22, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.9) inset',
                }}
                className="pointer-events-auto pl-3.5 pr-2 py-1.5 rounded-full flex items-center gap-2.5 shadow-2xl"
              >
                <div className="flex items-center gap-1.5 px-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                  <span className="text-xs font-black text-slate-800 tracking-tight whitespace-nowrap">
                    {selectedIds.size} Selected
                  </span>
                </div>

                <div className="h-4 w-px bg-orange-200/80 shrink-0" />

                <div className="flex items-center gap-2">
                  {/* Simple Transparent Orange Thick Check Mark Rounded (Multiple Accept) */}
                  <button
                    type="button"
                    disabled={bulkAcceptMutation.isPending || bulkRejectMutation.isPending}
                    onClick={handleBulkAccept}
                    className="w-8 h-8 rounded-full bg-orange-500/15 hover:bg-orange-500 active:scale-90 text-orange-600 hover:text-white border border-orange-400/40 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs"
                    title={`Accept all ${selectedIds.size} selected requests`}
                  >
                    {bulkAcceptMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={16} className="stroke-[3.5]" />
                    )}
                  </button>

                  {/* Simple Transparent Wrong Mark Rounded (Multiple Reject) */}
                  <button
                    type="button"
                    disabled={bulkAcceptMutation.isPending || bulkRejectMutation.isPending}
                    onClick={handleBulkReject}
                    className="w-8 h-8 rounded-full bg-rose-500/15 hover:bg-rose-500 active:scale-90 text-rose-600 hover:text-white border border-rose-400/40 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs"
                    title={`Reject all ${selectedIds.size} selected requests`}
                  >
                    {bulkRejectMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <X size={16} className="stroke-[3.5]" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="w-6 h-6 rounded-full bg-orange-50/80 hover:bg-orange-100/90 text-orange-600/80 hover:text-orange-700 flex items-center justify-center transition-colors cursor-pointer border border-orange-200/50 shrink-0 ml-0.5"
                  title="Clear selection"
                >
                  <X size={13} className="stroke-[2.5]" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </PageWrapper>
  );
}
