import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RotateCcw, Download, Eye,
  Copy, Check, FileSpreadsheet, RefreshCw, Calendar,
  Clock, User, FileText, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown,
  Layers, Filter, ChevronLeft, ChevronRight, BookOpen, Link as LinkIcon,
  X
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { EmptyState } from '../../components/shared/EmptyState';
import { Modal } from '../../components/shared/Modal';
import { VerifiedActivityBadge } from '../../components/shared/VerifiedActivityBadge';
import { formatDate, formatSubmittedAt, formatTime, getPeriodsFromRequest, DEPARTMENTS, REASON_LABELS } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';
import type { AttendanceRequest } from '../../types';

type SortField = 'date' | 'submittedAt' | 'studentName' | 'rollNumber' | 'department' | 'status' | 'reason';
type SortOrder = 'asc' | 'desc';
type TabValue = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';
type DatePreset = 'all' | 'today' | '7days' | '30days' | 'custom';

// Clean monochrome status indicator with ample letter spacing and padding
function CleanStatusBadge({ status, finalDecisionBy }: { status: string; finalDecisionBy?: string }) {
  const normalized = (status || '').toLowerCase();
  
  let label = 'Pending';
  if (normalized === 'approved') label = finalDecisionBy ? `Approved (${finalDecisionBy})` : 'Approved';
  else if (normalized === 'rejected') label = finalDecisionBy ? `Rejected (${finalDecisionBy})` : 'Rejected';
  else if (normalized === 'cancelled') label = 'Cancelled';

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium leading-none bg-slate-100 text-slate-800 border border-slate-300/80 whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${normalized === 'approved' ? 'bg-slate-900' : normalized === 'rejected' ? 'bg-slate-400' : 'bg-slate-600'}`} />
      <span className="leading-none">{label}</span>
    </span>
  );
}

export default function AdminRequests() {
  // Search & Filters state
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<TabValue>('all');
  const [department, setDept] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting & Pagination state
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal & Detail view state
  const [inspectingRequest, setInspectingRequest] = useState<AttendanceRequest | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Export progress state
  const [isExporting, setIsExporting] = useState(false);

  // Data fetching
  const { data: requestsList = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['requests'],
    queryFn: () => api.getRequests(),
  });

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (statusTab !== 'all') count++;
    if (department) count++;
    if (reasonCategory) count++;
    if (yearFilter) count++;
    if (datePreset !== 'all') count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [search, statusTab, department, reasonCategory, yearFilter, datePreset, dateFrom, dateTo]);

  // Handle Preset Date filter
  useEffect(() => {
    const today = new Date();
    const toDateString = (d: Date) => d.toISOString().split('T')[0];

    if (datePreset === 'today') {
      const todayStr = toDateString(today);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (datePreset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setDateFrom(toDateString(past));
      setDateTo(toDateString(today));
    } else if (datePreset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setDateFrom(toDateString(past));
      setDateTo(toDateString(today));
    } else if (datePreset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  }, [datePreset]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return requestsList.filter((req: AttendanceRequest) => {
      // Status filter
      if (statusTab !== 'all' && req.status !== statusTab) {
        return false;
      }

      // Department filter
      const reqDept = req.student?.department || req.department || '';
      if (department && reqDept !== department) {
        return false;
      }

      // Reason filter
      if (reasonCategory && req.reason !== reasonCategory) {
        return false;
      }

      // Year filter
      if (yearFilter) {
        const studentYear = req.student?.year || (req.student?.semester ? `${Math.ceil(Number(req.student.semester) / 2)}` : '');
        const studentYearLabel = req.student?.year || (req.student?.semester ? `${Math.ceil(Number(req.student.semester) / 2)}${Math.ceil(Number(req.student.semester) / 2) === 1 ? 'st' : Math.ceil(Number(req.student.semester) / 2) === 2 ? 'nd' : Math.ceil(Number(req.student.semester) / 2) === 3 ? 'rd' : 'th'} Year` : '');
        if (studentYear !== yearFilter && studentYearLabel !== yearFilter) {
          return false;
        }
      }

      // Date range filter
      if (dateFrom) {
        const reqDate = req.date ? req.date.split('T')[0] : '';
        if (reqDate < dateFrom) return false;
      }
      if (dateTo) {
        const reqDate = req.endDate ? req.endDate.split('T')[0] : (req.date ? req.date.split('T')[0] : '');
        if (reqDate > dateTo) return false;
      }

      // Global search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const studentName = (req.student?.name || req.studentName || '').toLowerCase();
        const rollNumber = (req.student?.rollNumber || req.rollNumber || req.studentId || '').toLowerCase();
        const reason = (req.reasonLabel || req.reason || '').toLowerCase();
        const desc = (req.description || '').toLowerCase();
        const reqId = (req.id || req.requestId || req.publicId || '').toLowerCase();
        const facultyName = (req.faculty?.name || req.facultyName || req.primaryFaculty?.name || req.finalDecisionName || '').toLowerCase();

        const matches =
          studentName.includes(q) ||
          rollNumber.includes(q) ||
          reason.includes(q) ||
          desc.includes(q) ||
          reqId.includes(q) ||
          facultyName.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [requestsList, statusTab, department, reasonCategory, yearFilter, dateFrom, dateTo, search]);

  // Sorted dataset
  const sortedRequests = useMemo(() => {
    const list = [...filteredRequests];
    list.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      switch (sortField) {
        case 'submittedAt':
          aVal = new Date(a.submittedAt || a.date || 0).getTime();
          bVal = new Date(b.submittedAt || b.date || 0).getTime();
          break;
        case 'date':
          aVal = new Date(a.date || 0).getTime();
          bVal = new Date(b.date || 0).getTime();
          break;
        case 'studentName':
          aVal = (a.student?.name || a.studentName || '').toLowerCase();
          bVal = (b.student?.name || b.studentName || '').toLowerCase();
          break;
        case 'rollNumber':
          aVal = (a.student?.rollNumber || a.rollNumber || '').toLowerCase();
          bVal = (b.student?.rollNumber || b.rollNumber || '').toLowerCase();
          break;
        case 'department':
          aVal = (a.student?.department || a.department || '').toLowerCase();
          bVal = (b.student?.department || b.department || '').toLowerCase();
          break;
        case 'status':
          aVal = (a.status || '').toLowerCase();
          bVal = (b.status || '').toLowerCase();
          break;
        case 'reason':
          aVal = (a.reasonLabel || a.reason || '').toLowerCase();
          bVal = (b.reasonLabel || b.reason || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRequests, sortField, sortOrder]);

  // Pagination calculation
  const totalItems = sortedRequests.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedRequests = useMemo(() => {
    if (pageSize === 0) return sortedRequests;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRequests.slice(startIndex, startIndex + pageSize);
  }, [sortedRequests, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusTab, department, reasonCategory, yearFilter, dateFrom, dateTo, pageSize]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = requestsList.length;
    const pending = requestsList.filter(r => r.status === 'pending').length;
    const approved = requestsList.filter(r => r.status === 'approved').length;
    const rejected = requestsList.filter(r => r.status === 'rejected').length;
    const cancelled = requestsList.filter(r => r.status === 'cancelled').length;

    // Today's requests
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRequests = requestsList.filter(r => {
      const sub = r.submittedAt ? r.submittedAt.split('T')[0] : '';
      const dt = r.date ? r.date.split('T')[0] : '';
      return sub === todayStr || dt === todayStr;
    }).length;

    return { total, pending, approved, rejected, cancelled, todayRequests };
  }, [requestsList]);

  // Handle Sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setStatusTab('all');
    setDept('');
    setReasonCategory('');
    setYearFilter('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Multi-selection handlers
  const handleSelectAllVisible = () => {
    const visibleIds = paginatedRequests.map(r => r.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Copy helper
  const handleCopy = (text: string, type: 'id' | 'link' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } else if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else if (type === 'json') {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  // Export to Excel with ExcelJS
  const handleExportExcel = async (exportAll: boolean = true) => {
    try {
      setIsExporting(true);
      const dataset = exportAll
        ? (selectedIds.length > 0 ? requestsList.filter(r => selectedIds.includes(r.id)) : sortedRequests)
        : paginatedRequests;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AttendEase System Admin';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Attendance Requests Log', {
        views: [{ showGridLines: true }]
      });

      // Title header rows
      worksheet.mergeCells('A1:L1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'AttendEase — Attendance Permission & Exemption Audit Log';
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Subtitle / generated info
      worksheet.mergeCells('A2:L2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Export Generated: ${new Date().toLocaleString()} | Total Records: ${dataset.length}`;
      subCell.font = { name: 'Arial', size: 9, color: { argb: 'FF52525B' } };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Table columns definition
      worksheet.columns = [
        { header: 'Request ID', key: 'requestId', width: 16 },
        { header: 'Student Name', key: 'studentName', width: 26 },
        { header: 'Roll Number', key: 'rollNumber', width: 16 },
        { header: 'Department', key: 'department', width: 14 },
        { header: 'Year / Sem', key: 'yearSem', width: 14 },
        { header: 'Reason / Category', key: 'reason', width: 22 },
        { header: 'Leave Date(s)', key: 'date', width: 22 },
        { header: 'Timing / Periods', key: 'timing', width: 20 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Assigned Faculty', key: 'faculty', width: 22 },
        { header: 'Submitted At', key: 'submittedAt', width: 20 },
        { header: 'Description / Remarks', key: 'description', width: 35 },
      ];

      // Format header row (Row 4)
      const headerRow = worksheet.getRow(4);
      headerRow.values = [
        'Request ID',
        'Student Name',
        'Roll Number',
        'Department',
        'Year / Sem',
        'Reason / Category',
        'Leave Date(s)',
        'Timing / Periods',
        'Status',
        'Assigned Faculty',
        'Submitted At',
        'Description / Remarks'
      ];
      headerRow.height = 26;
      headerRow.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27272A' } };
      });

      // Insert data rows
      dataset.forEach((req, idx) => {
        const studentName = req.student?.name || req.studentName || '—';
        const rollNumber = req.student?.rollNumber || req.rollNumber || req.studentId || '—';
        const dept = req.student?.department || req.department || '—';
        const yearSem = req.student?.year || (req.student?.semester ? `Sem ${req.student.semester}` : '—');
        const reason = req.reasonLabel || req.reason || '—';
        const dateStr = req.endDate ? `${formatDate(req.date)} to ${formatDate(req.endDate)}` : formatDate(req.date);

        const periods = getPeriodsFromRequest(req);
        const timingStr = periods && periods.length > 0 && periods.length < 8
          ? `Periods ${periods.join(', ')}`
          : (req.startTime && req.endTime ? `${formatTime(req.startTime)} - ${formatTime(req.endTime)}` : 'Full Day');

        const faculty = req.faculty?.name || req.facultyName || req.primaryFaculty?.name || req.finalDecisionName || '—';
        const submitted = formatSubmittedAt(req.submittedAt);
        const description = req.description || '';

        const row = worksheet.addRow({
          requestId: req.publicId || req.requestId || req.id.slice(0, 8),
          studentName,
          rollNumber,
          department: dept,
          yearSem,
          reason,
          date: dateStr,
          timing: timingStr,
          status: req.status.toUpperCase(),
          faculty,
          submittedAt: submitted,
          description,
        });

        row.height = 22;
        row.font = { name: 'Arial', size: 9 };
        row.alignment = { vertical: 'middle', horizontal: 'left' };

        // Center specific columns
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

        // Zebra stripe
        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
          });
        }
      });

      // Write file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `AttendEase_Request_Logs_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (exportAll: boolean = true) => {
    const dataset = exportAll
      ? (selectedIds.length > 0 ? requestsList.filter(r => selectedIds.includes(r.id)) : sortedRequests)
      : paginatedRequests;

    const headers = [
      'Request ID',
      'Student Name',
      'Roll Number',
      'Department',
      'Year/Sem',
      'Reason',
      'Date',
      'End Date',
      'Timing/Periods',
      'Status',
      'Assigned Faculty',
      'Submitted At',
      'Description'
    ];

    const rows = dataset.map(req => {
      const periods = getPeriodsFromRequest(req);
      const timingStr = periods && periods.length > 0 && periods.length < 8
        ? `Periods ${periods.join(', ')}`
        : (req.startTime && req.endTime ? `${formatTime(req.startTime)} - ${formatTime(req.endTime)}` : 'Full Day');

      return [
        `"${req.publicId || req.requestId || req.id}"`,
        `"${req.student?.name || req.studentName || ''}"`,
        `"${req.student?.rollNumber || req.rollNumber || req.studentId || ''}"`,
        `"${req.student?.department || req.department || ''}"`,
        `"${req.student?.year || req.student?.semester || ''}"`,
        `"${req.reasonLabel || req.reason || ''}"`,
        `"${req.date || ''}"`,
        `"${req.endDate || ''}"`,
        `"${timingStr}"`,
        `"${req.status}"`,
        `"${req.faculty?.name || req.facultyName || ''}"`,
        `"${req.submittedAt || ''}"`,
        `"${(req.description || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AttendEase_Requests_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageWrapper role="admin">
      <div className="max-w-[1440px] mx-auto space-y-4 px-1">

        {/* ── Top Header & Actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-lg p-5 border border-slate-200"
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded tracking-wide leading-normal">
                AUDIT LOGS
              </span>
              <span className="text-[12px] text-slate-500 font-mono leading-normal">
                {requestsList.length} Records
              </span>
            </div>
            <h1 className="text-[20px] font-bold text-slate-900 tracking-tight leading-snug">
              Request Logs
            </h1>
            <p className="text-[13px] text-slate-500 leading-normal mt-0.5">
              Audit trail and ledger of student attendance permission requests
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh requests"
              className="h-[36px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => handleExportCSV(true)}
              title="Export to CSV"
              className="h-[36px] px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[12.5px] font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download size={13} className="text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExportExcel(true)}
              disabled={isExporting}
              title="Export formatted Excel report"
              className="h-[36px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <FileSpreadsheet size={14} />
              <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          </div>
        </motion.div>

        {/* ── Summary Stats / KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Logs', value: stats.total, sub: 'All requests', tab: 'all' as TabValue, icon: Layers },
            { label: 'Pending', value: stats.pending, sub: 'Awaiting decision', tab: 'pending' as TabValue, icon: Clock },
            { label: 'Approved', value: stats.approved, sub: 'Permissions granted', tab: 'approved' as TabValue, icon: Check },
            { label: 'Rejected', value: stats.rejected, sub: 'Denied permissions', tab: 'rejected' as TabValue, icon: X },
            { label: "Today's Logs", value: stats.todayRequests, sub: 'Active / Submitted', tab: null, icon: Calendar },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            const isTabActive = stat.tab !== null && statusTab === stat.tab;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (stat.tab) setStatusTab(stat.tab);
                }}
                className={`bg-white rounded-lg p-3.5 border transition-all duration-150 flex flex-col justify-between ${
                  stat.tab ? 'cursor-pointer' : ''
                } ${
                  isTabActive
                    ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[12px] font-medium text-slate-500 leading-normal">{stat.label}</span>
                  <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Icon size={13} />
                  </div>
                </div>
                <div>
                  <span className="text-[22px] font-bold tracking-tight text-slate-900 leading-none block">
                    {stat.value}
                  </span>
                  <p className="text-[11.5px] text-slate-500 mt-1 leading-normal truncate">{stat.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Main Filter & Search Control Panel ── */}
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3">
          {/* Top Filter Row: Search + Status Tabs + Filter Toggle */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by student name, roll number, ID, reason, or reviewer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-[38px] pl-9 pr-8 text-[13px] bg-slate-50 text-slate-900 placeholder:text-slate-400 rounded outline-none border border-slate-200 focus:border-slate-400 focus:bg-white transition-all leading-normal"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded overflow-x-auto shrink-0">
              {[
                { id: 'all', label: 'All', count: stats.total },
                { id: 'pending', label: 'Pending', count: stats.pending },
                { id: 'approved', label: 'Approved', count: stats.approved },
                { id: 'rejected', label: 'Rejected', count: stats.rejected },
                { id: 'cancelled', label: 'Cancelled', count: stats.cancelled },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusTab(tab.id as TabValue)}
                  className={`px-3 py-1 rounded text-[12px] font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer leading-normal ${
                    statusTab === tab.id
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10.5px] px-1.5 py-0.2 rounded font-mono leading-tight ${
                    statusTab === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-[38px] px-3.5 rounded text-[12.5px] font-medium flex items-center justify-center gap-1.5 border transition-all cursor-pointer shrink-0 leading-normal ${
                showAdvancedFilters || activeFiltersCount > (statusTab !== 'all' ? 1 : 0) + (search ? 1 : 0)
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter size={13} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-700 text-white text-[10.5px] font-bold font-mono">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Collapsible Secondary Filters */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 overflow-hidden"
              >
                {/* Department */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={e => setDept(e.target.value)}
                    className="w-full h-[36px] px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white cursor-pointer leading-normal"
                  >
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Reason Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                    Reason Category
                  </label>
                  <select
                    value={reasonCategory}
                    onChange={e => setReasonCategory(e.target.value)}
                    className="w-full h-[36px] px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white cursor-pointer leading-normal"
                  >
                    <option value="">All Categories</option>
                    {Object.entries(REASON_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                    Student Year
                  </label>
                  <select
                    value={yearFilter}
                    onChange={e => setYearFilter(e.target.value)}
                    className="w-full h-[36px] px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white cursor-pointer leading-normal"
                  >
                    <option value="">All Years</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                {/* Date Preset */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                    Date Range
                  </label>
                  <select
                    value={datePreset}
                    onChange={e => setDatePreset(e.target.value as DatePreset)}
                    className="w-full h-[36px] px-2.5 text-[12.5px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white cursor-pointer leading-normal"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {/* Custom Date Pickers */}
                {datePreset === 'custom' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full h-[36px] px-2.5 text-[12px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 leading-normal">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full h-[36px] px-2.5 text-[12px] bg-slate-50 border border-slate-200 text-slate-800 rounded outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100 text-[12px]">
              <span className="text-slate-400 font-medium leading-normal">Filters:</span>

              {search && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Search: "{search}"
                  <button onClick={() => setSearch('')} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              {statusTab !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Status: {statusTab.toUpperCase()}
                  <button onClick={() => setStatusTab('all')} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              {department && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Dept: {department}
                  <button onClick={() => setDept('')} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              {reasonCategory && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Category: {REASON_LABELS[reasonCategory] || reasonCategory}
                  <button onClick={() => setReasonCategory('')} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              {yearFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Year: {yearFilter}
                  <button onClick={() => setYearFilter('')} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              {(dateFrom || dateTo) && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 leading-normal">
                  Date: {dateFrom || 'Start'} → {dateTo || 'End'}
                  <button onClick={() => { setDateFrom(''); setDateTo(''); setDatePreset('all'); }} className="hover:text-slate-950"><X size={11} /></button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="ml-auto text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer leading-normal"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Selection Floating Bar ── */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="bg-slate-900 text-white rounded-lg px-4 py-2.5 shadow-sm flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[12px] font-mono font-bold leading-normal">
                  {selectedIds.length}
                </span>
                <span className="text-[13px] font-medium leading-normal">
                  {selectedIds.length} row{selectedIds.length > 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportExcel(true)}
                  className="h-[32px] px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer leading-normal"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export Selected (Excel)</span>
                </button>
                <button
                  onClick={() => handleExportCSV(true)}
                  className="h-[32px] px-3 bg-slate-800 hover:bg-slate-700 text-white rounded text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer leading-normal"
                >
                  <Download size={13} />
                  <span>Export Selected (CSV)</span>
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="h-[32px] px-2.5 text-slate-300 hover:text-white rounded text-[12px] transition-all cursor-pointer leading-normal"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Clean Monochrome Data Table ── */}
        {isLoading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 flex flex-col items-center justify-center gap-2.5">
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid rgba(24,24,27,0.15)', borderTopColor: '#18181b', animation: 'spin 0.7s linear infinite' }} />
            <p className="text-[13px] font-medium text-slate-600 leading-normal">Loading request logs...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No request logs found"
            description={
              activeFiltersCount > 0
                ? "No records matched your search or filters."
                : "No student attendance permission requests recorded."
            }
            action={
              activeFiltersCount > 0 ? (
                <button
                  onClick={handleResetFilters}
                  className="h-[36px] px-4 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-medium rounded transition-all cursor-pointer leading-normal"
                >
                  Reset Filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 select-none">
                    {/* Checkbox */}
                    <th className="w-10 px-3.5 py-3 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={
                          paginatedRequests.length > 0 &&
                          paginatedRequests.every(r => selectedIds.includes(r.id))
                        }
                        onChange={handleSelectAllVisible}
                        className="w-3.5 h-3.5 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer accent-slate-900"
                      />
                    </th>

                    {/* ID */}
                    <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap align-middle">
                      ID
                    </th>

                    {/* Student */}
                    <th
                      onClick={() => handleSort('studentName')}
                      className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900 whitespace-nowrap align-middle min-w-[180px]"
                    >
                      <div className="flex items-center gap-1.5 leading-normal">
                        <span>Student</span>
                        {sortField === 'studentName' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 shrink-0" /> : <ArrowDown size={12} className="text-slate-900 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Department */}
                    <th
                      onClick={() => handleSort('department')}
                      className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900 whitespace-nowrap align-middle min-w-[90px]"
                    >
                      <div className="flex items-center gap-1.5 leading-normal">
                        <span>Dept</span>
                        {sortField === 'department' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 shrink-0" /> : <ArrowDown size={12} className="text-slate-900 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Reason */}
                    <th
                      onClick={() => handleSort('reason')}
                      className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900 whitespace-nowrap align-middle min-w-[180px]"
                    >
                      <div className="flex items-center gap-1.5 leading-normal">
                        <span>Reason / Category</span>
                        {sortField === 'reason' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 shrink-0" /> : <ArrowDown size={12} className="text-slate-900 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Leave Date */}
                    <th
                      onClick={() => handleSort('date')}
                      className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900 whitespace-nowrap align-middle min-w-[160px]"
                    >
                      <div className="flex items-center gap-1.5 leading-normal">
                        <span>Leave Schedule</span>
                        {sortField === 'date' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 shrink-0" /> : <ArrowDown size={12} className="text-slate-900 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Assigned Reviewer */}
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap align-middle min-w-[140px]">
                      Reviewer
                    </th>

                    {/* Status */}
                    <th
                      onClick={() => handleSort('status')}
                      className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900 whitespace-nowrap align-middle min-w-[120px]"
                    >
                      <div className="flex items-center gap-1.5 leading-normal">
                        <span>Status</span>
                        {sortField === 'status' ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-slate-900 shrink-0" /> : <ArrowDown size={12} className="text-slate-900 shrink-0" />
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 shrink-0" />
                        )}
                      </div>
                    </th>

                    {/* Action */}
                    <th className="px-4 py-3 text-[11px] font-semibold text-slate-600 uppercase tracking-wider text-right whitespace-nowrap align-middle min-w-[80px]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedRequests.map((req) => {
                    const isSelected = selectedIds.includes(req.id);
                    const periods = getPeriodsFromRequest(req);
                    const isMultiDay = Boolean(req.endDate && req.endDate !== req.date);
                    const displayId = req.publicId || req.requestId || req.id.slice(0, 8);

                    return (
                      <tr
                        key={req.id}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                        }`}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('input[type="checkbox"]') || target.closest('button') || target.closest('a')) return;
                          setInspectingRequest(req);
                        }}
                      >
                        {/* Checkbox */}
                        <td className="px-3.5 py-3 text-center align-middle" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(req.id)}
                            className="w-3.5 h-3.5 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer accent-slate-900"
                          />
                        </td>

                        {/* ID */}
                        <td className="px-3.5 py-3 whitespace-nowrap align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(displayId, 'id');
                            }}
                            className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer leading-normal"
                            title="Click to copy ID"
                          >
                            <span>#{displayId}</span>
                            {copiedId === displayId ? (
                              <Check size={11} className="text-slate-900" />
                            ) : (
                              <Copy size={11} className="text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Student (Clean text with clear line spacing) */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 leading-normal">
                              <span className="text-[13px] font-semibold text-slate-900">
                                {req.student?.name || req.studentName || 'Unknown Student'}
                              </span>
                              <VerifiedActivityBadge student={req.student} studentId={req.studentId} rollNumber={req.rollNumber} />
                              {req.student?.section && (
                                <span className="text-[10.5px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 leading-normal">
                                  {req.student.section}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 font-mono leading-normal">
                              <span>{req.student?.rollNumber || req.rollNumber || req.studentId}</span>
                              {req.student?.year && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-sans text-slate-500">{req.student.year}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="px-3.5 py-3 whitespace-nowrap align-middle">
                          <span className="text-[12px] font-medium text-slate-700 leading-normal">
                            {req.student?.department || req.department || '—'}
                          </span>
                        </td>

                        {/* Reason / Category */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <div className="space-y-0.5">
                            <span className="text-[12.5px] font-medium text-slate-800 block leading-normal">
                              {req.reasonLabel || REASON_LABELS[req.reason] || req.reason}
                            </span>
                            {req.description && (
                              <p className="text-[11.5px] text-slate-400 truncate max-w-[200px] leading-normal" title={req.description}>
                                {req.description}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Leave Schedule */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle">
                          <div className="space-y-0.5 text-[12px] leading-normal">
                            <span className="font-medium text-slate-900 block">
                              {formatDate(req.date)}
                              {isMultiDay && req.endDate && (
                                <span className="text-slate-500 font-normal"> → {formatDate(req.endDate)}</span>
                              )}
                            </span>
                            <span className="text-[11.5px] text-slate-500 block font-mono">
                              {periods && periods.length > 0 && periods.length < 8 ? (
                                `Periods ${periods.join(', ')}`
                              ) : req.startTime && req.endTime ? (
                                `${formatTime(req.startTime)} - ${formatTime(req.endTime)}`
                              ) : (
                                'Full Day'
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Assigned Reviewer */}
                        <td className="px-4 py-3 whitespace-nowrap align-middle text-[12px] leading-normal">
                          {req.faculties && req.faculties.length > 1 ? (
                            <span
                              className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 inline-block"
                              title={req.faculties.map((f: any) => f.name).join(', ')}
                            >
                              Multiple ({req.faculties.length})
                            </span>
                          ) : (
                            <span className="font-medium text-slate-800 block">
                              {req.faculties && req.faculties.length === 1
                                ? req.faculties[0].name
                                : req.faculty?.name || req.facultyName || req.primaryFaculty?.name || req.finalDecisionName || 'Direct / HOD'}
                            </span>
                          )}
                          {req.finalDecisionBy && (
                            <span className="text-[10.5px] text-slate-400 block">
                              By {req.finalDecisionBy}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3.5 py-3 whitespace-nowrap align-middle">
                          <CleanStatusBadge status={req.status} finalDecisionBy={req.finalDecisionBy} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap text-right align-middle" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectingRequest(req)}
                              title="Inspect Details"
                              className="h-[30px] px-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer leading-normal"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            {req.documentUrl && (
                              <a
                                href={req.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="View Document"
                                className="h-[30px] w-[30px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center justify-center transition-all"
                              >
                                <FileText size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Table Footer & Pagination ── */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-slate-600 leading-normal">
              <div className="flex items-center gap-3">
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 font-semibold">
                    {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-900 font-semibold">
                    {pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems)}
                  </strong>{' '}
                  of <strong className="text-slate-900 font-semibold">{totalItems}</strong> entries
                </span>

                <span className="text-slate-300">|</span>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={e => setPageSize(Number(e.target.value))}
                    className="h-[28px] px-2 text-[12px] bg-white border border-slate-300 text-slate-800 rounded outline-none cursor-pointer leading-normal"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={0}>All</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer leading-normal"
                  >
                    <ChevronLeft size={13} />
                    <span>Prev</span>
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                      if (currentPage > 3) {
                        pageNum = currentPage - 2 + i;
                      }
                      if (pageNum > totalPages) {
                        pageNum = totalPages - 4 + i;
                      }
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded text-[12px] font-semibold transition-all cursor-pointer leading-normal ${
                          currentPage === pageNum
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer leading-normal"
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Inspection Details Modal (Clean Layout with Zero Overlap) ── */}
        <Modal
          open={Boolean(inspectingRequest)}
          onClose={() => setInspectingRequest(null)}
          title="Attendance Request Audit Details"
          description="Metadata, leave schedule, and decision trail"
          size="lg"
        >
          {inspectingRequest && (
            <div className="space-y-4 pt-1 text-slate-900">
              {/* Header Info */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-[15px] font-bold text-slate-900 leading-normal">
                      {inspectingRequest.student?.name || inspectingRequest.studentName}
                    </h3>
                    <CleanStatusBadge status={inspectingRequest.status} finalDecisionBy={inspectingRequest.finalDecisionBy} />
                  </div>
                  <p className="text-[12.5px] text-slate-500 font-mono mt-1 leading-normal">
                    Roll No: {inspectingRequest.student?.rollNumber || inspectingRequest.rollNumber || inspectingRequest.studentId}
                  </p>
                </div>

                <div className="text-left sm:text-right sm:border-l sm:border-slate-200 sm:pl-4">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block leading-normal">
                    Reference ID
                  </span>
                  <span className="text-[13px] font-mono font-bold text-slate-800 leading-normal">
                    #{inspectingRequest.publicId || inspectingRequest.requestId || inspectingRequest.id}
                  </span>
                </div>
              </div>

              {/* Student Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[12.5px]">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block leading-normal">Department</span>
                  <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                    {inspectingRequest.student?.department || inspectingRequest.department || '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block leading-normal">Year / Semester</span>
                  <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                    {inspectingRequest.student?.year || (inspectingRequest.student?.semester ? `Sem ${inspectingRequest.student.semester}` : '—')}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block leading-normal">Section</span>
                  <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                    {inspectingRequest.student?.section || '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block leading-normal">Submitted At</span>
                  <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                    {formatSubmittedAt(inspectingRequest.submittedAt) || formatDate(inspectingRequest.date)}
                  </span>
                </div>
              </div>

              {/* Leave Timing & Schedule Details */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 leading-normal">
                  <Calendar size={14} className="text-slate-600" />
                  <span>Leave Schedule & Period Coverage</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-slate-500 text-[11.5px] block leading-normal">Requested Date(s)</span>
                    <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                      {formatDate(inspectingRequest.date)}
                      {inspectingRequest.endDate && inspectingRequest.endDate !== inspectingRequest.date && (
                        <span className="text-slate-600 font-normal"> to {formatDate(inspectingRequest.endDate)}</span>
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11.5px] block leading-normal">Time / Coverage</span>
                    <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                      {inspectingRequest.startTime && inspectingRequest.endTime
                        ? `${formatTime(inspectingRequest.startTime)} - ${formatTime(inspectingRequest.endTime)}`
                        : 'Full Day Permission'}
                    </span>
                  </div>
                </div>

                {/* Period Pills */}
                {(() => {
                  const periods = getPeriodsFromRequest(inspectingRequest);
                  if (periods && periods.length > 0) {
                    return (
                      <div className="pt-2.5 border-t border-slate-100">
                        <span className="text-slate-500 text-[11.5px] block mb-1.5 leading-normal">Affected Periods:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(p => {
                            const isIncluded = periods.includes(p);
                            return (
                              <span
                                key={p}
                                className={`text-[11.5px] font-medium px-2.5 py-0.5 rounded leading-normal ${
                                  isIncluded
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                Period {p}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Reason & Description */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 leading-normal">
                    <BookOpen size={14} className="text-slate-600" />
                    <span>Reason Statement</span>
                  </h4>
                  <span className="text-[11.5px] font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 leading-normal">
                    {inspectingRequest.reasonLabel || REASON_LABELS[inspectingRequest.reason] || inspectingRequest.reason}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {inspectingRequest.description || 'No detailed statement provided.'}
                </div>

                {/* Attached Document */}
                {inspectingRequest.documentUrl && (
                  <div className="pt-1 flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-600" />
                      <div>
                        <p className="text-[12.5px] font-medium text-slate-900 truncate max-w-[240px] leading-normal">
                          {inspectingRequest.documentName || 'Supporting_Document.pdf'}
                        </p>
                        <span className="text-[11px] text-slate-500 leading-normal">Attachment Proof</span>
                      </div>
                    </div>
                    <a
                      href={inspectingRequest.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-[30px] px-3 bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium rounded flex items-center gap-1.5 transition-all leading-normal"
                    >
                      <span>View File</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* Decision / Review Trail */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
                <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 leading-normal">
                  <User size={14} className="text-slate-600" />
                  <span>Review Audit</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12.5px]">
                  <div>
                    <span className="text-slate-500 text-[11px] block leading-normal">Assigned Faculty</span>
                    <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                      {inspectingRequest.faculty?.name || inspectingRequest.facultyName || inspectingRequest.primaryFaculty?.name || 'Not assigned'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block leading-normal">Decision Maker</span>
                    <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                      {inspectingRequest.finalDecisionName || inspectingRequest.finalDecisionBy || 'Pending'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block leading-normal">Reviewed At</span>
                    <span className="font-semibold text-slate-900 leading-normal mt-0.5 block">
                      {inspectingRequest.reviewedAt ? formatSubmittedAt(inspectingRequest.reviewedAt) : 'Awaiting Review'}
                    </span>
                  </div>
                </div>

                {/* Rejection remarks */}
                {inspectingRequest.rejectionReason && (
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded text-[12.5px] text-slate-800 leading-normal">
                    <span className="font-bold block text-slate-900 mb-1">Rejection Remarks:</span>
                    {inspectingRequest.rejectionReason}
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(inspectingRequest, null, 2), 'json')}
                    className="h-[34px] px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer leading-normal"
                  >
                    {copiedJson ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedJson ? 'JSON Copied' : 'Copy JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = inspectingRequest.shareUrl || `${window.location.origin}/verify/${inspectingRequest.publicId || inspectingRequest.id}`;
                      handleCopy(shareUrl, 'link');
                    }}
                    className="h-[34px] px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer leading-normal"
                  >
                    {copiedLink ? <Check size={13} /> : <LinkIcon size={13} />}
                    <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingRequest(null)}
                  className="h-[34px] px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-[12.5px] font-medium transition-all cursor-pointer leading-normal"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </PageWrapper>
  );
}
