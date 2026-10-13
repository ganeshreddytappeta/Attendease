import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer, Calendar, RefreshCw, Info,
  ChevronDown, ChevronUp, LayoutGrid, List, CheckCircle2,
  GraduationCap, Building2, Copy, Check
} from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import * as api from '../lib/api';
import type { AttendanceRequest } from '../types';
import { formatTime, getPeriodsFromRequest } from '../lib/utils';
import { VerifiedActivityBadge } from '../components/shared/VerifiedActivityBadge';
import logo from '../assets/logo.png';

export interface ExtendedAttendanceRequest extends AttendanceRequest {
  sectionName?: string;
}

export const WhatsappIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.523-8.41" />
  </svg>
);

export const formatRollNumberForDisplay = (raw: string): string => {
  const str = raw.trim();
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return num < 10 ? `0${num}` : `${num}`;
  }
  return str;
};

export const sortRollNumbers = (rolls: string[]): string[] => {
  return [...rolls].sort((a, b) => {
    const isNumA = /^\d+$/.test(a);
    const isNumB = /^\d+$/.test(b);
    if (isNumA && isNumB) {
      return parseInt(a, 10) - parseInt(b, 10);
    }
    if (isNumA) return -1;
    if (isNumB) return 1;

    const isLeA = /^LE\d+$/i.test(a);
    const isLeB = /^LE\d+$/i.test(b);
    if (isLeA && isLeB) {
      const numA = parseInt(a.replace(/LE/i, ''), 10);
      const numB = parseInt(b.replace(/LE/i, ''), 10);
      return numA - numB;
    }
    if (isLeA) return 1;
    if (isLeB) return -1;

    return a.localeCompare(b, undefined, { numeric: true });
  });
};

export const getStudentPhoto = (pass: { student?: { avatarUrl?: string; rollNumber?: string; department?: string; name?: string }; studentId?: string }): string => {
  if (pass.student?.avatarUrl && (pass.student.avatarUrl.startsWith('http') || pass.student.avatarUrl.startsWith('data:'))) {
    return pass.student.avatarUrl;
  }
  const raw = (pass.student?.rollNumber || pass.studentId || '').trim().toUpperCase();
  if (!raw || raw.startsWith('STU-') || raw.startsWith('FAC-') || raw.startsWith('ADMIN-')) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(pass.student?.name || 'Student')}&background=0F172A&color=fff`;
  }
  if (raw.length >= 8 && /^[0-9]{2}[A-Z0-9]+$/i.test(raw)) {
    return `https://srkrexams.in/SRKR/photo/${raw}.jpg`;
  }
  const isLE = /^LE\d+$/i.test(raw);
  const dept = (pass.student?.department || '').includes('CSD') ? '62' : '07';
  if (isLE) {
    const num = raw.replace(/LE/i, '').padStart(2, '0');
    return `https://srkrexams.in/SRKR/photo/25B95A${dept}${num}.jpg`;
  }
  const clean = raw.padStart(2, '0');
  return `https://srkrexams.in/SRKR/photo/24B91A${dept}${clean}.jpg`;
};

export const PERIOD_TIMINGS: Record<number, { start: string; end: string }> = {
  1: { start: '09:00 AM', end: '09:45 AM' },
  2: { start: '09:45 AM', end: '10:30 AM' },
  3: { start: '10:30 AM', end: '11:15 AM' },
  4: { start: '11:15 AM', end: '12:00 PM' },
  5: { start: '01:30 PM', end: '02:15 PM' },
  6: { start: '02:15 PM', end: '03:00 PM' },
  7: { start: '03:00 PM', end: '03:45 PM' },
  8: { start: '03:45 PM', end: '04:30 PM' },
};

export const getFormattedDateString = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getFormattedTimeString = (selectedPeriods: number[]) => {
  if (selectedPeriods.length > 0) {
    const sorted = [...selectedPeriods].sort((a, b) => a - b);
    const minP = sorted[0];
    const maxP = sorted[sorted.length - 1];
    const startStr = PERIOD_TIMINGS[minP]?.start || '09:00 AM';
    const endStr = PERIOD_TIMINGS[maxP]?.end || '04:30 PM';
    const periodsLabel = sorted.map(p => `P${p}`).join(', ');
    return `${startStr} - ${endStr} (${periodsLabel})`;
  }

  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

export const getSectionRollNumbers = (sectionKey: string): string[] => {
  if (sectionKey.includes('CSIT') && sectionKey.includes('B')) {
    const list: string[] = [];
    // 73 to 99
    for (let i = 73; i <= 99; i++) list.push(String(i));
    // A0 to A9
    for (let i = 0; i <= 9; i++) list.push(`A${i}`);
    // B0 to B9
    for (let i = 0; i <= 9; i++) list.push(`B${i}`);
    // C0 to C9
    for (let i = 0; i <= 9; i++) list.push(`C${i}`);
    // D0 to D1
    list.push('D0', 'D1');
    // LE1 to LE13
    for (let i = 1; i <= 13; i++) list.push(`LE${i}`);
    return list;
  }

  // Default (Section A): 1 to 72
  return Array.from({ length: 72 }, (_, i) => String(i + 1));
};

export const extractRollSuffix = (rawRoll: string): string => {
  if (!rawRoll) return '';
  const str = rawRoll.trim().toUpperCase();

  // 1. Explicit LE prefix/infix (e.g. "24B91A07LE1", "24B91A07LE13")
  const leMatch = str.match(/LE0*([1-9]|[12][0-9]|30)$/i);
  if (leMatch) {
    return `LE${parseInt(leMatch[1], 10)}`;
  }

  // 2. Lateral Entry scheme: 95A code (e.g. "25B95A0701" -> "LE1", "25B95A0713" -> "LE13")
  if (str.includes('95A')) {
    const numMatch = str.match(/(\d{1,2})$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      if (num >= 1 && num <= 30) {
        return `LE${num}`;
      }
    }
  }

  // 3. Regular 91A scheme (e.g. "24B91A0773" -> "73", "24B91A07B7" -> "B7", "24B91A0705" -> "5")
  const suffixMatch = str.match(/([A-D][0-9]|[0-9]{1,2})$/i);
  if (suffixMatch) {
    const val = suffixMatch[1];
    if (/^\d+$/.test(val)) {
      return String(parseInt(val, 10));
    }
    return val;
  }
  return str;
};

export const parseSubmissionPeriods = (periods: any): number[] => {
  if (Array.isArray(periods)) {
    return periods.map(p => Number(p)).filter(p => !isNaN(p));
  }
  if (typeof periods === 'number') {
    return [periods];
  }
  if (typeof periods === 'string') {
    if (periods.includes(',')) {
      return periods.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));
    }
    if (periods.includes('-')) {
      const parts = periods.split('-');
      const start = Number(parts[0]);
      const end = Number(parts[1]);
      if (!isNaN(start) && !isNaN(end)) {
        const res: number[] = [];
        for (let i = start; i <= end; i++) res.push(i);
        return res;
      }
    }
    const single = Number(periods);
    if (!isNaN(single)) return [single];
  }
  return [];
};

export const isRequestOnDate = (req: ExtendedAttendanceRequest | AttendanceRequest, targetDate: string): boolean => {
  if (!req.date) return false;
  const start = req.date.trim().slice(0, 10);
  const end = req.endDate ? req.endDate.trim().slice(0, 10) : start;
  return targetDate >= start && targetDate <= end;
};

