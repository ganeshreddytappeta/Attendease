import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  Key,
  Users,
  Briefcase,
  Rocket,
  Code,
  Trophy,
  Award,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  CheckSquare,
  Square,
  UserPlus,
  User,
  Mail
} from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { EmptyState } from '../../components/shared/EmptyState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import type { StudentActivity, ActivityCategory, ActivityAuditLog } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  filterStudentActivities,
  getStudentActivityCompanies,
  getStudentActivityTypes,
  STUDENT_ACTIVITY_FILTERS,
} from '../../config/studentActivityOptions';

interface StudentActivitiesPageProps {
  role?: 'faculty' | 'hod' | 'admin';
}

const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; icon: any; color: string; bg: string; border: string }> = {
  internship:   { label: 'Internship', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  startup:      { label: 'Startups', icon: Rocket, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  project_work: { label: 'Project Work', icon: Code, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  sports:       { label: 'Sports', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  house_events: { label: 'House Events', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

function StudentStatusDot({ status }: { status?: string | null }) {
  const normalized = status?.toLowerCase();
  const isActive = !status || normalized === 'active';

  if (!isActive) return null;

  return (
    <span
      className="student-status-dot"
      role="img"
      aria-label="Active student"
    />
  );
}

export default function StudentActivitiesPage({ role = 'faculty' }: StudentActivitiesPageProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActivityCategory | 'all'>('internship');
  const [companyFilter, setCompanyFilter] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Selected row IDs for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Coordinator Session Code State (Keyed by category)
  const [coordinatorCodes, setCoordinatorCodes] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem('attendease_coord_codes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingActionCategory, setPendingActionCategory] = useState<ActivityCategory>('internship');
  const [authInputCode, setAuthInputCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingCallback, setPendingCallback] = useState<((code: string) => void) | null>(null);

  // Add / Edit Modal State
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<StudentActivity | null>(null);
  
  // Roster Student Search State inside Add Modal
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Form Payload State
  const [formCategory, setFormCategory] = useState<ActivityCategory>('internship');
  const [formTitle, setFormTitle] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formMentor, setFormMentor] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  // Bulk Add Modal State
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkSelectedStudentIds, setBulkSelectedStudentIds] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');

  // Bulk Remove Modal State
  const [isBulkRemoveModalOpen, setIsBulkRemoveModalOpen] = useState(false);

  // Single Delete Confirmation Modal
  const [deletingActivity, setDeletingActivity] = useState<StudentActivity | null>(null);

  // Student Profile & Activity Details Modal
  const [profileModalActivity, setProfileModalActivity] = useState<StudentActivity | null>(null);

  // Feedback Toasts
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Save coordinator codes to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('attendease_coord_codes', JSON.stringify(coordinatorCodes));
    } catch {}
  }, [coordinatorCodes]);

  // Data Queries
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['student-activities', activeTab, search, statusFilter],
    queryFn: () => api.getStudentActivities({ category: activeTab, search, status: statusFilter }),
  });
  const selectedCategory: ActivityCategory = activeTab === 'all' ? 'internship' : activeTab;
  const companyOptions = useMemo(
    () => getStudentActivityCompanies(activeTab),
    [activeTab],
  );
  const activityTypeOptions = useMemo(
    () => getStudentActivityTypes(selectedCategory, companyFilter),
    [selectedCategory, companyFilter],
  );
  const filteredActivities = useMemo(
    () => filterStudentActivities(activities, activeTab, companyFilter, activityTypeFilter),
    [activities, activeTab, companyFilter, activityTypeFilter],
  );

  const { data: rosterStudents = [] } = useQuery({
    queryKey: ['students-roster'],
    queryFn: async () => {
      try {
        const users = await api.getUsers('student');
        return users;
      } catch {
        return [];
      }
    },
    enabled: isAddEditModalOpen || isBulkAddModalOpen,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['activity-audit-logs', activeTab],
    queryFn: () => api.getActivityAuditLogs(activeTab),
    enabled: showAuditLogs,
  });

  // Fetch Coordinator Assignments for current logged-in user
  const { data: myAssignments = { success: true, isAdmin: false, categories: [] } } = useQuery({
    queryKey: ['my-coordinator-assignments'],
    queryFn: () => api.getMyCoordinatorAssignments(),
  });

  // Filter Roster Students for Single & Bulk Selection
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return rosterStudents.slice(0, 10);
    const q = rosterSearch.toLowerCase().trim();
    return rosterStudents.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.rollNumber || s.userId || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [rosterStudents, rosterSearch]);

  const filteredBulkRoster = useMemo(() => {
    if (!bulkSearch.trim()) return rosterStudents;
    const q = bulkSearch.toLowerCase().trim();
    return rosterStudents.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.rollNumber || s.userId || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }, [rosterStudents, bulkSearch]);

  // Execute an action requiring Coordinator Code verification
  const executeProtectedAction = (targetCategory: ActivityCategory, actionCallback: (code?: string) => void) => {
    // Admins bypass code verification
    if (user?.role === 'admin' || myAssignments.isAdmin) {
      actionCallback();
      return;
    }

    // Strict Authorization check: user MUST be an assigned coordinator for targetCategory
    if (!myAssignments.categories.includes(targetCategory)) {
      showToast('error', `Access Denied: You are not assigned as a Coordinator for ${CATEGORY_CONFIG[targetCategory]?.label || targetCategory}. Only assigned coordinators can modify data.`);
      return;
    }

    // Check if we already have a valid session code for this category
    const existingCode = coordinatorCodes[targetCategory];
    if (existingCode) {
      actionCallback(existingCode);
      return;
    }

    // Prompt for code
    setPendingActionCategory(targetCategory);
    setAuthInputCode('');
    setAuthError('');
    setPendingCallback(() => actionCallback);
    setIsAuthModalOpen(true);
  };

  // Submit Authorization Code Modal
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInputCode.trim()) {
      setAuthError('Please enter a valid Coordinator Code.');
      return;
    }

    try {
      setAuthError('');
      const res = await api.verifyCoordinatorCode(pendingActionCategory, authInputCode.trim());
      if (res.authorized) {
        // Save code in session state
        setCoordinatorCodes(prev => ({ ...prev, [pendingActionCategory]: authInputCode.trim() }));
        setIsAuthModalOpen(false);
        if (pendingCallback) {
          pendingCallback(authInputCode.trim());
          setPendingCallback(null);
        }
      } else {
        setAuthError('Invalid or unauthorized code for this category.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Invalid Coordinator Code.');
    }
  };

  // Reset Add/Edit Form
  const resetForm = () => {
    setEditingActivity(null);
    setSelectedStudent(null);
    setRosterSearch('');
    setFormTitle('');
    setFormRole('');
    setFormMentor('');
    setFormStartDate('');
    setFormEndDate('');
    setFormStatus('active');
  };

  const openAddModal = (cat: ActivityCategory = activeTab === 'all' ? 'internship' : activeTab) => {
    resetForm();
    setFormCategory(cat);
    executeProtectedAction(cat, () => {
      setIsAddEditModalOpen(true);
    });
  };

  const openEditModal = (act: StudentActivity) => {
    resetForm();
    setEditingActivity(act);
    setFormCategory(act.category);
    setSelectedStudent(act.student);
    setFormTitle(act.titleOrCompany || '');
    setFormRole(act.roleOrPosition || '');
    setFormMentor(act.mentorOrAchievement || '');
    setFormStartDate(act.startDate || '');
    setFormEndDate(act.endDate || '');
    setFormStatus(act.status || 'active');

    executeProtectedAction(act.category, () => {
      setIsAddEditModalOpen(true);
    });
  };

  const openDeleteModal = (act: StudentActivity) => {
    setDeletingActivity(act);
  };

  // Save Activity Mutation
  const saveActivityMutation = useMutation({
    mutationFn: async ({ code }: { code?: string }) => {
      const activeCode = code || coordinatorCodes[formCategory];
      if (editingActivity) {
        return api.updateStudentActivity(editingActivity.id, {
          titleOrCompany: formTitle,
          roleOrPosition: formRole,
          mentorOrAchievement: formMentor,
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus,
          coordinatorCode: activeCode,
        });
      } else {
        if (!selectedStudent) throw new Error('Please select a student from the roster.');
        return api.addStudentActivity({
          studentId: selectedStudent.userId || selectedStudent.id,
          category: formCategory,
          titleOrCompany: formTitle,
          roleOrPosition: formRole,
          mentorOrAchievement: formMentor,
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus,
          coordinatorCode: activeCode,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-activities'] });
      setIsAddEditModalOpen(false);
      resetForm();
      showToast('success', editingActivity ? 'Activity record updated successfully.' : 'Student added to activity successfully.');
    },
    onError: (err: any) => {
      showToast('error', err.message || 'Failed to save activity record.');
    }
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity && !selectedStudent) {
      showToast('error', 'Please select a student.');
      return;
    }
    if (!formTitle.trim()) {
      showToast('error', 'Please enter Title / Company / Event Name.');
      return;
    }
    executeProtectedAction(formCategory, (code) => {
      saveActivityMutation.mutate({ code });
    });
  };

  // Remove Activity Mutation
  const removeActivityMutation = useMutation({
    mutationFn: async (act: StudentActivity) => {
      const activeCode = coordinatorCodes[act.category];
      return api.removeStudentActivity(act.id, activeCode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-activities'] });
      setDeletingActivity(null);
      showToast('success', 'Student removed from category. Master student record remains intact.');
    },
    onError: (err: any) => {
      showToast('error', err.message || 'Failed to remove student from activity.');
    }
  });

  const confirmDelete = () => {
    if (!deletingActivity) return;
    executeProtectedAction(deletingActivity.category, () => {
      removeActivityMutation.mutate(deletingActivity);
    });
  };

  // Bulk Operations Handlers
  const toggleSelectAll = () => {
    const visibleIds = filteredActivities.map(activity => activity.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Bulk Remove Mutation
  const bulkRemoveMutation = useMutation({
    mutationFn: async () => {
      const activeCat = activeTab === 'all' ? 'internship' : activeTab;
      const activeCode = coordinatorCodes[activeCat];
      return api.bulkRemoveStudentActivities(selectedIds, activeCode);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['student-activities'] });
      setIsBulkRemoveModalOpen(false);
      setSelectedIds([]);
      showToast('success', res.message || `Removed ${res.removedCount} students from category.`);
    },
    onError: (err: any) => {
      showToast('error', err.message || 'Failed to perform bulk removal.');
    }
  });

  // Bulk Add Mutation
  const bulkAddMutation = useMutation({
    mutationFn: async ({ code }: { code?: string }) => {
      const activeCat = activeTab === 'all' ? 'internship' : activeTab;
      const activeCode = code || coordinatorCodes[activeCat];
      return api.bulkAddStudentActivities({
        studentIds: bulkSelectedStudentIds,
        category: activeCat,
        titleOrCompany: formTitle,
        roleOrPosition: formRole,
        mentorOrAchievement: formMentor,
        startDate: formStartDate,
        endDate: formEndDate,
        status: formStatus,
        coordinatorCode: activeCode,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['student-activities'] });
      setIsBulkAddModalOpen(false);
      setBulkSelectedStudentIds([]);
      showToast('success', res.message);
    },
    onError: (err: any) => {
      showToast('error', err.message || 'Failed to bulk add students.');
    }
  });

  const openBulkAddModal = () => {
    resetForm();
    setBulkSelectedStudentIds([]);
    const cat = activeTab === 'all' ? 'internship' : activeTab;
    setFormCategory(cat);
    executeProtectedAction(cat, () => {
      setIsBulkAddModalOpen(true);
    });
  };

  const handleBulkAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSelectedStudentIds.length === 0) {
      showToast('error', 'Please select at least one student.');
      return;
    }
    if (!formTitle.trim()) {
      showToast('error', 'Please enter Title / Company / Event name.');
      return;
    }
    executeProtectedAction(formCategory, (code) => {
      bulkAddMutation.mutate({ code });
    });
  };

  const handleBulkRemoveSubmit = () => {
    const activeCat = activeTab === 'all' ? 'internship' : activeTab;
    executeProtectedAction(activeCat as ActivityCategory, () => {
      bulkRemoveMutation.mutate();
    });
  };

  return (
    <PageWrapper role={role}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Toast Notification ── */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-semibold border ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page Title Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">
              <Users size={14} />
              <span>Department Student Records</span>
              {user?.role !== 'admin' && !myAssignments.isAdmin && (
                <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                  myAssignments.categories.length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {myAssignments.categories.length > 0 ? '🔑 Designated Coordinator' : '🛡️ View Only Access'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Student Activities</h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition"
            >
              <History size={14} />
              <span>{showAuditLogs ? 'Hide Audit Log' : 'View Audit Log'}</span>
            </button>

            <button
              onClick={openBulkAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
            >
              <UserPlus size={14} />
              <span>Bulk Add</span>
            </button>

            <button
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-500/20 transition"
            >
              <Plus size={15} />
              <span>Add Student</span>
            </button>
          </div>
        </div>

        {/* ── Category Dropdown ── */}
        <div className="w-full min-w-0 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-sm">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <label htmlFor="student-activity-category" className="block mb-2 text-xs font-bold text-slate-600">
                Category
              </label>
              <select
                id="student-activity-category"
                value={activeTab}
                onChange={e => {
                  setActiveTab(e.target.value as ActivityCategory);
                  setCompanyFilter('');
                  setActivityTypeFilter('');
                  setSelectedIds([]);
                }}
                className="w-full min-h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              >
                {(Object.keys(STUDENT_ACTIVITY_FILTERS) as ActivityCategory[]).map(catKey => (
                  <option key={catKey} value={catKey}>{STUDENT_ACTIVITY_FILTERS[catKey].label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="student-activity-company" className="block mb-2 text-xs font-bold text-slate-600">
                {STUDENT_ACTIVITY_FILTERS[selectedCategory].companyLabel}
              </label>
              <select
                id="student-activity-company"
                value={companyFilter}
                onChange={e => {
                  setCompanyFilter(e.target.value);
                  setActivityTypeFilter('');
                  setSelectedIds([]);
                }}
                className="w-full min-h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              >
                <option value="">All Companies</option>
                {companyOptions.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="student-activity-type" className="block mb-2 text-xs font-bold text-slate-600">
                Activity Type / Subcategory
              </label>
              <select
                id="student-activity-type"
                value={activityTypeFilter}
                onChange={e => {
                  setActivityTypeFilter(e.target.value);
                  setSelectedIds([]);
                }}
                className="w-full min-h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              >
                <option value="">{activeTab === 'internship' ? 'All Internship Types' : 'All Types'}</option>
                {activityTypeOptions.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Audit Logs Drawer / Panel ── */}
        <AnimatePresence>
          {showAuditLogs && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-800 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-orange-400">
                  <ShieldCheck size={16} />
                  <span>Activity Audit Log Trail ({activeTab.toUpperCase()})</span>
                </div>
                <button onClick={() => setShowAuditLogs(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500 italic text-center py-4">No audit log records for this category yet.</p>
                ) : (
                  auditLogs.map((log: ActivityAuditLog) => (
                    <div key={log.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 flex items-start justify-between gap-4">
                      <div>
                        <span className="font-bold text-orange-400 mr-2">[{log.action}]</span>
                        <span className="text-slate-100 font-semibold">{log.actorName}</span> ({log.actorRole})
                        {log.studentName && <span className="text-slate-300"> • Student: <strong>{log.studentName}</strong></span>}
                        {log.details && <p className="text-slate-400 text-[11px] mt-1 font-mono">{log.details}</p>}
                      </div>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Search & Actions Bar ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, roll no, company, title..."
              className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Filter size={14} />
              <span>Status:</span>
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>

            {/* Bulk Action Controls */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                  {selectedIds.length} selected
                </span>
                <button
                  onClick={() => setIsBulkRemoveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                >
                  <Trash2 size={13} />
                  <span>Remove Selected</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Student Activity Data Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Loading student activities...</span>
            </div>
          ) : filteredActivities.length === 0 ? (
            <EmptyState
              title="No student activity records found"
              description={`No students are currently registered under ${activeTab.toUpperCase()} matching your filter criteria.`}
              action={
                <button
                  onClick={() => openAddModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition"
                >
                  <Plus size={14} />
                  <span>Add First Student</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="w-10 py-3.5 px-3 text-center md:px-4">
                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                          {filteredActivities.length > 0 && filteredActivities.every(activity => selectedIds.includes(activity.id)) ? <CheckSquare size={16} className="text-orange-600" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="w-[30%] py-3.5 px-3 md:px-4">Student Identity</th>
                      <th className="w-[22%] py-3.5 px-3 md:px-4">Category Details</th>
                      <th className="w-[22%] py-3.5 px-3 md:px-4">Role / Mentor / Notes</th>
                      <th className="w-[16%] py-3.5 px-3 md:px-4">Duration</th>
                      <th className="w-20 py-3.5 px-3 text-center md:px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredActivities.map((act: StudentActivity) => {
                      const isSelected = selectedIds.includes(act.id);
                      const config = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.internship;
                      const CategoryIcon = config.icon;
                      return (
                        <tr key={act.id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-orange-50/30' : ''}`}>
                          <td className="py-3.5 px-3 text-center md:px-4">
                            <button onClick={() => toggleSelectRow(act.id)} className="text-slate-400 hover:text-slate-700">
                              {isSelected ? <CheckSquare size={16} className="text-orange-600" /> : <Square size={16} />}
                            </button>
                          </td>

                          <td className="py-3.5 px-3 md:px-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setProfileModalActivity(act)}
                                title="View Student Profile"
                                className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center font-black text-slate-700 text-xs hover:border-orange-400 hover:ring-2 hover:ring-orange-500/20 active:scale-95 transition cursor-pointer overflow-hidden"
                              >
                                {act.student?.avatarUrl ? (
                                  <img src={act.student.avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                                ) : (
                                  (act.student?.name || 'S').charAt(0)
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => setProfileModalActivity(act)}
                                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle text-left group cursor-pointer"
                                >
                                  <p className="min-w-0 break-words text-xs font-extrabold text-slate-900 leading-tight group-hover:text-orange-600 transition-colors">
                                    {act.student?.name || 'Student'}
                                  </p>
                                  <StudentStatusDot status={act.status} />
                                </button>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                                  <span>{act.student?.rollNumber || act.studentId}</span>
                                  <span>•</span>
                                  <span>{act.student?.department || 'CSD'}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 md:px-4">
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 rounded-lg border p-1.5 ${config.bg} ${config.color} ${config.border}`}>
                                <CategoryIcon size={13} />
                              </span>
                              <div className="min-w-0">
                                <p className="break-words font-bold text-slate-900">{act.titleOrCompany}</p>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">{config.label}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 md:px-4">
                            <p className="break-words text-slate-700 font-semibold">{act.roleOrPosition || '—'}</p>
                            {act.mentorOrAchievement && (
                              <p className="mt-0.5 break-words text-[11px] text-slate-500 italic">{act.mentorOrAchievement}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-slate-500 text-[11.5px] font-mono md:px-4">
                            {act.startDate ? (
                              <span>{act.startDate} {act.endDate ? `to ${act.endDate}` : ''}</span>
                            ) : (
                              <span className="text-slate-400 italic">N/A</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center md:px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setProfileModalActivity(act)}
                                title="View Student Profile"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-200 transition cursor-pointer"
                              >
                                <User size={14} />
                              </button>
                              <button
                                onClick={() => openEditModal(act)}
                                title="Edit Record (Requires Coordinator Code)"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-200 transition cursor-pointer"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => openDeleteModal(act)}
                                title="Remove from Activity (Master Student Record Intact)"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2.5 p-2.5 sm:p-3">
                {filteredActivities.map((act: StudentActivity) => {
                  const isSelected = selectedIds.includes(act.id);
                  const config = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.internship;
                  const CategoryIcon = config.icon;

                  return (
                    <div
                      key={act.id}
                      className={`rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition ${
                        isSelected ? 'border-orange-300 bg-orange-50/25 ring-1 ring-orange-200' : ''
                      }`}
                    >
                      {/* Row 1: Checkbox, Avatar, Student Name & Roll Number, Status Dot, Action Buttons */}
                      <div className="flex items-center gap-2.5">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelectRow(act.id)}
                          className="text-slate-400 hover:text-slate-700 shrink-0 p-0.5 cursor-pointer"
                          title={isSelected ? 'Deselect' : 'Select'}
                        >
                          {isSelected ? <CheckSquare size={17} className="text-orange-600" /> : <Square size={17} />}
                        </button>

                        {/* Circular Avatar */}
                        <button
                          type="button"
                          onClick={() => setProfileModalActivity(act)}
                          title="View Student Profile"
                          className="h-10 w-10 shrink-0 rounded-full border border-slate-200/90 bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs hover:border-orange-400 hover:ring-2 hover:ring-orange-500/20 active:scale-95 transition cursor-pointer overflow-hidden group shadow-2xs"
                        >
                          {act.student?.avatarUrl ? (
                            <img src={act.student.avatarUrl} alt={act.student.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <User size={18} className="text-slate-400" />
                          )}
                        </button>

                        {/* Student Name & Roll Number */}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => setProfileModalActivity(act)}
                            className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle text-left group cursor-pointer"
                          >
                            <p className="min-w-0 break-words text-[13px] sm:text-[13.5px] font-extrabold uppercase tracking-tight text-slate-900 leading-tight group-hover:text-orange-600 transition-colors truncate">
                              {act.student?.name || 'Student'}
                            </p>
                            <StudentStatusDot status={act.status} />
                          </button>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400 tracking-wide font-mono leading-none">
                            <span>{act.student?.rollNumber || act.studentId}</span>
                            <span>•</span>
                            <span>{act.student?.department || 'CSIT'}</span>
                          </div>
                        </div>

                        {/* Action Buttons: Profile, Edit, Delete (neat circular pills matching reference image) */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {/* Profile button */}
                          <button
                            type="button"
                            onClick={() => setProfileModalActivity(act)}
                            title="View Profile Details"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <User size={14} />
                          </button>

                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(act)}
                            title="Edit Record"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-orange-600 bg-orange-50 border border-orange-200/80 hover:bg-orange-100 hover:text-orange-700 transition active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => openDeleteModal(act)}
                            title="Remove"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 hover:text-rose-700 transition active:scale-95 cursor-pointer shadow-2xs"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Compact Category Icon + Internship Title & Category */}
                      <div className="mt-2.5 pt-0.5 flex items-center gap-2.5">
                        <span
                          className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center ${config.bg} ${config.color} ${config.border} shadow-2xs`}
                        >
                          <CategoryIcon size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[12.5px] sm:text-[13px] font-extrabold uppercase tracking-tight text-slate-900 leading-tight">
                            {act.titleOrCompany}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS SECTION
      ════════════════════════════════════════════════════════════════════════ */}

      {/* ── 1. Coordinator Authorization Code Verification Modal ── */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <Key size={18} />
                  </div>
                  <span>Coordinator Authorization</span>
                </div>
                <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Modifying <strong>{pendingActionCategory.toUpperCase()}</strong> records requires authorization. Please enter your designated <strong>Coordinator Authorization Code</strong>.
              </p>

              <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Coordinator Authorization Code
                  </label>
                  <input
                    type="password"
                    value={authInputCode}
                    onChange={e => setAuthInputCode(e.target.value)}
                    placeholder="Enter Code (e.g. COORD-XXXX-YYYY)"
                    className="w-full px-4 py-2.5 text-sm font-mono font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    autoFocus
                  />
                  {authError && (
                    <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={13} />
                      <span>{authError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition"
                  >
                    Verify &amp; Continue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 2. Add / Edit Activity Record Modal ── */}
      <AnimatePresence>
        {isAddEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <Plus size={18} />
                  </div>
                  <span>{editingActivity ? 'Edit Activity Record' : `Add Student to ${CATEGORY_CONFIG[formCategory]?.label}`}</span>
                </div>
                <button onClick={() => setIsAddEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Activity Category</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ActivityCategory)}
                    disabled={!!editingActivity}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as ActivityCategory[]).map(c => (
                      <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                    ))}
                  </select>
                </div>

                {/* Student Roster Search & Selection (Only for Add) */}
                {!editingActivity && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Student from Master Database</label>

                    {selectedStudent ? (
                      <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-200 flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-900 text-xs">{selectedStudent.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{selectedStudent.rollNumber || selectedStudent.userId} • {selectedStudent.department}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(null)}
                          className="text-xs font-bold text-orange-700 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={rosterSearch}
                            onChange={e => setRosterSearch(e.target.value)}
                            placeholder="Search existing student by name or roll number..."
                            className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                          />
                        </div>

                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                          {filteredRoster.map((s: any) => (
                            <button
                              key={s.id || s.userId}
                              type="button"
                              onClick={() => setSelectedStudent(s)}
                              className="w-full text-left p-2.5 hover:bg-orange-50 flex items-center justify-between text-xs transition"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{s.name}</span>
                                <span className="text-[11px] text-slate-500 font-mono ml-2">({s.rollNumber || s.userId})</span>
                              </div>
                              <span className="text-[10.5px] font-bold text-orange-600">Select</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Category Specific Fields */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {formCategory === 'internship' ? 'Company / Organization Name' :
                       formCategory === 'startup' ? 'Startup Name' :
                       formCategory === 'project_work' ? 'Project Title' :
                       formCategory === 'sports' ? 'Sport / Tournament Name' : 'House / Event Name'} *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="e.g. TCS, TechCorp, AI Autonomous Drone, Cricket Championship"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {formCategory === 'internship' ? 'Role / Position' :
                       formCategory === 'project_work' ? 'Project Area / Type' :
                       formCategory === 'sports' ? 'Level / Event Category' : 'Role / Participation Detail'}
                    </label>
                    <input
                      type="text"
                      value={formRole}
                      onChange={e => setFormRole(e.target.value)}
                      placeholder="e.g. Full Stack Intern, State Level, Team Captain"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {formCategory === 'project_work' ? 'Faculty Mentor' :
                       formCategory === 'sports' ? 'Achievement / Award' : 'Notes / Additional Details'}
                    </label>
                    <input
                      type="text"
                      value={formMentor}
                      onChange={e => setFormMentor(e.target.value)}
                      placeholder="e.g. Dr. A. Sharma / Gold Medalist / Approved"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Start Date</label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={e => setFormStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">End Date</label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={e => setFormEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Status</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddEditModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveActivityMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition disabled:opacity-50"
                  >
                    {saveActivityMutation.isPending ? 'Saving...' : 'Save Activity Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 3. Bulk Add Modal ── */}
      <AnimatePresence>
        {isBulkAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-black text-slate-900 text-base">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <UserPlus size={18} />
                  </div>
                  <span>Bulk Add Students to {CATEGORY_CONFIG[formCategory]?.label}</span>
                </div>
                <button onClick={() => setIsBulkAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleBulkAddSubmit} className="space-y-4">
                {/* Select Multiple Students */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Students ({bulkSelectedStudentIds.length} selected)
                    </label>
                  </div>

                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={bulkSearch}
                      onChange={e => setBulkSearch(e.target.value)}
                      placeholder="Filter student list by name or roll number..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {filteredBulkRoster.map((s: any) => {
                      const isSel = bulkSelectedStudentIds.includes(s.userId || s.id);
                      return (
                        <div
                          key={s.id || s.userId}
                          onClick={() => {
                            const sid = s.userId || s.id;
                            setBulkSelectedStudentIds(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer text-xs transition ${isSel ? 'bg-orange-50/60 font-bold' : 'hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center gap-2">
                            {isSel ? <CheckSquare size={16} className="text-orange-600" /> : <Square size={16} className="text-slate-400" />}
                            <span className="text-slate-900">{s.name}</span>
                            <span className="text-slate-500 font-mono text-[11px]">({s.rollNumber || s.userId})</span>
                          </div>
                          <span className="text-[10.5px] text-slate-500">{s.department}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Common Activity Details */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Title / Company / Event Name *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="e.g. TCS, TechCorp, Annual Sports 2026"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role / Position / Area</label>
                    <input
                      type="text"
                      value={formRole}
                      onChange={e => setFormRole(e.target.value)}
                      placeholder="e.g. Participant / Trainee"
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsBulkAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkAddMutation.isPending}
                    className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition disabled:opacity-50"
                  >
                    {bulkAddMutation.isPending ? 'Processing...' : `Bulk Add ${bulkSelectedStudentIds.length} Students`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 4. Single Delete Modal ── */}
      <AnimatePresence>
        {deletingActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 rounded-full bg-rose-50 border border-rose-200">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Remove Student from Activity?</h3>
                  <p className="text-xs text-slate-500 font-medium">This action will remove the student's category membership.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 space-y-1">
                <p><strong>Student:</strong> {deletingActivity.student?.name}</p>
                <p><strong>Category:</strong> {deletingActivity.category.toUpperCase()}</p>
                <p><strong>Details:</strong> {deletingActivity.titleOrCompany}</p>
              </div>

              <p className="text-xs text-slate-500 italic">
                Note: The student's master profile record and attendance records will remain completely untouched.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingActivity(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={removeActivityMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition disabled:opacity-50"
                >
                  {removeActivityMutation.isPending ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 5. Bulk Delete Modal ── */}
      <AnimatePresence>
        {isBulkRemoveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 rounded-full bg-rose-50 border border-rose-200">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Bulk Remove {selectedIds.length} Students?</h3>
                  <p className="text-xs text-slate-500 font-medium">Remove selected student memberships from this category list.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Are you sure you want to remove <strong>{selectedIds.length}</strong> student record(s)? This will deactivate their activity membership in this list. Master student database profiles will not be deleted.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkRemoveModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkRemoveSubmit}
                  disabled={bulkRemoveMutation.isPending}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition disabled:opacity-50"
                >
                  {bulkRemoveMutation.isPending ? 'Removing...' : `Remove ${selectedIds.length} Students`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. Student Profile & Activity Details Modal ── */}
      <AnimatePresence>
        {profileModalActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 space-y-4 my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 font-black text-slate-900 text-base">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base leading-tight">Student Profile Details</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Activity &amp; Internship Overview</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileModalActivity(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Student Identity Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
                <div className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center font-black text-slate-700 text-lg shadow-2xs overflow-hidden">
                  {profileModalActivity.student?.avatarUrl ? (
                    <img
                      src={profileModalActivity.student.avatarUrl}
                      alt={profileModalActivity.student.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (profileModalActivity.student?.name || 'S').charAt(0)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight truncate">
                      {profileModalActivity.student?.name || 'Student'}
                    </h4>
                    <StudentStatusDot status={profileModalActivity.status} />
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 font-mono">
                    <span className="font-bold text-slate-800">
                      {profileModalActivity.student?.rollNumber || profileModalActivity.studentId}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      {profileModalActivity.student?.department || 'CSD'}
                    </span>
                    {profileModalActivity.student?.year && (
                      <>
                        <span>•</span>
                        <span>{profileModalActivity.student.year}</span>
                      </>
                    )}
                  </div>

                  {profileModalActivity.student?.email && (
                    <p className="mt-1.5 text-[11px] text-slate-500 truncate flex items-center gap-1.5 font-medium">
                      <Mail size={12} className="shrink-0 text-slate-400" />
                      <span>{profileModalActivity.student.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Activity / Internship Details Card */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Briefcase size={12} className="text-orange-500" />
                  <span>Activity &amp; Internship Information</span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    {(() => {
                      const cfg = CATEGORY_CONFIG[profileModalActivity.category] || CATEGORY_CONFIG.internship;
                      const CatIcon = cfg.icon;
                      return (
                        <span className={`mt-0.5 shrink-0 rounded-lg border p-1.5 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          <CatIcon size={14} />
                        </span>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-slate-900 leading-snug">
                        {profileModalActivity.titleOrCompany}
                      </p>
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
                        {CATEGORY_CONFIG[profileModalActivity.category]?.label || profileModalActivity.category}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Role / Mentor
                      </span>
                      <p className="mt-0.5 font-bold text-slate-800 break-words">
                        {profileModalActivity.roleOrPosition || '—'}
                      </p>
                      {profileModalActivity.mentorOrAchievement && (
                        <p className="mt-0.5 text-[11px] text-slate-500 italic break-words">
                          {profileModalActivity.mentorOrAchievement}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Duration
                      </span>
                      <p className="mt-0.5 font-mono text-slate-700 font-semibold text-[11.5px]">
                        {profileModalActivity.startDate ? (
                          <span>
                            {profileModalActivity.startDate} {profileModalActivity.endDate ? `to ${profileModalActivity.endDate}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProfileModalActivity(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const act = profileModalActivity;
                    setProfileModalActivity(null);
                    openEditModal(act);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={13} />
                  <span>Edit Details</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </PageWrapper>
  );
}
