import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  RotateCw,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { formatDate, formatTimeAgo, formatSubmittedAt, formatTime } from '../../lib/utils';
import type { AttendanceRequest, RequestStatus } from '../../types';

type FilterValue = RequestStatus | 'all';

// Deterministic initial color generator for faculty avatars
const AVATAR_BG_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Pink
];

function getFacultyInitials(name: string): string {
  if (!name || name === '—') return 'FA';
  const clean = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function getAssignedFacultyDisplay(req: api.AttendanceRequest): string {
  if (req.faculties && req.faculties.length > 0) {
    const names = Array.from(new Set(req.faculties.map(f => f.name).filter(Boolean)));
    if (names.length > 0) return names.join(', ');
  }
  return req.faculty?.name || (req as any).facultyName || '—';
}

function getFacultyRole(req: api.AttendanceRequest): string {
  if (req.faculty?.designation) return req.faculty.designation;
  if (req.faculty?.role) return req.faculty.role;
  if (req.faculty?.department) return `${req.faculty.department} Department`;
  // Fallbacks from typical college structure
  const name = getAssignedFacultyDisplay(req);
  if (name.includes('Aneela')) return 'Assistant Professor';
  if (name.includes('Satya Trinadh')) return 'Department Mentor';
  return 'Department Mentor';
}

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  if (norm === 'approved' || norm === 'present') {
    return (
      <span className="status-badge approved">
        <span className="status-dot green" />
        Approved
      </span>
    );
  }
  if (norm === 'rejected' || norm === 'absent') {
    return (
      <span className="status-badge rejected">
        <span className="status-dot red" />
        Rejected
      </span>
    );
  }
  if (norm === 'pending' || norm === 'late') {
    return (
      <span className="status-badge pending">
        <span className="status-dot amber" />
        Pending
      </span>
    );
  }
  return (
    <span className="status-badge excused">
      <span className="status-dot blue" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const {
    data: studentRequests = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['requests'],
    queryFn: api.getRequests,
  });

  // Calculate dynamic KPI counts & rates directly from actual data
  const { totalCount, approvedCount, pendingCount, rejectedCount, approvedRate, rejectedRate } = useMemo(() => {
    const total = studentRequests.length;
    const approved = studentRequests.filter(r => r.status === 'approved').length;
    const pending = studentRequests.filter(r => r.status === 'pending').length;
    const rejected = studentRequests.filter(r => r.status === 'rejected').length;

    const appRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0';
    const rejRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0';

    return {
      totalCount: total,
      approvedCount: approved,
      pendingCount: pending,
      rejectedCount: rejected,
      approvedRate: appRate,
      rejectedRate: rejRate,
    };
  }, [studentRequests]);

  // Unique subjects for the filter dropdown
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    studentRequests.forEach(req => {
      if (req.reasonLabel) set.add(req.reasonLabel);
    });
    return Array.from(set).sort();
  }, [studentRequests]);

  // Filtered dataset
  const filtered = useMemo(() => {
    return studentRequests.filter(req => {
      const matchStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchSubject = subjectFilter === 'all' || req.reasonLabel === subjectFilter;
      const q = searchQuery.toLowerCase().trim();
      const facultyStr = getAssignedFacultyDisplay(req).toLowerCase();
      const matchSearch =
        !q ||
        (req.reasonLabel && req.reasonLabel.toLowerCase().includes(q)) ||
        (req.description && req.description.toLowerCase().includes(q)) ||
        (req.date && req.date.includes(q)) ||
        facultyStr.includes(q);

      return matchStatus && matchSubject && matchSearch;
    });
  }, [studentRequests, statusFilter, subjectFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRequests = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, activePage, pageSize]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('all');
    setSubjectFilter('all');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ['#', 'Date', 'Subject', 'Purpose / Description', 'Faculty', 'Role', 'Status', 'Submitted At'];
    const rows = filtered.map((req, i) => [
      i + 1,
      formatDate(req.date),
      `"${(req.reasonLabel || '').replace(/"/g, '""')}"`,
      `"${(req.description || 'Regular Lab Session').replace(/"/g, '""')}"`,
      `"${getAssignedFacultyDisplay(req).replace(/"/g, '""')}"`,
      `"${getFacultyRole(req).replace(/"/g, '""')}"`,
      req.status.toUpperCase(),
      `"${formatSubmittedAt(req.submittedAt).replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendease_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageWrapper role="student">
      <div className="history-page-root">
        {/* ── Page Header ── */}
        <div className="history-page-header">
          <div className="title-group">
            <h1 className="main-title">
              All Requests <span className="total-badge">{totalCount} Total</span>
            </h1>
            <p className="main-subtitle">
              Your complete attendance permission history and approval records.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className={`icon-action-btn ${isFetching ? 'spin' : ''}`}
              onClick={() => refetch()}
              title="Refresh attendance records"
              aria-label="Refresh"
            >
              <RotateCw size={17} />
            </button>

            <button
              type="button"
              className="export-btn"
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              title="Export records to CSV"
            >
              <FileSpreadsheet size={16} className="excel-icon" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="new-request-btn"
              onClick={() => navigate('/student/new-request')}
            >
              <Plus size={17} strokeWidth={2.4} />
              <span>New Request</span>
            </button>
          </div>
        </div>

        {/* ── 4 KPI Summary Cards (Pastel Fills from Case Study) ── */}
        <div className="kpi-grid">
          {/* Card 1: TOTAL REQUESTS */}
          <div className="kpi-card total-card">
            <div className="kpi-top">
              <span className="kpi-label">TOTAL REQUESTS</span>
              <div className="kpi-icon-wrap total-icon">
                <Layers size={18} />
              </div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-value">{isLoading ? '—' : totalCount}</span>
              <span className="kpi-pill total-pill">100% History</span>
            </div>
          </div>

          {/* Card 2: APPROVED */}
          <div className="kpi-card approved-card">
            <div className="kpi-top">
              <span className="kpi-label">APPROVED</span>
              <div className="kpi-icon-wrap approved-icon">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-value approved-value">{isLoading ? '—' : approvedCount}</span>
              <span className="kpi-pill approved-pill">{approvedRate}% Rate</span>
            </div>
          </div>

          {/* Card 3: PENDING */}
          <div className="kpi-card pending-card">
            <div className="kpi-top">
              <span className="kpi-label">PENDING</span>
              <div className="kpi-icon-wrap pending-icon">
                <Clock size={18} />
              </div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-value pending-value">{isLoading ? '—' : pendingCount}</span>
              <span className="kpi-pill pending-pill">In Review</span>
            </div>
          </div>

          {/* Card 4: REJECTED */}
          <div className="kpi-card rejected-card">
            <div className="kpi-top">
              <span className="kpi-label">REJECTED</span>
              <div className="kpi-icon-wrap rejected-icon">
                <XCircle size={18} />
              </div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-value rejected-value">{isLoading ? '—' : rejectedCount}</span>
              <span className="kpi-pill rejected-pill">{rejectedRate}% Rate</span>
            </div>
          </div>
        </div>

        {/* ── Main Permission Records Card ── */}
        <div className="records-card">
          {/* Section Header with Inline Search Toolbar */}
          <div className="records-header-row">
            <div className="records-title-wrap">
              <h2 className="records-title">Permission Records</h2>
              <span className="records-caption">Official student attendance log</span>
            </div>

            {/* Search and Filters Toolbar */}
            <form className="search-toolbar" onSubmit={handleSearchSubmit}>
              {/* Search input with magnifying glass */}
              <div className="search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-field"
                  placeholder="Search subjects or faculty..."
                  value={searchInput}
                  onChange={e => {
                    setSearchInput(e.target.value);
                    if (e.target.value === '') {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                />
              </div>

              {/* Primary Orange Search Button */}
              <button type="submit" className="search-submit-btn">
                Search
              </button>

              {/* Status Filter Dropdown */}
              <div className="filter-select-wrap">
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value as FilterValue);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Status"
                >
                  <option value="all">All Statuses ({totalCount})</option>
                  <option value="approved">Approved ({approvedCount})</option>
                  <option value="pending">Pending ({pendingCount})</option>
                  <option value="rejected">Rejected ({rejectedCount})</option>
                </select>
                <Filter size={13} className="filter-arrow-icon" />
              </div>

              {/* Subject Filter (if multiple subjects exist) */}
              {uniqueSubjects.length > 1 && (
                <div className="filter-select-wrap subject-filter-select">
                  <select
                    className="filter-select"
                    value={subjectFilter}
                    onChange={e => {
                      setSubjectFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Filter by Subject"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  <Filter size={13} className="filter-arrow-icon" />
                </div>
              )}
            </form>
          </div>

          {/* ── Table Content / States ── */}
          {isLoading ? (
            /* Skeleton Loading State */
            <div className="loading-state-container">
              <div className="table-skeleton">
                <div className="skeleton-row skeleton-header" />
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="skeleton-row" />
                ))}
              </div>
            </div>
          ) : isError ? (
            /* Error State */
            <div className="empty-state-wrap error-state">
              <div className="empty-icon-circle red-tint">
                <AlertCircle size={32} color="#DC2626" />
              </div>
              <h3 className="empty-title">Failed to load attendance records</h3>
              <p className="empty-subtitle">
                {(error as Error)?.message || 'A network error occurred while connecting to the AttendEase server.'}
              </p>
              <button
                type="button"
                className="clear-filter-btn"
                onClick={() => refetch()}
              >
                Try Again
              </button>
            </div>
          ) : studentRequests.length === 0 ? (
            /* Empty History State */
            <div className="empty-state-wrap">
              <div className="empty-icon-circle orange-tint">
                <Calendar size={32} color="#F28C38" />
              </div>
              <h3 className="empty-title">No attendance records available yet.</h3>
              <p className="empty-subtitle">
                Once you submit permission requests or attend recorded sessions, your verified records will appear here.
              </p>
              <button
                type="button"
                className="new-request-btn"
                style={{ margin: '14px auto 0' }}
                onClick={() => navigate('/student/new-request')}
              >
                <Plus size={16} />
                <span>Submit Your First Request</span>
              </button>
            </div>
          ) : filtered.length === 0 ? (
            /* No Search Results State */
            <div className="empty-state-wrap">
              <div className="empty-icon-circle gray-tint">
                <Search size={30} color="#94A3B8" />
              </div>
              <h3 className="empty-title">No records match your search or selected filters.</h3>
              <p className="empty-subtitle">
                Try searching with a different term, or reset the status filters to view all entries.
              </p>
              <button
                type="button"
                className="clear-filter-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            /* ── Data Table with 3px Status Indicators ── */
            <div className="table-responsive-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th className="col-sl">SL NO.</th>
                    <th className="col-date">DATE &amp; SUBMISSION</th>
                    <th className="col-subject">SUBJECT / PURPOSE</th>
                    <th className="col-faculty">APPROVING FACULTY</th>
                    <th className="col-status">STATUS</th>
                    <th className="col-action">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((req, index) => {
                    const rowNumber = (activePage - 1) * pageSize + index + 1;
                    const facultyName = getAssignedFacultyDisplay(req);
                    const facultyInitials = getFacultyInitials(facultyName);
                    const facultyBg = getAvatarBg(facultyName);
                    const facultyRole = getFacultyRole(req);
                    const relativeTime = formatTimeAgo(req.submittedAt);
                    const statusClass = `indicator-${req.status.toLowerCase()}`;

                    return (
                      <motion.tr
                        key={req.id}
                        className={`table-row ${statusClass}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02, duration: 0.18 }}
                        onClick={() => navigate(`/student/request/${req.id}`)}
                      >
                        {/* 1. SL NO. */}
                        <td className="col-sl">
                          <span className="sl-number">{rowNumber}</span>
                        </td>

                        {/* 2. DATE & SUBMISSION */}
                        <td className="col-date">
                          <div className="primary-date">{formatDate(req.date)}</div>
                          <div className="secondary-sub">
                            {relativeTime ? `Submitted ${relativeTime}` : formatSubmittedAt(req.submittedAt) || 'Recorded'}
                          </div>
                        </td>

                        {/* 3. SUBJECT / PURPOSE */}
                        <td className="col-subject">
                          <span className="subject-pill">
                            {req.reasonLabel || 'General Attendance'}
                          </span>
                          <div className="purpose-sub" title={req.description}>
                            {req.description
                              ? req.description
                              : req.periods
                              ? `Periods: ${req.periods}`
                              : req.startTime && req.endTime
                              ? `${formatTime(req.startTime)} - ${formatTime(req.endTime)}`
                              : 'Regular Lab Session'}
                          </div>
                        </td>

                        {/* 4. APPROVING FACULTY */}
                        <td className="col-faculty">
                          <div className="faculty-cell">
                            <div
                              className="faculty-avatar"
                              style={{ backgroundColor: facultyBg }}
                              aria-hidden="true"
                            >
                              {facultyInitials}
                            </div>
                            <div className="faculty-details">
                              <span className="faculty-name" title={facultyName}>
                                {facultyName}
                              </span>
                              <span className="faculty-role">
                                {facultyRole}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 5. STATUS */}
                        <td className="col-status">
                          <StatusBadge status={req.status} />
                        </td>

                        {/* 6. ACTION */}
                        <td className="col-action" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="view-link-btn"
                            onClick={() => navigate(`/student/request/${req.id}`)}
                            title="View request details"
                          >
                            <span>View Details</span>
                            <ArrowRight size={14} className="view-arrow" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Table Footer & Pagination ── */}
          {!isLoading && filtered.length > 0 && (
            <div className="table-footer">
              <span className="entries-info">
                Showing {(activePage - 1) * pageSize + 1} to{' '}
                {Math.min(activePage * pageSize, filtered.length)} of {filtered.length} entries
              </span>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={activePage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 5) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - activePage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevVal = arr[idx - 1];
                    const showEllipsis = prevVal && p - prevVal > 1;
                    return (
                      <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {showEllipsis && <span className="pagination-ellipsis">...</span>}
                        <button
                          type="button"
                          className={`page-num-btn ${p === activePage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={activePage === totalPages}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Scoped Styling System (Enterprise UI Standards) ── */}
      <style>{`
        /* Root container */
        .history-page-root {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1F2937;
        }

        /* ── Header ── */
        .history-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 22px;
        }
        .title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .main-title {
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          letter-spacing: -0.02em;
        }
        .total-badge {
          font-size: 13px;
          font-weight: 700;
          background: #E2E8F0;
          color: #475569;
          padding: 3px 12px;
          border-radius: 999px;
          letter-spacing: normal;
        }
        .main-subtitle {
          font-size: 14px;
          color: #64748B;
          margin: 0;
        }

        /* Action Buttons */
        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .icon-action-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .icon-action-btn:hover {
          border-color: #CBD5E1;
          color: #F28C38;
          background: #FFF7ED;
          transform: translateY(-1px);
        }
        .icon-action-btn.spin svg {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .export-btn {
          height: 40px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #334155;
          font-size: 13.5px;
          font-weight: 650;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .export-btn:hover:not(:disabled) {
          border-color: #10B981;
          background: #F0FDF4;
          color: #065F46;
          transform: translateY(-1px);
        }
        .export-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .excel-icon {
          color: #10B981;
        }

        .new-request-btn {
          height: 40px;
          padding: 0 18px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #F28C38 0%, #EA580C 100%);
          color: #FFFFFF;
          font-size: 13.5px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(242, 140, 56, 0.35);
          transition: all 0.18s ease;
        }
        .new-request-btn:hover {
          opacity: 0.94;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(242, 140, 56, 0.45);
        }

        /* ── KPI Grid ── */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .kpi-card {
          border-radius: 16px;
          padding: 18px 20px;
          border: 1px solid transparent;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 110px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
        }
        .kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .kpi-label {
          font-size: 11.5px;
          font-weight: 750;
          letter-spacing: 0.05em;
          color: #64748B;
        }
        .kpi-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kpi-bottom {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .kpi-value {
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
          color: #0F172A;
          letter-spacing: -0.03em;
        }
        .kpi-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          white-space: nowrap;
        }

        /* 1. Total KPI (Slate/Pastel Gray) */
        .total-card {
          background: #EEF2F6;
          border-color: #E2E8F0;
        }
        .total-icon {
          background: rgba(100, 116, 139, 0.12);
          color: #475569;
        }
        .total-pill {
          background: #E2E8F0;
          color: #475569;
        }

        /* 2. Approved KPI (Mint Pastel) */
        .approved-card {
          background: #E6F9F0;
          border-color: #BBF7D0;
        }
        .approved-card .kpi-label {
          color: #065F46;
        }
        .approved-icon {
          background: rgba(5, 150, 105, 0.14);
          color: #059669;
        }
        .approved-value {
          color: #047857;
        }
        .approved-pill {
          background: rgba(5, 150, 105, 0.15);
          color: #065F46;
        }

        /* 3. Pending KPI (Amber Pastel) */
        .pending-card {
          background: #FEF9C3;
          border-color: #FDE68A;
        }
        .pending-card .kpi-label {
          color: #92400E;
        }
        .pending-icon {
          background: rgba(217, 119, 6, 0.14);
          color: #D97706;
        }
        .pending-value {
          color: #B45309;
        }
        .pending-pill {
          background: rgba(217, 119, 6, 0.15);
          color: #92400E;
        }

        /* 4. Rejected KPI (Rose Pastel) */
        .rejected-card {
          background: #FFE4E6;
          border-color: #FECACA;
        }
        .rejected-card .kpi-label {
          color: #991B1B;
        }
        .rejected-icon {
          background: rgba(220, 38, 38, 0.14);
          color: #DC2626;
        }
        .rejected-value {
          color: #B91C1C;
        }
        .rejected-pill {
          background: rgba(220, 38, 38, 0.15);
          color: #991B1B;
        }

        /* ── Records Card ── */
        .records-card {
          background: #FFFFFF;
          border-radius: 18px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          overflow: hidden;
          box-sizing: border-box;
        }
        .records-header-row {
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #F1F5F9;
          flex-wrap: wrap;
        }
        .records-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .records-title {
          font-size: 19px;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .records-caption {
          font-size: 12.5px;
          color: #94A3B8;
        }

        /* Search toolbar */
        .search-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .search-input-wrap {
          position: relative;
          min-width: 240px;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94A3B8;
          pointer-events: none;
        }
        .search-field {
          width: 100%;
          height: 38px;
          padding: 0 14px 0 36px;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 9px;
          font-size: 13px;
          color: #1E293B;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .search-field:focus {
          border-color: #F28C38;
          background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(242, 140, 56, 0.12);
        }
        .search-submit-btn {
          height: 38px;
          padding: 0 16px;
          background: #F28C38;
          color: #FFFFFF;
          border: none;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .search-submit-btn:hover {
          background: #E57A24;
          box-shadow: 0 2px 8px rgba(242, 140, 56, 0.3);
        }

        .filter-select-wrap {
          position: relative;
        }
        .filter-select {
          height: 38px;
          padding: 0 32px 0 12px;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          outline: none;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .filter-select:focus {
          border-color: #F28C38;
          box-shadow: 0 0 0 3px rgba(242, 140, 56, 0.12);
        }
        .filter-arrow-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94A3B8;
          pointer-events: none;
        }

        /* ── Data Table ── */
        .table-responsive-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
          min-width: 820px;
        }
        .attendance-table thead {
          background: #FAFBFD;
          border-bottom: 1px solid #EDF2F7;
        }
        .attendance-table th {
          padding: 13px 18px;
          font-size: 11.5px;
          font-weight: 750;
          color: #64748B;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .attendance-table td {
          padding: 15px 18px;
          border-bottom: 1px solid #F1F5F9;
          vertical-align: middle;
        }

        /* Row Indicator Strips (3.5px colored border matching status) */
        .table-row {
          cursor: pointer;
          transition: background 0.12s ease;
          background: #FFFFFF;
        }
        .table-row:hover {
          background: #F8FAFC;
        }
        .table-row.indicator-approved {
          border-left: 3.5px solid #10B981;
        }
        .table-row.indicator-pending {
          border-left: 3.5px solid #F59E0B;
        }
        .table-row.indicator-rejected {
          border-left: 3.5px solid #EF4444;
        }
        .table-row.indicator-excused {
          border-left: 3.5px solid #3B82F6;
        }

        /* Column Specifics */
        .col-sl {
          width: 65px;
          text-align: center;
        }
        .sl-number {
          font-weight: 750;
          color: #1E293B;
          font-size: 13.5px;
        }

        .col-date {
          width: 170px;
          white-space: nowrap;
        }
        .primary-date {
          font-weight: 700;
          color: #1E293B;
          font-size: 13.5px;
        }
        .secondary-sub {
          font-size: 12px;
          color: #94A3B8;
          margin-top: 3px;
        }

        .col-subject {
          width: 240px;
        }
        .subject-pill {
          display: inline-block;
          background: #EEF2FF;
          border: 1px solid #E0E7FF;
          color: #4F46E5;
          font-size: 12.5px;
          font-weight: 650;
          padding: 3px 10px;
          border-radius: 7px;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .purpose-sub {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
          max-width: 230px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .col-faculty {
          width: 230px;
        }
        .faculty-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .faculty-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 750;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }
        .faculty-details {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .faculty-name {
          font-size: 13px;
          font-weight: 650;
          color: #1E293B;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .faculty-role {
          font-size: 11.5px;
          color: #64748B;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .col-status {
          width: 130px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .status-badge.approved {
          background: #DCFCE7;
          border: 1px solid #BBF7D0;
          color: #15803D;
        }
        .status-dot.green {
          background: #16A34A;
        }

        .status-badge.pending {
          background: #FEF3C7;
          border: 1px solid #FDE68A;
          color: #B45309;
        }
        .status-dot.amber {
          background: #D97706;
        }

        .status-badge.rejected {
          background: #FEE2E2;
          border: 1px solid #FECACA;
          color: #B91C1C;
        }
        .status-dot.red {
          background: #DC2626;
        }

        .status-badge.excused {
          background: #DBEAFE;
          border: 1px solid #BFDBFE;
          color: #1D4ED8;
        }
        .status-dot.blue {
          background: #2563EB;
        }

        .col-action {
          width: 130px;
          text-align: right;
        }
        .view-link-btn {
          background: transparent;
          border: none;
          color: #475569;
          font-size: 13px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }
        .view-link-btn:hover {
          color: #F28C38;
          background: #FFF7ED;
        }
        .view-link-btn:hover .view-arrow {
          transform: translateX(3px);
        }
        .view-arrow {
          transition: transform 0.15s ease;
        }

        /* ── Table Footer & Pagination ── */
        .table-footer {
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #F1F5F9;
          gap: 16px;
          flex-wrap: wrap;
        }
        .entries-info {
          font-size: 13px;
          font-weight: 550;
          color: #64748B;
        }
        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .page-nav-btn {
          height: 34px;
          padding: 0 12px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #475569;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .page-nav-btn:hover:not(:disabled) {
          border-color: #CBD5E1;
          color: #1E293B;
          background: #F8FAFC;
        }
        .page-nav-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .page-num-btn {
          min-width: 34px;
          height: 34px;
          padding: 0 8px;
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #475569;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .page-num-btn:hover:not(.active) {
          background: #F8FAFC;
          border-color: #CBD5E1;
        }
        .page-num-btn.active {
          background: #F28C38;
          border-color: #F28C38;
          color: #FFFFFF;
          box-shadow: 0 2px 6px rgba(242, 140, 56, 0.35);
        }
        .pagination-ellipsis {
          padding: 0 4px;
          color: #94A3B8;
          font-size: 13px;
        }

        /* ── States (Empty, Loading, Error) ── */
        .empty-state-wrap {
          text-align: center;
          padding: 56px 20px;
          max-width: 440px;
          margin: 0 auto;
        }
        .empty-icon-circle {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .empty-icon-circle.orange-tint {
          background: #FFF7ED;
          border: 1px solid #FFEDD5;
        }
        .empty-icon-circle.gray-tint {
          background: #F1F5F9;
          border: 1px solid #E2E8F0;
        }
        .empty-icon-circle.red-tint {
          background: #FEF2F2;
          border: 1px solid #FEE2E2;
        }
        .empty-title {
          font-size: 16px;
          font-weight: 750;
          color: #1E293B;
          margin: 0 0 6px;
        }
        .empty-subtitle {
          font-size: 13.5px;
          color: #64748B;
          line-height: 1.5;
          margin: 0;
        }
        .clear-filter-btn {
          margin-top: 18px;
          height: 36px;
          padding: 0 16px;
          background: #FFF7ED;
          border: 1px solid #FED7AA;
          color: #EA580C;
          font-size: 13px;
          font-weight: 650;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .clear-filter-btn:hover {
          background: #FFEDD5;
        }

        /* Skeleton Loading */
        .loading-state-container {
          padding: 24px;
        }
        .table-skeleton {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .skeleton-row {
          height: 48px;
          border-radius: 8px;
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .skeleton-row.skeleton-header {
          height: 38px;
          background: #F8FAFC;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Responsive Media Queries ── */
        @media screen and (max-width: 1024px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .search-toolbar {
            width: 100%;
            justify-content: flex-start;
          }
          .search-input-wrap {
            flex: 1;
            min-width: 200px;
          }
        }

        @media screen and (max-width: 640px) {
          .history-page-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .header-actions {
            width: 100%;
            justify-content: space-between;
          }
          .new-request-btn {
            flex: 1;
            justify-content: center;
          }
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .kpi-card {
            padding: 14px;
            min-height: 94px;
          }
          .kpi-value {
            font-size: 26px;
          }
          .kpi-label {
            font-size: 10px;
          }
          .kpi-pill {
            font-size: 10px;
            padding: 2px 7px;
          }
          .records-header-row {
            padding: 16px;
          }
          .search-toolbar {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
          }
          .search-input-wrap,
          .filter-select-wrap,
          .filter-select,
          .search-submit-btn {
            width: 100%;
          }
          .table-footer {
            flex-direction: column;
            align-items: center;
            padding: 16px;
          }
        }
      `}</style>
    </PageWrapper>
  );
}