export const isLongPermission = (req?: ExtendedAttendanceRequest | AttendanceRequest | null): boolean => {
  if (!req || !req.endDate) return false;
  const start = req.date?.trim().slice(0, 10);
  const end = req.endDate.trim().slice(0, 10);
  return Boolean(start && end && start !== end);
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayFormattedDate = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── Reusable Memoized Roll Button Component ───────────────────────────────────
interface RollButtonProps {
  rollNo: string;
  student?: { name: string; rollNumber: string };
  request?: ExtendedAttendanceRequest;
  markedStatus?: 'present' | 'absent';
  isDbMarked?: boolean;
  markedByName?: string;
  onClick: () => void;
}

const RollButton = React.memo(({ rollNo, student, request, markedStatus, onClick }: RollButtonProps) => {
  const isPermission = Boolean(request);
  const isPresent = markedStatus === 'present' && !isPermission;
  const isAbsent = markedStatus === 'absent' && !isPermission;
  const isMultiDay = isLongPermission(request);

  // Priority: Permission Approved (Yellow) > Present (Green) > Absent (Red) > Unmarked (White)
  let bgColor = '#FFFFFF';
  let textColor = 'text-slate-800';
  let badgeStyle = 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/40';

  if (isPermission) {
    bgColor = '#FEF08A'; // Bright Soft Yellow (Yellow-200) — Approved Permission
    textColor = 'text-amber-950 font-black';
    badgeStyle = 'bg-yellow-200 border-yellow-400 text-amber-950 shadow-xs hover:bg-yellow-300 ring-2 ring-yellow-400/30 font-black';
  } else if (isPresent) {
    bgColor = '#A7F3D0'; // Bright Soft Emerald (Emerald-200)
    textColor = 'text-emerald-950 font-black';
    badgeStyle = 'bg-emerald-200 border-emerald-400 text-emerald-950 shadow-xs hover:bg-emerald-300 ring-2 ring-emerald-400/30 font-black';
  } else if (isAbsent) {
    bgColor = '#FECDD3'; // Bright Soft Rose (Rose-200)
    textColor = 'text-rose-950 font-black';
    badgeStyle = 'bg-rose-200 border-rose-400 text-rose-950 shadow-xs hover:bg-rose-300 ring-2 ring-rose-400/30 font-black';
  }

  const tooltipTitle = student?.name
    ? `${student.name} (${student.rollNumber}) — ${
        isPermission
          ? `Approved ${isMultiDay ? 'Multi-Day ' : ''}Permission (${request?.reasonLabel}) - Click to view slip`
          : isPresent
            ? 'Marked Present'
            : isAbsent
              ? 'Marked Absent'
              : 'Unmarked'
      }`
    : isPresent
      ? `Roll #${rollNo}: Marked Present${Boolean(request) ? ' (Has Approved Permission)' : ''}`
      : isAbsent
        ? `Roll #${rollNo}: Marked Absent${Boolean(request) ? ' (Has Approved Permission — marked absent by faculty)' : ''}`
        : isPermission
          ? `Roll #${rollNo}: Approved ${isMultiDay ? 'Multi-Day ' : ''}Permission (${request?.reasonLabel}${isMultiDay ? ` • ${request?.date} to ${request?.endDate}` : ''}) - Click to view slip`
          : `Roll #${rollNo}: Unmarked`;

  return (
    <motion.button
      layout
      initial={false}
      animate={{
        scale: isPermission || isPresent || isAbsent ? [1, 1.08, 1] : 1,
        backgroundColor: bgColor,
      }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      onClick={onClick}
      className={`
        w-[56px] h-[56px] sm:w-[60px] sm:h-[60px]
        rounded-xl sm:rounded-[14px]
        font-extrabold text-[13px] sm:text-[14px]
        flex flex-col items-center justify-center relative
        select-none cursor-pointer
        transition-all duration-150
        border shadow-2xs shrink-0
        active:scale-95 focus:outline-none
        ${badgeStyle}
        ${textColor}
      `}
      title={tooltipTitle}
    >
      {isMultiDay && (
        <span
          className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-purple-600 text-white text-[8px] font-black rounded-full shadow-xs border border-white leading-tight uppercase tracking-tighter"
          title={`Multi-Day Permission: ${request?.date} to ${request?.endDate}`}
        >
          MULTI
        </span>
      )}
      {rollNo}
    </motion.button>
  );
});

RollButton.displayName = 'RollButton';

// ── Permission & Attendance Grid Component per Section ────────────────────────
interface PermissionGridProps {
  sectionKey: string;
  selectedYear?: string;
  passes: ExtendedAttendanceRequest[];
  markedAttendance: Record<string, 'present' | 'absent'>;
  attendanceSubmissions: api.AttendanceSubmissionItem[];
  selectedSubmissionId: string;
  selectedPeriodFilters: number[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectPass: (pass: ExtendedAttendanceRequest) => void;
  onRollClick: (rollNo: string, pass?: ExtendedAttendanceRequest, isDbMarked?: boolean, markedByName?: string, dbStatus?: 'present' | 'absent') => void;
  onMarkAll: (sectionKey: string, status: 'present' | 'absent') => void;
  onOpenWhatsApp: (sectionKey: string) => void;
  viewMode: 'grid' | 'list';
  customRollNumbers?: string[];
  students?: api.PublicSectionItem['students'];
}

const PermissionGrid = React.memo(({
  sectionKey,
  selectedYear,
  passes,
  markedAttendance,
  attendanceSubmissions,
  selectedSubmissionId,
  selectedPeriodFilters,
  isCollapsed,
  onToggleCollapse,
  onSelectPass,
  onRollClick,
  onMarkAll,
  onOpenWhatsApp,
  viewMode,
  customRollNumbers,
  students,
}: PermissionGridProps) => {
  const rollNumbers = useMemo(() => {
    if (customRollNumbers && customRollNumbers.length > 0) {
      return customRollNumbers;
    }
    return getSectionRollNumbers(sectionKey);
  }, [customRollNumbers, sectionKey]);
  const totalStudents = rollNumbers.length;

  // Compute records map from faculty submissions for this section
  const hasSelectedPeriods = selectedPeriodFilters.length > 0 || (selectedSubmissionId !== 'combined' && Boolean(selectedSubmissionId));

  // Map of student database submission records for this section
  const submissionRecordsMap = useMemo(() => {
    const map: Record<string, { status: 'present' | 'absent'; markedByName?: string }> = {};

    // ONLY display attendance when periods are selected
    if (!hasSelectedPeriods) {
      return map;
    }

    let relevantSubmissions = (selectedSubmissionId === 'combined'
      ? attendanceSubmissions
      : attendanceSubmissions.filter(s => s.id === selectedSubmissionId)
    ).filter(sub => {
      // 1. Strict Academic Year isolation
      if (selectedYear && sub.year) {
        if (sub.year.trim().toLowerCase() !== selectedYear.trim().toLowerCase()) return false;
      }
      if (!sub.section) return true;
      const subSec = (sub.section || '').toUpperCase().replace(/[\s-]/g, '');
      const currentSec = sectionKey.toUpperCase().replace(/[\s-]/g, '');
      if (currentSec.includes('CSD')) return subSec.includes('CSD');
      if (currentSec.includes('CSIT')) {
        if (currentSec.includes('B') || currentSec.includes('SECB')) {
          return subSec.includes('B');
        }
        return !subSec.includes('B') || subSec.includes('A');
      }
      return subSec.includes(currentSec) || currentSec.includes(subSec);
    });

    if (selectedPeriodFilters.length > 0) {
      relevantSubmissions = relevantSubmissions.filter(sub => {
        const subPeriods = parseSubmissionPeriods(sub.periods);
        return selectedPeriodFilters.some(p => subPeriods.includes(p));
      });
    }

    relevantSubmissions.forEach(sub => {
      const submitterName = sub.markedBy?.name || 'Faculty';
      sub.records.forEach(rec => {
        const raw = rec.rollNumber;
        const suffix = extractRollSuffix(raw);
        const status = rec.status as 'present' | 'absent';

        map[raw] = { status, markedByName: submitterName };
        if (suffix) {
          map[suffix] = { status, markedByName: submitterName };
          const num = parseInt(suffix, 10);
          if (!isNaN(num)) {
            map[String(num)] = { status, markedByName: submitterName };
            map[String(num).padStart(2, '0')] = { status, markedByName: submitterName };
          }
        }
      });
    });
    return map;
  }, [attendanceSubmissions, selectedSubmissionId, selectedPeriodFilters, sectionKey, selectedYear, hasSelectedPeriods]);

  const permissionMap = useMemo(() => {
    const map = new Map<string, ExtendedAttendanceRequest>();

    // Parse active submission periods if a period-specific submission is selected
    const activeSub = selectedSubmissionId !== 'combined'
      ? attendanceSubmissions.find(s => s.id === selectedSubmissionId)
      : null;

    const activePeriodNums: number[] = selectedPeriodFilters.length > 0
      ? selectedPeriodFilters
      : (activeSub && activeSub.periods
        ? activeSub.periods.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
        : []);

    if (activePeriodNums.length === 0) {
      return map;
    }

    passes.forEach(p => {
      // Filter strictly by period if specific period(s) are selected
      const passPeriods = getPeriodsFromRequest(p);
      const hasOverlap = activePeriodNums.some(pNum => passPeriods.includes(pNum));
      if (!hasOverlap) return;

      const rollStr = (p.student?.rollNumber ?? p.studentId ?? '').trim();
      const upper = rollStr.toUpperCase();

      // Check if student belongs to section roster with an explicit displayRoll
      const studentObj = students?.find(st =>
        st.rollNumber.toUpperCase() === upper || st.userId.toUpperCase() === upper
      );

      if (studentObj && studentObj.displayRoll) {
        map.set(studentObj.displayRoll, p);
        map.set(studentObj.displayRoll.toUpperCase(), p);
      } else {
        const suffix = extractRollSuffix(rollStr);
        if (suffix) {
          if (rollNumbers.includes(suffix)) {
            map.set(suffix, p);
          } else {
            const matched = rollNumbers.find(r =>
              r === suffix ||
              parseInt(r, 10) === parseInt(suffix, 10) ||
              r.toUpperCase() === upper
            );
            if (matched) {
              map.set(matched, p);
            }
          }
        }
      }
    });
    return map;
  }, [passes, rollNumbers, selectedSubmissionId, attendanceSubmissions, selectedPeriodFilters, students]);

  const permissionCount = permissionMap.size;
  const longPermissionCount = useMemo(() => {
    return Array.from(permissionMap.values()).filter(isLongPermission).length;
  }, [permissionMap]);

  // Combine database submission records with in-memory overrides (when no submission exists)
  const combinedAttendance = useMemo(() => {
    if (!hasSelectedPeriods) {
      return {};
    }
    const map: Record<string, 'present' | 'absent'> = {};
    Object.entries(submissionRecordsMap).forEach(([k, v]) => {
      map[k] = v.status;
    });
    return { ...map, ...markedAttendance };
  }, [submissionRecordsMap, markedAttendance, hasSelectedPeriods]);

  const presentCount = useMemo(() => Object.values(combinedAttendance).filter(v => v === 'present').length, [combinedAttendance]);
  const absentCount = useMemo(() => Object.values(combinedAttendance).filter(v => v === 'absent').length, [combinedAttendance]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* ── Section Header ── */}
      <div
        onClick={onToggleCollapse}
        className="px-5 pt-5 pb-4 flex items-start justify-between cursor-pointer select-none"
      >
        <div className="flex-1 min-w-0">
          {/* Section name + pill */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-black text-[22px] text-slate-900 leading-none tracking-tight">{sectionKey}</span>
            <span className="text-[12px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              {permissionCount} Permission{permissionCount !== 1 ? 's' : ''}
            </span>
            {longPermissionCount > 0 && (
              <span className="text-[12px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                {longPermissionCount} Long
              </span>
            )}
          </div>
          {/* Class Strength */}
          <p className="text-[13px] text-slate-400 font-medium mt-1">
            Class Strength: {totalStudents}
          </p>
        </div>
        <div className="shrink-0 mt-1 ml-3">
          {isCollapsed
            ? <ChevronDown size={18} className="text-slate-400" />
            : <ChevronUp size={18} className="text-slate-400" />}
        </div>
      </div>

      {/* ── Expanded Content ── */}
      {!isCollapsed && (
        viewMode === 'grid' ? (
          <div>
            {/* Divider */}
            <div className="mx-5 border-t border-slate-100" />

            {/* ── 4-column stat row ── */}
            {hasSelectedPeriods && (
              <div className="grid grid-cols-4 divide-x divide-slate-100 px-5 py-4">
                {[
                  { dot: 'bg-yellow-400', label: 'Permission', count: permissionCount },
                  { dot: 'bg-emerald-500', label: 'Present',    count: presentCount },
                  { dot: 'bg-rose-400',   label: 'Absent',      count: absentCount },
                  { dot: 'bg-slate-300',  label: 'Unmarked',    count: Math.max(0, totalStudents - permissionCount - presentCount - absentCount) },
                ].map(({ dot, label, count }) => (
                  <div key={label} className="flex flex-col items-start px-4 first:pl-0 last:pr-0 gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot} inline-block shrink-0`} />
                      <span className="text-[12px] text-slate-500 font-medium">{label}</span>
                    </div>
                    <span className="text-[26px] font-black text-slate-900 leading-none">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Quick Mark ── */}
            <div className="px-5 pb-4">
              <p className="text-[12px] font-bold text-slate-800 uppercase tracking-wide mb-3">
                Quick Mark <span className="font-normal normal-case text-slate-400">(In-Memory Only)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onMarkAll(sectionKey, 'present')}
                  className="h-14 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl font-bold text-[13px] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-3"
                  title="Mark all regular students as Present (preserves permission slips)"
                >
                  <span className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-white" />
                  </span>
                  <span>Mark Everyone Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMarkAll(sectionKey, 'absent')}
                  className="h-14 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-2xl font-bold text-[13px] transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-3"
                  title="Mark all regular students as Absent (preserves permission slips)"
                >
                  <span className="w-8 h-8 rounded-full border-2 border-rose-500 flex items-center justify-center shrink-0">
                    <RefreshCw size={16} className="text-rose-600" />
                  </span>
                  <span>Mark Everyone Absent</span>
                </button>
              </div>
            </div>

            {/* Roll number grid */}
            <div className="px-5 pb-5">
              {rollNumbers.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-[12px] font-medium">
                  No registered students found for this section in the database.
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2.5 max-w-[680px] mx-auto">
                  {rollNumbers.map(numStr => {
                    const req = permissionMap.get(numStr);
                    const dbRecord = submissionRecordsMap[numStr];
                    const isDbMarked = Boolean(dbRecord);
                    const marked = dbRecord ? dbRecord.status : markedAttendance[numStr];
                    return (
                      <RollButton
                        key={numStr}
                        rollNo={numStr}
                        student={students?.find(s => s.displayRoll === numStr || s.rollNumber === numStr || s.suffix === numStr)}
                        request={req}
                        markedStatus={marked}
                        isDbMarked={isDbMarked}
                        markedByName={dbRecord?.markedByName}
                        onClick={() => onRollClick(numStr, req, isDbMarked, dbRecord?.markedByName, dbRecord?.status)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer info row ── */}
            <div className="mx-5 border-t border-slate-100 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-400 text-[11.5px]">
                <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <Info size={11} className="text-slate-500" />
                </span>
                <span>This will mark attendance for all {totalStudents} students in this section.</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenWhatsApp(sectionKey)}
                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold text-[11px] flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
                title="Format and send attendance report to WhatsApp"
              >
                <WhatsappIcon size={14} className="text-emerald-600" />
                <span>Share to WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          /* List View Mode */
          <div className="divide-y divide-slate-100">
            {passes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-[12px]">
                No approved permission slips in this section.
              </div>
            ) : (
              passes.map((pass, index) => {
                const rollNo = pass.student?.rollNumber ?? pass.studentId;
                const studentName = pass.student?.name ?? `Student (${rollNo})`;
                const isMultiDay = isLongPermission(pass);

                return (
                  <div
                    key={pass.id}
                    className="p-3.5 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 text-[12px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">{rollNo}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium text-slate-700 truncate">{studentName}</span>
                          <VerifiedActivityBadge student={pass.student} studentId={pass.studentId} rollNumber={rollNo} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar size={11} className="text-orange-500 shrink-0" />
                          <span>
                            {pass.endDate && pass.endDate !== pass.date ? `${pass.date} to ${pass.endDate}` : pass.date} | {formatTime(pass.startTime)} - {formatTime(pass.endTime)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isMultiDay && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-lg text-[10px] border border-purple-200/80 flex items-center gap-1">
                          <Calendar size={10} />
                          <span>Multi-Day Leave</span>
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-orange-50 text-orange-600 font-bold rounded-lg text-[11px] border border-orange-200/60">
                        {pass.reasonLabel}
                      </span>
                      <button
                        onClick={() => onSelectPass(pass)}
                        className="h-7 px-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 font-extrabold text-[10px] rounded-lg border border-orange-200/80 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Printer size={11} />
                        <span>Slip</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
});

PermissionGrid.displayName = 'PermissionGrid';

// ── Main Permissions Page ──────────────────────────────────────────────────────
export default function PermissionsPage() {
  const [searchParams] = useSearchParams();

  // Component State (No default year selected)
  const [search] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('combined');
  const [selectedPeriodFilters, setSelectedPeriodFilters] = useState<number[]>([]);
  const [dateMode, setDateMode] = useState<'today' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState<string>(getTodayDateString());
  const [durationFilter, setDurationFilter] = useState<'all' | 'single' | 'long'>('all');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [markedAttendance, setMarkedAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [selectedPass, setSelectedPass] = useState<AttendanceRequest | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // WhatsApp Modal State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [activeWhatsAppSection, setActiveWhatsAppSection] = useState<string>('');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const showToast = useCallback((msg: string, _isError?: boolean) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const handlePeriodToggle = useCallback((pNum: number) => {
    setMarkedAttendance({});
    setSelectedPeriodFilters(prev => {
      let next: number[];
      if (prev.includes(pNum)) {
        next = prev.filter(p => p !== pNum);
      } else {
        next = [...prev, pNum].sort((a, b) => a - b);
      }

      if (next.length === 0) {
        showToast('Showing All Periods');
      } else {
        showToast(`Filtered for Period(s) ${next.map(n => `P${n}`).join(', ')}`);
      }
      return next;
    });
  }, [showToast]);

  // Sync URL params
  useEffect(() => {
    const secParam = searchParams.get('sec');
    if (secParam) setSectionFilter(secParam);
  }, [searchParams]);

  const todayStr = getTodayDateString();
  const effectiveDate = dateMode === 'today' ? todayStr : dateMode === 'custom' ? customDate : undefined;

  // Query Dynamic Sections List from Database for the academic year (Live DB Sync)
  const { data: dbSections = [] } = useQuery<api.PublicSectionItem[]>({
    queryKey: ['public-sections', selectedYear],
    queryFn: () => api.getPublicSections(selectedYear || '3rd Year'),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Dynamic Section Options for Dropdown
  const sectionOptions = useMemo(() => {
    if (dbSections.length > 0) {
      const opts = dbSections.map(s => ({
        label: s.label,
        value: s.value,
        key: s.key,
      }));
      return [...opts, { label: 'All Sections', value: 'all', key: 'All Sections' }];
    }
    return [
      { label: 'CSD', value: 'CSD', key: 'CSD' },
      { label: 'CSIT - Sec A', value: 'CSIT-A', key: 'CSIT — Section A' },
      { label: 'CSIT - Sec B', value: 'CSIT-B', key: 'CSIT — Section B' },
      { label: 'All Sections', value: 'all', key: 'All Sections' },
    ];
  }, [dbSections]);

  // Normalized Section Roll Numbers Map from DB
  const sectionRollNumbersMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    const norm = (str: string) => (str || '').toUpperCase().replace(/[—–\s-]/g, '').replace(/SECTION/g, 'SEC');

    dbSections.forEach(s => {
      if (s.rollNumbers && s.rollNumbers.length > 0) {
        map[s.key] = s.rollNumbers;
        map[s.value] = s.rollNumbers;
        map[s.key.replace(/[—–]/g, '-')] = s.rollNumbers;
        map[s.key.replace(/-/g, '—')] = s.rollNumbers;
        map[norm(s.key)] = s.rollNumbers;
        map[norm(s.value)] = s.rollNumbers;
      }
    });
    return map;
  }, [dbSections]);

  const getDynamicSectionRollNumbers = useCallback((sectionKey: string): string[] => {
    const normKey = (sectionKey || '').toUpperCase().replace(/[—–\s-]/g, '').replace(/SECTION/g, 'SEC');
    if (sectionRollNumbersMap[sectionKey] && sectionRollNumbersMap[sectionKey].length > 0) {
      return sectionRollNumbersMap[sectionKey];
    }
    if (sectionRollNumbersMap[normKey] && sectionRollNumbersMap[normKey].length > 0) {
      return sectionRollNumbersMap[normKey];
    }
    // Also try matching against dbSections directly
    const foundSec = dbSections.find(s => {
      const sNorm = (s.key || '').toUpperCase().replace(/[—–\s-]/g, '').replace(/SECTION/g, 'SEC');
      const vNorm = (s.value || '').toUpperCase().replace(/[—–\s-]/g, '').replace(/SECTION/g, 'SEC');
      return sNorm === normKey || vNorm === normKey || s.key === sectionKey;
    });
    if (foundSec && foundSec.rollNumbers && foundSec.rollNumbers.length > 0) {
      return foundSec.rollNumbers;
    }
    return [];
  }, [sectionRollNumbersMap, dbSections]);

  // Query Backend Requests from Database (Live DB Sync)
  const { data: apiRequests = [], isLoading } = useQuery({
    queryKey: ['public-approved-requests', effectiveDate, dateMode],
    queryFn: () => api.getPublicApprovedRequests({
      date: effectiveDate,
    }),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Total count of long permissions in system
  const totalLongCount = useMemo(() => {
    return apiRequests.filter(r => r.status === 'approved' && isLongPermission(r)).length;
  }, [apiRequests]);

  // Query Faculty Attendance Submissions for selected date & academic year (Live DB Sync)
  const { data: attendanceSubmissions = [] } = useQuery<api.AttendanceSubmissionItem[]>({
    queryKey: ['public-attendance-submissions', effectiveDate || todayStr, selectedYear],
    queryFn: () => api.getAttendanceSubmissions(effectiveDate || todayStr, undefined, selectedYear || undefined),
    enabled: Boolean(selectedYear),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  /**
   * Determine section dynamically from student department and explicit section.
   * STRICT RULE: Never infer a student's section from roll number.
   */
  const getStudentSectionKey = useCallback((req: any): string => {
    const dept = (req.student?.department ?? '').toUpperCase().trim();
    const explicitSec = ((req.student as any)?.section ?? '').toUpperCase().trim();

    // CSD students are in Section A
    if (dept === 'CSD') {
      return 'CSD';
    }

    const cleanSec = explicitSec
      .replace(/SECTION/g, '')
      .replace(/SEC/g, '')
      .replace(/[-_—–\s]/g, '')
      .trim();

    if (cleanSec === 'B' || cleanSec.endsWith('B') || explicitSec === 'CSIT-B') {
      return 'CSIT — Section B';
    }

    return 'CSIT — Section A';
  }, []);

  // Filtered Approved List
  const filteredApproved = useMemo(() => {
    const dbApproved = apiRequests.filter(r => r.status === 'approved');
    return dbApproved.filter(req => {
      const studentName = req.student?.name ?? req.studentId ?? '';
      const rollNo = req.student?.rollNumber ?? '';
      const sectionKey = getStudentSectionKey(req);

      // Date Matching (Supports single-day as well as multi-day long permissions)
      const matchesDate = dateMode === 'all'
        ? true
        : effectiveDate
          ? isRequestOnDate(req, effectiveDate)
          : true;

      // Duration / Type filter
      const isMultiDay = isLongPermission(req);
      const matchesDuration =
        durationFilter === 'all'
          ? true
          : durationFilter === 'long'
            ? isMultiDay
            : !isMultiDay;

      const matchesSearch =
        studentName.toLowerCase().includes(search.toLowerCase()) ||
        rollNo.toLowerCase().includes(search.toLowerCase()) ||
        req.reasonLabel.toLowerCase().includes(search.toLowerCase());

      // Year Filter (Prioritize explicit student.year record from DB)
      let matchesYear = true;
      if (selectedYear) {
        const targetDigit = (selectedYear.match(/([1-4])/) || [])[1] || '3';
        if (req.student?.year) {
          const digitMatch = req.student.year.match(/([1-4])/);
          if (digitMatch) matchesYear = digitMatch[1] === targetDigit;
        } else if (req.student?.semester && typeof req.student.semester === 'number') {
          matchesYear = String(Math.ceil(req.student.semester / 2)) === targetDigit;
        } else {
          const upperRoll = rollNo.toUpperCase();
          const isLateralEntry = upperRoll.includes('95A') || upperRoll.includes('LE') || /LE\d+$/i.test(upperRoll);

          if (targetDigit === '3') matchesYear = upperRoll.startsWith('24B') || (upperRoll.startsWith('25B') && isLateralEntry);
          else if (targetDigit === '2') matchesYear = upperRoll.startsWith('25B') && !isLateralEntry;
          else if (targetDigit === '1') matchesYear = upperRoll.startsWith('26B') && !isLateralEntry;
          else if (targetDigit === '4') matchesYear = upperRoll.startsWith('23B') || (upperRoll.startsWith('24B') && isLateralEntry);
        }
      }

      // Section Filter
      let matchesSection = sectionFilter === 'all';
      if (!matchesSection && sectionFilter !== 'none') {
        const matchedSecObj = dbSections.find(s => s.value === sectionFilter);
        if (matchedSecObj) {
          matchesSection = sectionKey === matchedSecObj.key;
        } else {
          matchesSection =
            (sectionFilter === 'CSD' && sectionKey === 'CSD') ||
            (sectionFilter === 'CSIT-A' && sectionKey === 'CSIT — Section A') ||
            (sectionFilter === 'CSIT-B' && sectionKey === 'CSIT — Section B');
        }
      }

      // Period Filter
      let matchesPeriod = true;
      if (selectedPeriodFilters.length > 0) {
        const reqPeriods = getPeriodsFromRequest(req);
        matchesPeriod = selectedPeriodFilters.some(p => reqPeriods.includes(p));
      }

      return matchesDate && matchesDuration && matchesSearch && matchesYear && matchesSection && matchesPeriod;
    });
  }, [apiRequests, dateMode, effectiveDate, durationFilter, search, selectedYear, sectionFilter, getStudentSectionKey, dbSections, selectedPeriodFilters]);

  // Group by Section (Dynamically seeded from DB sections for the academic year)
  const { sectionsMap, sectionKeys } = useMemo(() => {
    const map: Record<string, ExtendedAttendanceRequest[]> = {};

    const availableKeys = dbSections.length > 0
      ? dbSections.map(s => s.key)
      : ['CSD', 'CSIT — Section A', 'CSIT — Section B'];

    availableKeys.forEach(k => {
      map[k] = [];
    });

    filteredApproved.forEach(req => {
      const key = getStudentSectionKey(req);
      const matchedKey = availableKeys.find(k =>
        k === key ||
        k.replace(/[—–\s]/g, '') === key.replace(/[—–\s]/g, '')
      ) || key;

      if (!map[matchedKey]) map[matchedKey] = [];
      map[matchedKey].push(req as ExtendedAttendanceRequest);
    });

    let keys = Object.keys(map).sort();

    if (sectionFilter !== 'all' && sectionFilter !== 'none') {
      const matchedSecObj = dbSections.find(s => s.value === sectionFilter);
      if (matchedSecObj) {
        keys = keys.filter(k =>
          k === matchedSecObj.key ||
          k.replace(/[—–\s]/g, '') === matchedSecObj.key.replace(/[—–\s]/g, '')
        );
      } else {
        keys = keys.filter(k => {
          if (sectionFilter === 'CSD') return k.includes('CSD');
          if (sectionFilter === 'CSIT-A') return k.includes('CSIT') && k.includes('A');
          if (sectionFilter === 'CSIT-B') return k.includes('CSIT') && k.includes('B');
          return true;
        });
      }
    }

    return { sectionsMap: map, sectionKeys: keys };
  }, [filteredApproved, sectionFilter, getStudentSectionKey, dbSections]);

  // Filter attendance submissions for current section filter so submissions don't bleed across sections or years
  const activeSectionSubmissions = useMemo(() => {
    let subs = attendanceSubmissions;
    if (selectedYear) {
      const targetYearNorm = selectedYear.trim().toLowerCase();
      subs = subs.filter(sub => (sub.year || '').trim().toLowerCase() === targetYearNorm);
    }
    if (sectionFilter === 'all') return subs;
    return subs.filter(sub => {
      const subSec = (sub.section || '').toUpperCase().replace(/[\s-]/g, '');
      const filterSec = sectionFilter.toUpperCase().replace(/[\s-]/g, '');
      return subSec.includes(filterSec) || filterSec.includes(subSec);
    });
  }, [attendanceSubmissions, sectionFilter, selectedYear]);

  const handleOpenWhatsApp = useCallback((secKey?: string) => {
    if (selectedPeriodFilters.length === 0) {
      showToast('Please select particular period(s) above before sharing', true);
      return;
    }
    const targetSec = secKey || (sectionKeys.length > 0 ? sectionKeys[0] : (dbSections[0]?.key ?? 'CSIT — Section B'));
    setActiveWhatsAppSection(targetSec);
    setIsWhatsAppModalOpen(true);
  }, [sectionKeys, dbSections, selectedPeriodFilters, showToast]);

  // WhatsApp Export Calculation
  const whatsAppSectionKey = activeWhatsAppSection || (sectionKeys[0] ?? (dbSections[0]?.key ?? 'CSIT — Section B'));
  const whatsAppRollNumbers = useMemo(() => getDynamicSectionRollNumbers(whatsAppSectionKey), [whatsAppSectionKey, getDynamicSectionRollNumbers]);

  const whatsAppAttendanceMap = useMemo(() => {
    const map: Record<string, 'present' | 'absent'> = {};

    // Filter submissions for this specific academic year and section being shared
    let relevantSubmissions = (selectedSubmissionId === 'combined'
      ? attendanceSubmissions
      : attendanceSubmissions.filter(s => s.id === selectedSubmissionId)
    ).filter(sub => {
      if (selectedYear && sub.year) {
        if (sub.year.trim().toLowerCase() !== selectedYear.trim().toLowerCase()) return false;
      }
      if (!sub.section) return true;
      const subSec = (sub.section || '').toUpperCase().replace(/[\s-]/g, '');
      const currentSec = whatsAppSectionKey.toUpperCase().replace(/[\s-]/g, '');
      if (currentSec.includes('CSD')) return subSec.includes('CSD');
      if (currentSec.includes('CSIT')) {
        if (currentSec.includes('B') || currentSec.includes('SECB')) {
          return subSec.includes('B');
        }
        return !subSec.includes('B') || subSec.includes('A');
      }
      return subSec.includes(currentSec) || currentSec.includes(subSec);
    });

    // Strictly filter by currently selected periods so previous data from other periods doesn't appear
    if (selectedPeriodFilters.length > 0) {
      relevantSubmissions = relevantSubmissions.filter(sub => {
        const subPeriods = parseSubmissionPeriods(sub.periods);
        return selectedPeriodFilters.some(p => subPeriods.includes(p));
      });
    } else {
      // If no periods are selected, do not load any old period submission records
      relevantSubmissions = [];
    }

    relevantSubmissions.forEach(sub => {
      sub.records.forEach(rec => {
        const raw = rec.rollNumber;
        const suffix = extractRollSuffix(raw);
        const status = rec.status as 'present' | 'absent';
        map[raw] = status;
        if (suffix) {
          map[suffix] = status;
          const num = parseInt(suffix, 10);
          if (!isNaN(num)) {
            map[String(num)] = status;
            map[String(num).padStart(2, '0')] = status;
          }
        }
      });
    });
    return { ...map, ...markedAttendance };
  }, [attendanceSubmissions, selectedSubmissionId, selectedPeriodFilters, markedAttendance, whatsAppSectionKey, selectedYear]);

  const whatsAppPermissionRollsSet = useMemo(() => {
    const set = new Set<string>();
    const secPasses = sectionsMap[whatsAppSectionKey] || [];

    secPasses.forEach(p => {
      // If periods are selected, check period overlap
      if (selectedPeriodFilters.length > 0) {
        const passPeriods = getPeriodsFromRequest(p);
        const hasOverlap = selectedPeriodFilters.some(pNum => passPeriods.includes(pNum));
        if (!hasOverlap) return;
      }
      const rollStr = p.student?.rollNumber ?? p.studentId;
      const suffix = extractRollSuffix(rollStr);
      if (suffix) {
        set.add(suffix);
        const num = parseInt(suffix, 10);
        if (!isNaN(num)) {
          set.add(String(num));
          set.add(String(num).padStart(2, '0'));
        }
      }
    });

    return set;
  }, [sectionsMap, whatsAppSectionKey, selectedPeriodFilters]);

  const { whatsAppPresentRolls, whatsAppAbsentRolls } = useMemo(() => {
    const present: string[] = [];
    const absent: string[] = [];

    whatsAppRollNumbers.forEach(numStr => {
      const status = whatsAppAttendanceMap[numStr];
      const isPermission = whatsAppPermissionRollsSet.has(numStr);

      if (status === 'present' || isPermission) {
        present.push(numStr);
      } else {
        // Non-selected (unmarked / absent) students are automatically included in Absentees
        absent.push(numStr);
      }
    });

    return {
      whatsAppPresentRolls: sortRollNumbers([...new Set(present)]).map(formatRollNumberForDisplay),
      whatsAppAbsentRolls: sortRollNumbers([...new Set(absent)]).map(formatRollNumberForDisplay),
    };
  }, [whatsAppRollNumbers, whatsAppAttendanceMap, whatsAppPermissionRollsSet]);

  const formattedWhatsAppText = useMemo(() => {
    const yearNum = selectedYear.replace(/[^0-9]/g, '') || '3';
    const presentText = whatsAppPresentRolls.length > 0 ? whatsAppPresentRolls.join(', ') : 'None';
    const absentText = whatsAppAbsentRolls.length > 0 ? whatsAppAbsentRolls.join(', ') : 'None';

    const dateStr = dateMode === 'today' ? getTodayFormattedDate() : (customDate || getTodayFormattedDate());
    const periodsStr = selectedPeriodFilters.length > 0
      ? [...selectedPeriodFilters].sort((a, b) => a - b).join(', ')
      : 'All Periods';

    return `*Year:* ${yearNum} / 4\n*Branch Name:* ${whatsAppSectionKey}\n*Date:* ${dateStr}\n*Periods:* ${periodsStr}\n\n*Presentees:*\n${presentText}\n\n*Absentees:*\n${absentText}`;
  }, [selectedYear, whatsAppSectionKey, whatsAppPresentRolls, whatsAppAbsentRolls, selectedPeriodFilters, dateMode, customDate]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSelectPass = useCallback((pass: AttendanceRequest) => {
    setSelectedPass(pass);
  }, []);

  // Handle Mark Everyone Present / Absent (In-Memory Only)
  const handleMarkAll = useCallback((secKey: string, status: 'present' | 'absent') => {
    const rolls = getDynamicSectionRollNumbers(secKey);
    const secPasses = sectionsMap[secKey] || [];

    // Extract roll suffixes of approved permissions in this section to preserve them
    const permissionRollsSet = new Set<string>();
    secPasses.forEach(p => {
      const rollStr = p.student?.rollNumber ?? p.studentId;
      const suffix = extractRollSuffix(rollStr);
      if (suffix) permissionRollsSet.add(suffix);
    });

    setMarkedAttendance(prev => {
      const copy = { ...prev };
      let updatedCount = 0;

      rolls.forEach(numStr => {
        // Preserve yellow permission slips
        if (permissionRollsSet.has(numStr)) return;

        copy[numStr] = status;
        updatedCount++;
      });

      showToast(`Marked ${updatedCount} students in ${secKey} as ${status.toUpperCase()} (Permissions preserved)`);
      return copy;
    });
  }, [sectionsMap, getDynamicSectionRollNumbers, showToast]);

  // Handle Roll Button Click (Locks when already submitted by faculty; otherwise in-memory tracker)
  const handleRollClick = useCallback((
    rollNo: string,
    pass?: ExtendedAttendanceRequest,
    isDbMarked?: boolean,
    markedByName?: string,
    dbStatus?: 'present' | 'absent'
  ) => {
    if (pass) {
      setSelectedPass(pass);
      return;
    }

    if (isDbMarked) {
      showToast(`🔒 Roll #${rollNo} is marked ${dbStatus?.toUpperCase() || 'OFFICIAL'} by ${markedByName || 'Faculty'} (Locked DB Record)`);
      return;
    }

    setMarkedAttendance(prev => {
      const current = prev[rollNo];
      let next: 'present' | 'absent' | undefined;
      if (!current) next = 'present';
      else if (current === 'present') next = 'absent';
      else next = undefined;

      const copy = { ...prev };
      if (next) {
        copy[rollNo] = next;
        showToast(`Roll #${rollNo} marked ${next === 'present' ? 'PRESENT' : 'ABSENT'}`);
      } else {
        delete copy[rollNo];
        showToast(`Roll #${rollNo} reset to Unmarked`);
      }
      return copy;
    });
  }, [showToast]);

  return (
    <PageWrapper role="viewer">
      <div className="max-w-[820px] mx-auto space-y-4">

        {/* Toast Alert */}
        {createPortal(
          <AnimatePresence>
            {toastMsg && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed top-4 right-4 z-[99999] px-3.5 py-2 rounded-xl bg-orange-950/85 backdrop-blur-md text-orange-100 border border-orange-500/30 text-[12px] shadow-xl flex items-center gap-2 print:hidden"
              >
                <Info size={15} className="text-orange-400" />
                <span>{toastMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* ── On-Screen Page UI (Hidden when printing) ── */}
        <div className="space-y-4 print:hidden">

          {/* ── Page Title ── */}
          <div className="pb-4 border-b border-slate-100">
            <h1 className="text-[18px] font-bold text-slate-900 leading-snug tracking-tight">
              Approved Permissions &amp; Attendance
            </h1>
            <p className="text-[12.5px] text-slate-500 mt-1">
              {dateMode === 'today'
                ? `Today's Grid (${getTodayFormattedDate()})`
                : dateMode === 'all'
                  ? 'All Permission Slips'
                  : `Grid for ${customDate}`}
            </p>

            {/* Date control row — compact, clean */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-[12px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setDateMode('today');
                    showToast(`Showing Today's Permissions (${todayStr})`);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 transition-colors cursor-pointer ${
                    dateMode === 'today'
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Calendar size={13} className={dateMode === 'today' ? 'text-white' : 'text-orange-500'} />
                  <span>Today ({getTodayFormattedDate()})</span>
                </button>
                <div className="w-px h-6 bg-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    setDateMode('all');
                    showToast('Showing All Permissions (Including Multi-Day & Long Leaves)');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 transition-colors cursor-pointer ${
                    dateMode === 'all'
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>All Dates</span>
                </button>
                <div className="w-px h-6 bg-slate-200" />
                {/* Hidden calendar date picker */}
                <div
                  className={`relative flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${
                    dateMode === 'custom'
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  title={dateMode === 'custom' ? `Date: ${customDate} (Click to change)` : 'Pick a custom date'}
                >
                  <Calendar size={13} className={dateMode === 'custom' ? 'text-white' : 'text-orange-500'} />
                  {dateMode === 'custom' && <span className="text-[11px] font-bold">{customDate}</span>}
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => {
                      if (e.target.value) {
                        setCustomDate(e.target.value);
                        setDateMode('custom');
                        showToast(`Showing Permissions for ${e.target.value}`);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Select date from calendar"
                  />
                </div>
              </div>

              {/* Reset marks button — only when marks exist */}
              {Object.keys(markedAttendance).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMarkedAttendance({});
                    showToast('All in-memory marks reset');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[12px] font-semibold transition-all cursor-pointer"
                  title="Reset all in-memory attendance clicks"
                >
                  <RefreshCw size={12} />
                  <span>Reset ({Object.keys(markedAttendance).length})</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Academic Year & Section ── */}
          <div className="space-y-3">
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Academic Year &amp; Section</p>

            {/* Year — centered buttons */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Year</p>
              <div className="flex items-center justify-center gap-2.5">
                {[
                  { label: '1', value: '1st Year' },
                  { label: '2', value: '2nd Year' },
                  { label: '3', value: '3rd Year' },
                  { label: '4', value: '4th Year' },
                ].map(yr => (
                  <button
                    key={yr.value}
                    type="button"
                    onClick={() => {
                      setSelectedYear(selectedYear === yr.value ? '' : yr.value);
                      setSectionFilter('all');
                    }}
                    title={yr.value}
                    className={`w-9 h-9 rounded-full font-extrabold text-[13px] flex items-center justify-center transition-all cursor-pointer ${
                      selectedYear === yr.value
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300/40'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {yr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Section dropdown */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Section</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSectionDropdownOpen(!isSectionDropdownOpen)}
                  className="w-full h-11 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[13px] font-semibold text-slate-800 transition-all cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-orange-500 shrink-0" />
                    <span className="text-slate-800 font-semibold">
                      {!selectedYear
                        ? 'Select Year first…'
                        : dbSections.length === 0
                          ? `No sections for ${selectedYear}`
                          : sectionFilter === 'all'
                            ? 'All Sections'
                            : sectionFilter === 'none'
                              ? 'Choose section…'
                              : (sectionOptions.find(opt => opt.value === sectionFilter)?.key ||
                                sectionOptions.find(opt => opt.value === sectionFilter)?.label ||
                                sectionFilter ||
                                'Choose section…')}
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${isSectionDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSectionDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute left-0 right-0 top-[48px] z-30 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-64 overflow-y-auto"
                    >
                      {!selectedYear ? (
                        <div className="px-4 py-3 text-center text-slate-400 text-[12px]">
                          Please select an Academic Year first
                        </div>
                      ) : sectionOptions.length === 0 ? (
                        <div className="px-4 py-3 text-center text-slate-400 text-[12px]">
                          No sections available for {selectedYear}
                        </div>
                      ) : (
                        sectionOptions.map(sec => (
                          <button
                            key={sec.value}
                            type="button"
                            onClick={() => {
                              setSectionFilter(sec.value);
                              setIsSectionDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-[12px] font-semibold flex items-center justify-between hover:bg-orange-50 transition-colors cursor-pointer ${
                              sectionFilter === sec.value ? 'text-orange-600 bg-orange-50/60' : 'text-slate-700'
                            }`}
                          >
                            <span>{sec.label}</span>
                            {sectionFilter === sec.value && <CheckCircle2 size={14} className="text-orange-500" />}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Period Filter ── */}
          <div className="space-y-3">
            {/* Header: PERIOD FILTER primary, helper text secondary, count quiet right */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider leading-none">Period Filter</p>
                  <div className="mt-1">
                    {selectedPeriodFilters.length === 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block shrink-0" />
                        Choose a period to view
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMarkedAttendance({});
                          setSelectedPeriodFilters([]);
                          showToast('Reset period selection');
                        }}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-800 underline underline-offset-2 cursor-pointer transition-colors"
                      >
                        Clear (P{selectedPeriodFilters.join(', P')}) ✕
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 pt-0.5">
                  {attendanceSubmissions.length} Active
                </span>
              </div>
            </div>

            {/* 2 × 4 compact grid — always */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(pNum => {
                const sub = sectionFilter !== 'all'
                  ? activeSectionSubmissions.find(s => parseSubmissionPeriods(s.periods).includes(pNum))
                  : null;
                const isSelected = selectedPeriodFilters.includes(pNum);
                const isSubmitted = Boolean(sub);

                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => handlePeriodToggle(pNum)}
                    className={`
                      h-[44px] rounded-xl font-bold text-[13px] flex flex-col items-center justify-center
                      transition-all duration-150 cursor-pointer border select-none
                      ${isSelected
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm ring-2 ring-orange-300/50'
                        : isSubmitted
                          ? 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }
                    `}
                    title={
                      sub
                        ? `Period ${pNum}: Submitted by ${sub.markedBy?.name} (${sub.periodLabel})`
                        : `Period ${pNum}: Click to toggle`
                    }
                  >
                    <span className="leading-none">P{pNum}</span>
                    <span className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'opacity-80' : isSubmitted ? 'text-orange-600' : 'text-slate-400'}`}>
                      {sectionFilter !== 'all'
                        ? (isSubmitted ? (sub?.markedBy?.name ? sub.markedBy.name.split(' ')[0] : 'Done') : 'Pending')
                        : 'Pending'
                      }
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Faculty Submissions Switcher — only when a specific section is selected */}
            {sectionFilter !== 'all' && activeSectionSubmissions.length > 0 && (
              <div className="pt-1 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Faculty Submissions:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmissionId('combined')}
                    className={`px-2.5 py-1.5 font-semibold rounded-lg shrink-0 transition-all cursor-pointer ${
                      selectedSubmissionId === 'combined'
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
                    }`}
                  >
                    Combined
                  </button>
                  {activeSectionSubmissions.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmissionId(sub.id)}
                      className={`px-2.5 py-1.5 font-semibold rounded-lg shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedSubmissionId === sub.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
                      }`}
                    >
                      <span>{sub.markedBy?.name}:</span>
                      <span className="opacity-90">{sub.periodLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Section Grid Content ── */}
          {!selectedYear || sectionFilter === 'none' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center mx-auto mb-2.5">
                <Building2 size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-[13.5px] mb-1">
                {!selectedYear ? "Select Year & Section" : "Select a Section"}
              </h3>
              <p className="text-slate-400 text-[11.5px] max-w-xs mx-auto leading-snug">
                {!selectedYear
                  ? "Choose your year and section above to load attendance and approved permission passes."
                  : `Choose a section for ${selectedYear} to load attendance.`
                }
              </p>
            </div>
          ) : selectedPeriodFilters.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center mx-auto mb-2.5">
                <Calendar size={16} />
              </div>
              <div className="space-y-1 max-w-xs mx-auto">
                <h3 className="text-[13.5px] font-bold text-slate-900">Select a Period to View Chart</h3>
                <p className="text-[11.5px] text-slate-400 leading-snug">
                  Roll numbers and approved permissions appear once you select one or more periods (P1 – P8) above.
                </p>
              </div>
            </div>
          ) : dbSections.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                <Building2 size={16} />
              </div>
              <h3 className="font-bold text-slate-800 text-[13.5px] mb-1">No Data for {selectedYear}</h3>
              <p className="text-slate-400 text-[11.5px] max-w-xs mx-auto leading-snug">
                No active students, sections, or attendance records are registered for {selectedYear} in the database.
              </p>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-orange-500" />
              <p className="text-[12px]">Loading attendance…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sectionKeys.map(sectionKey => (
                <PermissionGrid
                  key={sectionKey}
                  sectionKey={sectionKey}
                  selectedYear={selectedYear}
                  customRollNumbers={getDynamicSectionRollNumbers(sectionKey)}
                  students={dbSections.find(s => s.key === sectionKey || s.value === sectionKey)?.students}
                  passes={sectionsMap[sectionKey] || []}
                  markedAttendance={markedAttendance}
                  attendanceSubmissions={activeSectionSubmissions}
                  selectedSubmissionId={selectedSubmissionId}
                  selectedPeriodFilters={selectedPeriodFilters}
                  isCollapsed={Boolean(collapsedSections[sectionKey])}
                  onToggleCollapse={() => toggleSection(sectionKey)}
                  onSelectPass={handleSelectPass}
                  onRollClick={handleRollClick}
                  onMarkAll={handleMarkAll}
                  onOpenWhatsApp={handleOpenWhatsApp}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Attendance Export Modal */}
        {createPortal(
          <AnimatePresence>
            {isWhatsAppModalOpen && (
              <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 print:hidden">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
                >
                  {/* Modal Header (Light Green Card) */}
                  <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-4 text-emerald-950 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shadow-xs">
                        <WhatsappIcon size={22} className="text-emerald-800" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-[16px] text-emerald-950 leading-tight">Send Attendance to WhatsApp</h3>
                        <p className="text-[11.5px] text-emerald-800 font-medium mt-0.5">Formatted presentees &amp; absentees report</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsWhatsAppModalOpen(false)}
                      className="w-8 h-8 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 space-y-4">
                    {/* Section Selector */}
                    <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-[12px]">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-emerald-600" />
                        <span className="font-bold text-slate-700">Target Section:</span>
                      </div>
                      <select
                        value={whatsAppSectionKey}
                        onChange={(e) => setActiveWhatsAppSection(e.target.value)}
                        className="bg-white border border-slate-300 font-bold text-slate-900 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-[12px]"
                      >
                        {sectionKeys.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="bg-emerald-500/20 border border-emerald-400/90 p-2.5 rounded-xl">
                        <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider block">Present</span>
                        <span className="text-[19px] font-black text-emerald-950 leading-tight mt-0.5">{whatsAppPresentRolls.length}</span>
                      </div>
                      <div className="bg-rose-500/20 border border-rose-400/90 p-2.5 rounded-xl">
                        <span className="text-[10px] font-extrabold text-rose-900 uppercase tracking-wider block">Absent</span>
                        <span className="text-[19px] font-black text-rose-950 leading-tight mt-0.5">{whatsAppAbsentRolls.length}</span>
                      </div>
                      <div className="bg-slate-100/80 border border-slate-200 p-2.5 rounded-xl">
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">Total Students</span>
                        <span className="text-[19px] font-black text-slate-800 leading-tight mt-0.5">{whatsAppRollNumbers.length}</span>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>Formatted WhatsApp Message:</span>
                        <span className="text-emerald-700 font-mono text-[10.5px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Sorted Ascending</span>
                      </div>
                      <textarea
                        readOnly
                        value={formattedWhatsAppText}
                        rows={8}
                        className="w-full p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl font-mono text-[12px] text-slate-800 leading-relaxed focus:outline-none select-all resize-none shadow-inner"
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formattedWhatsAppText);
                          setCopiedWhatsApp(true);
                          showToast('Copied formatted WhatsApp message to clipboard!');
                          setTimeout(() => setCopiedWhatsApp(false), 2500);
                        }}
                        className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[12px] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-slate-200"
                      >
                        {copiedWhatsApp ? (
                          <>
                            <Check size={16} className="text-emerald-600" />
                            <span className="text-emerald-700 font-extrabold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            <span>Copy Message</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://wa.me/?text=${encodeURIComponent(formattedWhatsAppText)}`;
                          window.open(url, '_blank');
                        }}
                        className="flex-1 h-11 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-950 border border-emerald-400 font-extrabold text-[12px] rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <WhatsappIcon size={18} className="text-emerald-800" />
                        <span>Send to WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Printable Slip Modal */}
        {createPortal(
          <AnimatePresence>
            {selectedPass && (
              <div className="attendease-slip-portal fixed inset-0 z-[99999] bg-orange-950/20 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                <style>{`
                  @media screen {
                    .attendease-printable-slip {
                      display: none !important;
                    }
                  }
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 8mm 12mm;
                    }
                    body > * {
                      visibility: hidden !important;
                    }
                    .attendease-slip-portal,
                    .attendease-slip-portal * {
                      visibility: visible !important;
                    }
                    .attendease-slip-portal {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      background: #ffffff !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      z-index: 9999999 !important;
                    }
                    .attendease-printable-slip {
                      display: flex !important;
                      visibility: visible !important;
                      background: #ffffff !important;
                      color: #000000 !important;
                      width: 100% !important;
                      min-height: 255mm !important;
                      padding: 6mm 8mm !important;
                      box-sizing: border-box !important;
                    }
                    .attendease-screen-modal {
                      display: none !important;
                    }
                  }
                `}</style>

                {/* On-screen Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 247, 237, 0.90) 100%)',
                    backdropFilter: 'blur(24px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                    border: '1px solid rgba(254, 215, 170, 0.75)',
                    boxShadow: '0 24px 60px -10px rgba(249, 115, 22, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
                  }}
                  className="attendease-screen-modal rounded-3xl max-w-md w-full p-5 sm:p-6 max-h-[92vh] flex flex-col justify-between overflow-y-auto"
                >
                  {/* Modal Top Header with Close Button */}
                  <div>
                    <div className="flex items-start justify-between pb-3.5 border-b border-orange-500/25 gap-2">
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="text-[10px] font-extrabold uppercase text-orange-600/80 tracking-wider">SRKR Engineering College</p>
                        <h2 className="text-[20px] font-black text-slate-900 uppercase leading-tight mt-0.5">Permission Slip</h2>
                        <div className="mt-1.5 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                          <span
                            style={{
                              background: 'rgba(249, 115, 22, 0.12)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(249, 115, 22, 0.35)',
                              color: '#EA580C',
                            }}
                            className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full"
                          >
                            APPROVED
                          </span>
                          <span
                            style={{
                              background: 'rgba(255, 255, 255, 0.75)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(254, 215, 170, 0.6)',
                              color: '#C2410C',
                            }}
                            className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full"
                          >
                            #{selectedPass.id.toUpperCase().slice(-8)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPass(null)}
                        style={{
                          background: 'rgba(255, 247, 237, 0.9)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(254, 215, 170, 0.8)',
                          color: '#EA580C',
                        }}
                        className="w-8 h-8 rounded-full hover:bg-orange-600 hover:text-white flex items-center justify-center transition-all cursor-pointer text-sm font-bold shrink-0 shadow-xs"
                        title="Close slip"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Student Details Glassy Orange Card */}
                    <div className="py-3.5 space-y-3 text-[12px]">
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.80)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(254, 215, 170, 0.65)',
                          boxShadow: '0 4px 16px rgba(249, 115, 22, 0.05)',
                        }}
                        className="flex items-stretch rounded-2xl overflow-hidden"
                      >
                        {/* Photo — flush left, full height */}
                        <div className="shrink-0 w-[72px] sm:w-[88px]">
                          <img
                            src={getStudentPhoto(selectedPass)}
                            alt="Student Avatar"
                            className="w-full h-full object-cover block"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPass.student?.name || 'Student')}&background=EA580C&color=fff`;
                            }}
                          />
                        </div>
                        {/* Text content */}
                        <div className="min-w-0 flex-1 p-3.5">
                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">Student Name &amp; Roll</p>
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-slate-900 text-[14px] truncate leading-snug">{selectedPass.student?.name ?? selectedPass.studentId}</p>
                            <VerifiedActivityBadge student={selectedPass.student} studentId={selectedPass.studentId} size="md" />
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-mono font-black text-slate-900 text-[13px]">{selectedPass.student?.rollNumber ?? selectedPass.studentId}</span>
                            <span
                              style={{
                                background: 'rgba(249, 115, 22, 0.12)',
                                border: '1px solid rgba(249, 115, 22, 0.28)',
                                color: '#EA580C',
                              }}
                              className="px-2 py-0.5 rounded-md font-bold text-[10px]"
                            >
                              {selectedPass.student?.department || 'CSIT'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Metadata Glassy Grid */}
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.65)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(254, 215, 170, 0.55)',
                        }}
                        className="space-y-2.5 p-3.5 rounded-2xl text-[12px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-semibold">Category / Reason:</span>
                          <span
                            style={{
                              background: 'rgba(249, 115, 22, 0.14)',
                              border: '1px solid rgba(249, 115, 22, 0.3)',
                              color: '#EA580C',
                            }}
                            className="font-extrabold px-2.5 py-0.5 rounded-lg text-[11.5px]"
                          >
                            {selectedPass.reasonLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-semibold">Date:</span>
                          <span className="font-bold text-slate-800">{selectedPass.date}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-semibold">Time Duration:</span>
                          <span className="font-bold text-slate-800 font-mono text-[11.5px]">{formatTime(selectedPass.startTime)} - {formatTime(selectedPass.endTime)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 font-semibold">Approved By:</span>
                          <span className="font-bold text-slate-900 truncate max-w-[200px] text-right">{selectedPass.finalDecisionName || selectedPass.faculty?.name || 'Faculty Advisor'}</span>
                        </div>
                      </div>

                      {/* Reason Description Glass Box */}
                      {selectedPass.description && (
                        <div
                          style={{
                            background: 'rgba(255, 247, 237, 0.85)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(254, 215, 170, 0.75)',
                          }}
                          className="p-3.5 rounded-2xl text-[11.5px] text-orange-950 leading-relaxed"
                        >
                          <span className="font-bold text-orange-800 block mb-1 text-[10px] uppercase tracking-wider">Purpose / Description:</span>
                          "{selectedPass.description}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer Buttons with Glassy Orange styling */}
                  <div className="pt-3 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{
                        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.95) 0%, rgba(234, 88, 12, 1) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        boxShadow: '0 8px 24px -4px rgba(249, 115, 22, 0.45)',
                      }}
                      className="w-full sm:flex-1 h-10.5 text-white font-extrabold text-[12.5px] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <Printer size={15} />
                      <span>Print Official Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPass(null)}
                      style={{
                        background: 'rgba(255, 247, 237, 0.85)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(254, 215, 170, 0.8)',
                        color: '#EA580C',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#EA580C';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 247, 237, 0.85)';
                        e.currentTarget.style.color = '#EA580C';
                      }}
                      className="w-full sm:w-auto h-10.5 px-5 font-extrabold text-[12px] rounded-xl cursor-pointer transition-colors shadow-xs"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>

                {/* Printable Letter Format */}
                <div className="attendease-printable-slip bg-white p-6 sm:p-8 text-slate-900 font-sans leading-relaxed w-full min-h-[255mm] flex flex-col justify-between mx-auto text-[12px]">
                  <div>
                    <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                      <h2 className="text-base font-black uppercase tracking-tight text-slate-900">
                        SAGI RAMAKRISHNAM RAJU ENGINEERING COLLEGE (AUTONOMOUS)
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                        CHINA AMIRAM, BHIMAVARAM — 534 204, W.G. Dist., Andhra Pradesh, India
                      </p>
                    </div>

                    <div className="grid grid-cols-12 items-start text-[12px] font-medium mb-4 gap-2 border-b border-slate-200/80 pb-3">
                      <div className="col-span-5 space-y-0.5">
                        <p className="font-bold text-slate-900 uppercase text-[11px]">From:</p>
                        <p className="font-bold text-slate-900">{selectedPass.student?.name ?? selectedPass.studentId}</p>
                        <p className="font-mono text-slate-700 font-bold">Roll No: {selectedPass.student?.rollNumber ?? selectedPass.studentId}</p>
                        <p className="text-slate-600 text-[11.5px]">Department of {selectedPass.student?.department ?? 'CSD'} &amp; CSIT</p>
                        <p className="text-slate-600 text-[11.5px]">SRKR Engineering College (Autonomous)</p>
                      </div>

                      <div className="col-span-4 text-center space-y-1 self-center">
                        <div className="inline-block px-3 py-1 bg-slate-50 border border-slate-300 rounded-md">
                          <p className="font-bold text-slate-900 text-[11.5px]">
                            Date: {selectedPass.endDate && selectedPass.endDate !== selectedPass.date ? `${selectedPass.date} to ${selectedPass.endDate}` : selectedPass.date}
                          </p>
                          <p className="font-mono text-slate-600 text-[10.5px]">Ref: SRKR/PERM/{selectedPass.id.toUpperCase()}</p>
                        </div>
                      </div>

                      <div className="col-span-3 flex flex-col items-end">
                        <div className="w-[64px] h-[64px] sm:w-[88px] sm:h-[88px] bg-white overflow-hidden flex flex-col items-center justify-center relative">
                          <img
                            src={getStudentPhoto(selectedPass)}
                            alt="Student Photo"
                            className="w-full h-full object-cover block"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPass.student?.name || 'Student')}&background=0F172A&color=fff`;
                            }}
                          />
                        </div>
                        <div className="text-center w-[64px] sm:w-[88px] mt-1 space-y-0.5">
                          <p className="font-bold text-[10px] text-slate-900 leading-tight truncate">
                            {selectedPass.student?.name ?? selectedPass.studentId}
                          </p>
                          <p className="font-mono font-black text-[9.5px] text-slate-800 uppercase tracking-tight">
                            {selectedPass.student?.rollNumber ?? selectedPass.studentId}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-[12px] font-medium mb-4 space-y-0.5">
                      <p className="font-bold text-slate-900 uppercase text-[11px]">To:</p>
                      <p className="font-bold text-slate-900">The Head of the Department (HOD)</p>
                      <p className="text-slate-700">Department of {selectedPass.student?.department ?? 'CSD'} &amp; CSIT</p>
                      <p className="text-slate-700">SRKR Engineering College (Autonomous), Bhimavaram</p>
                    </div>

                    <div className="my-4 p-3 bg-slate-50 border-y border-slate-300 font-bold text-[12px] sm:text-[13px] text-slate-900 leading-snug">
                      Subject: Application requesting official permission for {selectedPass.reasonLabel} — "{selectedPass.description}"
                    </div>

                    <div className="space-y-3 text-[12px] leading-relaxed text-slate-800">
                      <p className="font-bold text-slate-900">Respected Sir/Madam,</p>
                      <p>
                        I am writing to formally request your approval for an official permission slip. I am <strong>{selectedPass.student?.name ?? selectedPass.studentId}</strong>, bearing Roll Number <strong className="font-mono">{selectedPass.student?.rollNumber ?? selectedPass.studentId}</strong>, studying in 3rd Year, Department of <strong>{selectedPass.student?.department ?? 'CSD'}</strong> (Section <strong>{selectedPass.student?.section ?? (selectedPass as unknown as ExtendedAttendanceRequest).sectionName ?? 'A'}</strong>).
                      </p>
                      <p>
                        I am requesting permission for <strong>{selectedPass.reasonLabel}</strong> {selectedPass.endDate && selectedPass.endDate !== selectedPass.date ? <>from <strong>{selectedPass.date}</strong> to <strong>{selectedPass.endDate}</strong></> : <>on <strong>{selectedPass.date}</strong></>} for the time duration of <strong>{selectedPass.startTime} to {selectedPass.endTime}</strong>.
                      </p>

                      <div className="pl-4 space-y-2 border-l-2 border-orange-500 bg-orange-50/40 p-3 rounded-r-lg text-[11.5px]">
                        <p><strong>Permission Reason:</strong> {selectedPass.reasonLabel}</p>
                        <p><strong>Purpose &amp; Description:</strong> "{selectedPass.description || 'Permission request for academic/personal reasons.'}"</p>
                        <p><strong>Date &amp; Time Slot:</strong> {selectedPass.endDate && selectedPass.endDate !== selectedPass.date ? `${selectedPass.date} to ${selectedPass.endDate}` : selectedPass.date} ({formatTime(selectedPass.startTime)} – {formatTime(selectedPass.endTime)})</p>
                        <p><strong>Approved Faculty Advisor:</strong> {selectedPass.faculty?.name ?? 'Faculty Advisor'}</p>
                      </div>

                      <p>
                        I assure you that I will make up for any missed coursework or lab sessions promptly. I kindly request you to grant me permission for the specified duration.
                      </p>
                      <p>Thank you for your time, consideration, and continuous support.</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-end justify-between gap-4 text-[11px] font-sans">
                    <div>
                      <p className="font-bold text-slate-900 mb-4">Yours sincerely,</p>
                      <div className="h-7 border-b border-slate-400 w-40 mb-1"></div>
                      <p className="font-bold text-slate-900">{selectedPass.student?.name ?? selectedPass.studentId}</p>
                    </div>

                    <div className="text-center">
                      <p className="font-bold text-slate-900 mb-4">Forwarded &amp; Approved by:</p>
                      <div className="h-7 border-b border-slate-400 w-44 mb-1 mx-auto flex items-end justify-center pb-0.5">
                        <span className="text-[10px] font-bold text-orange-600 font-serif italic">Verified &amp; Approved</span>
                      </div>
                      <p className="font-bold text-slate-900">{selectedPass.faculty?.name ?? 'Faculty Advisor'}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 flex flex-col items-center justify-center bg-transparent transform -rotate-12">
                        <img src={logo} alt="AttendEase Official Seal" className="w-16 h-16 object-contain bg-transparent" />
                        <span className="text-[7.5px] font-black uppercase text-orange-600 tracking-wider leading-none mt-1">OFFICIAL SEAL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      </div>
    </PageWrapper>
  );
}
