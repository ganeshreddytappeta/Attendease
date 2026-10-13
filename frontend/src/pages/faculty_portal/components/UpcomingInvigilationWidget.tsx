import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CalendarCheck, Clock, ArrowRight,
  AlertCircle, RotateCcw, Loader2, CheckCircle2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../../lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatISTDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year!, month! - 1, day!));
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Exam Type Badge
function ExamTypeBadge({ type }: { type: api.ExamType }) {
  const styles: Record<api.ExamType, { label: string; bg: string; text: string; border: string }> = {
    MID:           { label: 'MID EXAM',     bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
    SEM:           { label: 'SEMESTER',     bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
    LAB:           { label: 'LAB EXAM',     bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    SUPPLEMENTARY: { label: 'SUPPLEMENTARY',bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  };
  const style = styles[type] || { label: type, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wider uppercase border ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  );
}

// Session Badge
function SessionBadge({ session }: { session: api.SessionType }) {
  const styles: Record<api.SessionType, { label: string; bg: string; text: string }> = {
    MORNING:   { label: 'Morning',   bg: 'bg-amber-50',  text: 'text-amber-800' },
    AFTERNOON: { label: 'Afternoon', bg: 'bg-orange-50', text: 'text-orange-800' },
  };
  const style = styles[session] || { label: session, bg: 'bg-slate-50', text: 'text-slate-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium ${style.bg} ${style.text}`}>
      <span>{style.label}</span>
    </span>
  );
}

// ── Widget ─────────────────────────────────────────────────────────────────────

export function UpcomingInvigilationWidget() {
  // Local timer for urgency badge refresh
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['faculty-invigilation-duties'],
    queryFn: () => api.getMyInvigilationDuties(),
    staleTime: 60000,
  });

  const rawDuties = data?.duties || [];

  // Enrich duties with derived fields for urgency display
  const processedDuties = useMemo(() => {
    const todayStr = todayIST();

    return rawDuties.map((duty) => {
      const isToday = duty.date === todayStr;

      // Calculate days until duty
      const [dy, dm, dd] = duty.date.split('-').map(Number);
      const dutyDate = new Date(Date.UTC(dy!, dm! - 1, dd!));
      const nowDate = new Date();
      // Reset to IST midnight for comparison
      const nowIST = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(nowDate);
      const [ty, tm, td] = nowIST.split('-').map(Number);
      const todayUTC = new Date(Date.UTC(ty!, tm! - 1, td!));
      const diffDays = Math.round((dutyDate.getTime() - todayUTC.getTime()) / 86400000);

      return { ...duty, isToday, diffDays };
    }).sort((a, b) => {
      // Sort: today first, then by date, then by session (MORNING < AFTERNOON)
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const sessionOrder = { MORNING: 0, AFTERNOON: 1 };
      return (sessionOrder[a.session] ?? 0) - (sessionOrder[b.session] ?? 0);
    });
  }, [rawDuties, now]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="mb-6 sm:mb-8"
    >
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#EA580C] border border-orange-100 flex items-center justify-center shrink-0">
              <CalendarCheck size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Upcoming Invigilation Duties</span>
                {processedDuties.length > 0 && (
                  <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.2 rounded-full">
                    {processedDuties.length} {processedDuties.length === 1 ? 'duty' : 'duties'}
                  </span>
                )}
              </h2>
              <p className="text-[11.5px] text-slate-400 font-medium">
                Assigned exam duties — next 3 days (Asia/Kolkata)
              </p>
            </div>
          </div>

          {isFetching && !isLoading && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Loader2 size={12} className="animate-spin text-orange-500" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="py-6 flex flex-col items-center justify-center gap-2.5 bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-xs">
            <Loader2 size={20} className="animate-spin text-[#EA580C]" />
            <span>Loading assigned invigilation duties...</span>
          </div>
        )}

        {/* ── Error ── */}
        {isError && !isLoading && (
          <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-red-800 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>
                {error instanceof Error ? error.message : 'Unable to load invigilation duties.'}
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 font-semibold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw size={11} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && !isError && processedDuties.length === 0 && (
          <div className="py-5 px-4 bg-slate-50/60 rounded-xl border border-slate-200/60 flex items-center justify-center gap-2.5 text-center">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span className="text-[13px] font-medium text-slate-600">
              No upcoming invigilation duties in the next 3 days
            </span>
          </div>
        )}

        {/* ── Duty Cards ── */}
        {!isLoading && !isError && processedDuties.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence>
              {processedDuties.map((duty) => {
                // Urgency: today = red, tomorrow = amber, beyond = slate
                let borderAccent = 'border-l-slate-300';
                let urgencyLabel: React.ReactNode = null;

                if (duty.isToday) {
                  borderAccent = 'border-l-rose-500';
                  urgencyLabel = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>Today</span>
                    </span>
                  );
                } else if (duty.diffDays === 1) {
                  borderAccent = 'border-l-amber-400';
                  urgencyLabel = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock size={11} />
                      <span>Tomorrow</span>
                    </span>
                  );
                } else {
                  borderAccent = 'border-l-emerald-400';
                  urgencyLabel = (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <Clock size={11} />
                      <span>In {duty.diffDays} days</span>
                    </span>
                  );
                }

                return (
                  <motion.div
                    key={duty.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 rounded-xl border border-slate-200/90 border-l-[4.5px] ${borderAccent} bg-white shadow-2xs hover:border-slate-300 transition-all`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      {/* Left: badges + date */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ExamTypeBadge type={duty.examType} />
                          <SessionBadge session={duty.session} />
                        </div>

                        <div className="text-[14px] font-bold text-slate-900">
                          {formatISTDate(duty.date)}
                        </div>

                        {/* Time if provided */}
                        {(duty.startTime || duty.endTime) && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
                            <Clock size={13} className="text-slate-400 shrink-0" />
                            <span>
                              {duty.startTime && duty.endTime
                                ? `${duty.startTime} – ${duty.endTime}`
                                : duty.startTime
                                ? `From ${duty.startTime}`
                                : `Until ${duty.endTime}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: urgency badge */}
                      <div className="shrink-0 self-start">
                        {urgencyLabel}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[12px] text-slate-400">View semester-wide schedule & duty hours</span>
          <Link
            to="/faculty/invigilation"
            className="text-[12px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
          >
            <span>Full Invigilations Schedule</span>
            <ArrowRight size={13} />
          </Link>
        </div>

      </div>
    </motion.div>
  );
}
