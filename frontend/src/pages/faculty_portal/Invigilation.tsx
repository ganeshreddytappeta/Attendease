import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Search, RefreshCw,
  AlertCircle, CheckCircle2, FileSpreadsheet, Users
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { EmptyState } from '../../components/shared/EmptyState';
import * as api from '../../lib/api';
import ExcelJS from 'exceljs';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatISTDate(dateStr: string): string {
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

function parseDateParts(dateStr: string): { day: string; month: string; weekday: string } {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year!, month! - 1, day!));
    const dayStr = String(day).padStart(2, '0');
    const monthStr = d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const weekdayStr = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
    return { day: dayStr, month: monthStr, weekday: weekdayStr };
  } catch {
    return { day: '--', month: '---', weekday: '---' };
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
  const styles: Record<api.SessionType, { label: string; bg: string; text: string; border: string }> = {
    MORNING:   { label: 'Morning (09:30 AM)',   bg: 'bg-amber-50',  text: 'text-amber-800', border: 'border-amber-200' },
    AFTERNOON: { label: 'Afternoon (01:30 PM)', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  };
  const style = styles[session] || { label: session, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  );
}

export default function FacultyInvigilation() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch all invigilation duties for logged-in faculty
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['faculty-invigilation-all'],
    queryFn: () => api.getMyInvigilationDuties({ all: true }),
    staleTime: 60000,
  });

  const rawDuties = data?.duties || [];
  const todayStr = todayIST();

  // Process duties
  const processedDuties = useMemo(() => {
    return rawDuties.map((duty) => {
      const isToday = duty.date === todayStr;
      const isPast = duty.date < todayStr;
      const status: 'UPCOMING' | 'COMPLETED' = isPast ? 'COMPLETED' : 'UPCOMING';

      const [dy, dm, dd] = duty.date.split('-').map(Number);
      const dutyDate = new Date(Date.UTC(dy!, dm! - 1, dd!));
      const [ty, tm, td] = todayStr.split('-').map(Number);
      const todayUTC = new Date(Date.UTC(ty!, tm! - 1, td!));
      const diffDays = Math.round((dutyDate.getTime() - todayUTC.getTime()) / 86400000);

      return {
        ...duty,
        status,
        isToday,
        isPast,
        diffDays,
      };
    }).sort((a, b) => {
      if (a.isPast && !b.isPast) return 1;
      if (!a.isPast && b.isPast) return -1;
      if (a.date !== b.date) {
        return a.isPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      }
      const sessionOrder = { MORNING: 0, AFTERNOON: 1 };
      return (sessionOrder[a.session] ?? 0) - (sessionOrder[b.session] ?? 0);
    });
  }, [rawDuties, todayStr]);

  // Statistics
  const stats = useMemo(() => {
    const total = processedDuties.length;
    const upcoming = processedDuties.filter(d => !d.isPast).length;
    const today = processedDuties.filter(d => d.isToday).length;
    const completed = processedDuties.filter(d => d.isPast).length;
    const estimatedHours = total * 3;

    return { total, upcoming, today, completed, estimatedHours };
  }, [processedDuties]);

  // Filtered list
  const filteredDuties = useMemo(() => {
    return processedDuties.filter((duty) => {
      if (activeTab === 'upcoming' && duty.isPast) return false;
      if (activeTab === 'completed' && !duty.isPast) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const dateMatch = duty.date.includes(q) || formatISTDate(duty.date).toLowerCase().includes(q);
        const typeMatch = duty.examType.toLowerCase().includes(q);
        const sessionMatch = duty.session.toLowerCase().includes(q);
        const coMatch = duty.coInvigilators?.some(c => c.name.toLowerCase().includes(q));
        if (!dateMatch && !typeMatch && !sessionMatch && !coMatch) return false;
      }

      return true;
    });
  }, [processedDuties, activeTab, search]);

  // Excel Export
  const handleExportExcel = async () => {
    if (processedDuties.length === 0) return;
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AttendEase Exam Cell';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Invigilation Duties');

      worksheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Day', key: 'day', width: 14 },
        { header: 'Exam Type', key: 'examType', width: 16 },
        { header: 'Session', key: 'session', width: 16 },
        { header: 'Time Slot', key: 'timeSlot', width: 22 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Co-Invigilators', key: 'coInvigilators', width: 35 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEA580C' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      processedDuties.forEach((d, idx) => {
        const parts = parseDateParts(d.date);
        const timeSlot = d.startTime && d.endTime
          ? `${d.startTime} - ${d.endTime}`
          : d.session === 'MORNING'
          ? '09:30 AM - 12:30 PM'
          : '01:30 PM - 04:30 PM';

        const coList = d.coInvigilators && d.coInvigilators.length > 0
          ? d.coInvigilators.map(c => `${c.name} (${c.department || 'Faculty'})`).join(', ')
          : 'Solo';

        worksheet.addRow({
          sno: idx + 1,
          date: d.date,
          day: parts.weekday,
          examType: d.examType,
          session: d.session === 'MORNING' ? 'Morning' : 'Afternoon',
          timeSlot,
          status: d.isToday ? 'TODAY' : d.isPast ? 'COMPLETED' : 'UPCOMING',
          coInvigilators: coList,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Invigilation_Schedule_${todayStr}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export invigilation schedule:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageWrapper role="faculty">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Clean & Minimal Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Invigilation Duties
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Examination schedules, assigned sessions, and reporting time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              title="Sync with server"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin text-orange-600' : 'text-slate-400'} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || processedDuties.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[12px] font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* ── Minimal KPI Row ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs">
            <span className="text-[11.5px] font-medium text-slate-500 block">Upcoming</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold text-orange-600">{stats.upcoming}</span>
              <span className="text-[11px] text-slate-400">duties</span>
            </div>
          </div>

          <div className={`rounded-xl p-3.5 sm:p-4 border shadow-2xs transition-colors ${
            stats.today > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200/80'
          }`}>
            <span className={`text-[11.5px] font-medium block ${stats.today > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              Today
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl sm:text-2xl font-bold ${stats.today > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {stats.today}
              </span>
              <span className={`text-[11px] ${stats.today > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                {stats.today > 0 ? 'active today' : 'scheduled'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs">
            <span className="text-[11.5px] font-medium text-slate-500 block">Total Logged</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">~{stats.estimatedHours}</span>
              <span className="text-[11px] text-slate-400">hrs</span>
            </div>
          </div>
        </div>

        {/* ── Clean Tabs & Search ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg self-start">
            {[
              { id: 'all', label: 'All', count: stats.total },
              { id: 'upcoming', label: 'Upcoming', count: stats.upcoming },
              { id: 'completed', label: 'Completed', count: stats.completed },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10.5px] text-slate-400">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="relative sm:w-60">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search duties..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="bg-white rounded-xl p-10 text-center border border-slate-200/80 shadow-2xs">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-[13px] font-medium text-slate-600">Loading invigilation duties...</p>
          </div>
        ) : isError ? (
          <div className="bg-white rounded-xl p-8 text-center border border-rose-200 shadow-2xs">
            <AlertCircle size={30} className="text-rose-500 mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-slate-800">Failed to load schedule</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 bg-orange-600 text-white text-[12px] font-medium rounded-lg hover:bg-orange-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredDuties.length === 0 ? (
          <EmptyState
            title="No duties found"
            description={
              search || activeTab !== 'all'
                ? 'No invigilation duties match your current filter.'
                : 'No invigilation duties assigned at this time.'
            }
            action={
              (search || activeTab !== 'all') ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setActiveTab('all');
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11.5px] font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Clear filter
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {filteredDuties.map((duty, idx) => {
                const parts = parseDateParts(duty.date);
                const timeSlot = duty.startTime && duty.endTime
                  ? `${duty.startTime} – ${duty.endTime}`
                  : duty.session === 'MORNING'
                  ? '09:30 AM – 12:30 PM'
                  : '01:30 PM – 04:30 PM';

                const reportingTime = duty.session === 'MORNING' ? 'Report by 09:00 AM' : 'Report by 01:00 PM';

                return (
                  <motion.div
                    key={duty.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: idx * 0.02 }}
                    className={`bg-white rounded-xl p-4 border transition-all shadow-2xs ${
                      duty.isToday
                        ? 'border-orange-300 ring-1 ring-orange-400/30'
                        : duty.isPast
                        ? 'border-slate-200/70 bg-slate-50/50'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Date & Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Date badge */}
                        <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center p-1 text-center shrink-0 border ${
                          duty.isToday
                            ? 'bg-orange-500 text-white border-orange-600'
                            : duty.isPast
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-orange-50 text-orange-900 border-orange-200/60'
                        }`}>
                          <span className="text-[9px] font-bold uppercase leading-none opacity-80">{parts.month}</span>
                          <span className="text-base font-extrabold leading-tight">{parts.day}</span>
                          <span className="text-[9px] font-medium leading-none opacity-80">{parts.weekday}</span>
                        </div>

                        {/* Title & timing */}
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-1">
                            <ExamTypeBadge type={duty.examType} />
                            <SessionBadge session={duty.session} />

                            {duty.isToday ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                TODAY
                              </span>
                            ) : duty.isPast ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-600" />
                                Completed
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-3 text-[12px] text-slate-600">
                            <span className="flex items-center gap-1 font-medium text-slate-800">
                              <Clock size={12} className="text-orange-500" />
                              {timeSlot}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 text-[11.5px]">{reportingTime}</span>
                          </div>

                          {/* Co-invigilators if present */}
                          {duty.coInvigilators && duty.coInvigilators.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                              <Users size={11} className="text-slate-400" />
                              <span>With:</span>
                              <span className="font-medium text-slate-700">
                                {duty.coInvigilators.map(c => c.name).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Hall indicator */}
                      <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <span className="text-[11px] text-slate-400 block">Exam Venue</span>
                        <span className="text-[12px] font-semibold text-slate-700">SRKR Examination Halls</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </div>
    </PageWrapper>
  );
}
