import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, UploadCloud, FileSpreadsheet, Download, Filter, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/shared/Avatar';
import { Modal } from '../../components/shared/Modal';
import { EmptyState } from '../../components/shared/EmptyState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import CoordinatorManagement from './CoordinatorManagement';

interface PreviewData {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch]   = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'student' | 'faculty' | 'hod' | 'admin' | 'coordinators'>('all');

  // Export progress state
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser]     = useState<api.AuthUser | null>(null);

  // Multi-select Batch Delete state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Bulk Import & Preview state
  const [importFile, setImportFile]           = useState<File | null>(null);
  const [previewData, setPreviewData]         = useState<PreviewData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading]         = useState(false);
  const [isDraggingOver, setIsDraggingOver]   = useState(false);
  const dragCounterRef = useRef(0);

  // Form state
  const [formId, setFormId]         = useState('');
  const [formName, setFormName]     = useState('');
  const [formEmail, setFormEmail]   = useState('');
  const [formRole, setFormRole]     = useState<api.UserRole>('student');
  const [formDept, setFormDept]     = useState('CSIT');
  const [formPass, setFormPass]     = useState('');
  const [formRoll, setFormRoll]     = useState('');
  const [formSem, setFormSem]       = useState(6);
  const [formYear, setFormYear]     = useState('3rd Year');
  const [formSection, setFormSection] = useState('CSIT-A');
  const [formAvatar, setFormAvatar] = useState('');
  const [formCounselorId, setFormCounselorId] = useState('');
  const [formError, setFormError]   = useState('');

  // Dropdown filter states
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDept, setFilterDept]           = useState('all');
  const [filterYear, setFilterYear]           = useState('all');
  const [filterSection, setFilterSection]     = useState('all');

  const { data: usersList = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const facultyList = usersList.filter(u => u.role === 'faculty' || u.role === 'hod');

  // Dynamic filter options
  const departmentList = Array.from(new Set(usersList.map(u => u.department).filter(Boolean))).sort();
  const yearList = Array.from(new Set(usersList.map(u => u.year).filter(Boolean))).sort();
  const sectionList = Array.from(new Set(usersList.map(u => u.section).filter(Boolean))).sort();
  const activeFilterCount = (filterDept !== 'all' ? 1 : 0) + (filterYear !== 'all' ? 1 : 0) + (filterSection !== 'all' ? 1 : 0);

  // ── Global window drag-and-drop for CSV/Excel ────────────────────────────────
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setIsDraggingOver(true);
    };
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setIsDraggingOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('csv') || file.type.includes('spreadsheet') || file.type.includes('excel'))) {
        handleFileSelectForPreview(file);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: api.CreateUserPayload) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowFormModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create user');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.CreateUserPayload> }) => api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowFormModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update user');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      window.alert(err.message || 'Failed to delete user');
    }
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: (ids: string[]) => api.deleteMultipleUsers(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUserIds([]);
      window.alert(`✅ Successfully deleted ${data.deletedCount} account(s) from the database.`);
    },
    onError: (err: any) => {
      window.alert(`❌ Failed to delete selected accounts: ${err.message || 'Unknown error'}`);
    },
  });

  const handleDelete = (id: string, name?: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${name ? `"${name}"` : 'this account'} from the database?`
    );
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleBatchDelete = () => {
    if (selectedUserIds.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${selectedUserIds.length} selected user account(s) from the database?`
    );
    if (confirmed) {
      deleteMultipleMutation.mutate(selectedUserIds);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormId('');
    setFormName('');
    setFormEmail('');
    setFormRole('student');
    setFormDept('CSIT');
    setFormPass('');
    setFormRoll('');
    setFormSem(6);
    setFormYear('3rd Year');
    setFormSection('CSIT-A');
    setFormAvatar('');
    setFormCounselorId('');
    setFormError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Register Number,Student Name,Year,Branch,Section,Role\n' +
      '23B91A0701,BARAKATA TARUN SWAMY,4,CSIT,A,student\n' +
      '23B91A0702,BARRI SRAVYA SREE,4,CSIT,A,student\n' +
      '24B91A0701,Gowtham Krishna,3,CSIT,A,student\n' +
      'FAC-CSIT-001,Dr. J. Somaraju,3,CSIT,A,faculty\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'students_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export in Excel (.xlsx) with embedded Photo thumbnails + Register Number, Name, Year, Department, Section
  const handleExportExcelWithPhotos = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (sorted.length === 0) {
      window.alert('No records available to export with current filters.');
      return;
    }

    if (format === 'csv') {
      const exportRows = sorted.map(u => ({
        'Register Number': u.rollNumber || u.userId || '',
        'Name': u.name || '',
        'Year': u.year || '',
        'Department': u.department || '',
        'Section': u.section || '',
        'Photo URL': u.avatarUrl || (u.rollNumber ? `https://srkrexams.in/SRKR/photo/${u.rollNumber.toUpperCase()}.jpg` : ''),
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      const fileName = `Students_Export_${activeTab !== 'all' ? `${activeTab}_` : ''}${new Date().toISOString().slice(0, 10)}.csv`;
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
      return;
    }

    try {
      setIsExportingExcel(true);
      setExportProgressText('Preparing Excel workbook...');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AttendEase';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Students', {
        views: [{ showGridLines: true }],
      });

      // Columns definition
      worksheet.columns = [
        { header: '#', key: 'index', width: 6 },
        { header: 'Photo', key: 'photo', width: 14 },
        { header: 'Register Number', key: 'rollNumber', width: 20 },
        { header: 'Name', key: 'name', width: 32 },
        { header: 'Year', key: 'year', width: 14 },
        { header: 'Department', key: 'department', width: 18 },
        { header: 'Section', key: 'section', width: 14 },
      ];

      // Header row styling
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF18181B' }, // Dark theme matching AttendEase
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Process rows and embed photos
      const total = sorted.length;
      for (let i = 0; i < total; i++) {
        const u = sorted[i];
        const rowIndex = i + 2;
        setExportProgressText(`Processing photos... (${i + 1}/${total})`);

        const row = worksheet.addRow({
          index: i + 1,
          photo: '',
          rollNumber: u.rollNumber || u.userId || '',
          name: u.name || '',
          year: u.year || '',
          department: u.department || '',
          section: u.section || '',
        });

        row.height = 56;
        row.alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

        // Subtle alternating row background
        if (i % 2 !== 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }

        // Fetch student photo
        const photoUrl = u.avatarUrl || (u.rollNumber ? `https://srkrexams.in/SRKR/photo/${u.rollNumber.toUpperCase()}.jpg` : '');
        if (photoUrl) {
          try {
            const proxyUrl = `/api/users/proxy-image?url=${encodeURIComponent(photoUrl)}`;
            const imgRes = await fetch(proxyUrl);
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const imageId = workbook.addImage({
                buffer: arrayBuf,
                extension: 'jpeg',
              });

              worksheet.addImage(imageId, {
                tl: { col: 1.15, row: rowIndex - 0.88 },
                ext: { width: 44, height: 52 },
                editAs: 'oneCell',
              });
            }
          } catch (imgErr) {
            // Ignore single image failure and proceed
          }
        }
      }

      setExportProgressText('Generating .xlsx file...');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `Students_With_Photos_${activeTab !== 'all' ? `${activeTab}_` : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export Excel with photos failed:', err);
      window.alert(`Failed to export Excel with photos: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExportingExcel(false);
      setExportProgressText('');
    }
  };

  // Parses dropped or selected CSV/Excel file to display preview before upload
  const handleFileSelectForPreview = async (file: File) => {
    try {
      setImportFile(file);
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        window.alert('No sheets found in the file.');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
      
      if (!jsonData || jsonData.length === 0) {
        window.alert('The selected file appears to be empty.');
        return;
      }

      const rawHeaders = (jsonData[0] as any[]).map(h => String(h ?? '').trim()).filter(Boolean);
      const rawRows = jsonData.slice(1) as any[][];
      
      const formattedRows: Record<string, string>[] = rawRows
        .filter(r => Array.isArray(r) && r.some(cell => String(cell ?? '').trim() !== ''))
        .map(row => {
          const obj: Record<string, string> = {};
          rawHeaders.forEach((h, i) => {
            obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
          });
          return obj;
        });

      if (formattedRows.length === 0) {
        window.alert('No valid student data rows found in this file.');
        return;
      }

      setPreviewData({
        fileName: file.name,
        fileSize: file.size,
        headers: rawHeaders,
        rows: formattedRows,
        totalRows: formattedRows.length,
      });
      setShowPreviewModal(true);
    } catch (err: any) {
      console.error('File parsing error:', err);
      window.alert(`Failed to parse file: ${err.message || 'Check file format'}`);
    }
  };

  // Called when user clicks "Upload to Database" in preview modal
  const handleConfirmUpload = async () => {
    if (!importFile) return;
    setIsUploading(true);
    try {
      const report = await api.importStudentsFile(importFile);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['public-sections'] });
      setShowPreviewModal(false);
      setPreviewData(null);
      
      const failedCount = report.failed?.length || 0;
      const failedLines = failedCount > 0
        ? '\n\nFailed rows:\n' + report.failed.map(f => `  Row ${f.row ?? '?'}: ${f.reason}`).join('\n')
        : '';
      window.alert(
        `✅ Import Complete — ${importFile.name}\n\n` +
        `  ➕ New added : ${report.inserted}\n` +
        `  🔄 Updated  : ${report.upserted || report.skipped || 0}\n` +
        `  ❌ Failed   : ${failedCount}` +
        failedLines
      );
    } catch (err: any) {
      window.alert(`❌ Import Failed\n\n${err.message || 'Failed to upload student file.'}`);
    } finally {
      setIsUploading(false);
      setImportFile(null);
    }
  };

  const handleOpenEdit = (user: api.AuthUser) => {
    setEditingUser(user);
    setFormId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormDept(user.department);
    setFormPass(''); // don't fill password
    setFormRoll(user.rollNumber || '');
    setFormSem(user.semester || 6);
    setFormYear(user.year || '3rd Year');

    // Canonical section mapping for select dropdown
    const rawSec = (user.section || '').trim().toUpperCase();
    let initialSec = 'CSIT-A';
    if (rawSec.includes('CSD') || user.department?.includes('CSD')) {
      initialSec = 'CSD';
    } else if (rawSec === 'B' || rawSec.endsWith('B') || rawSec.includes('CSIT-B')) {
      initialSec = 'CSIT-B';
    } else {
      initialSec = 'CSIT-A';
    }
    setFormSection(initialSec);

    setFormAvatar(user.avatarUrl || '');
    setFormCounselorId(user.counselorId || '');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formRole === 'student') {
      if (!formRoll.trim() || !formName.trim()) {
        setFormError('Register / Roll Number and Student Name are required.');
        return;
      }
    } else {
      if (!formName.trim() || !formEmail.trim() || !formDept.trim()) {
        setFormError('Name, Email, and Department are required for non-student accounts.');
        return;
      }
    }

    const cleanRoll = formRoll.trim();
    const cleanName = formName.trim();

    const effectiveEmail  = formEmail.trim() || (formRole === 'student' ? `${cleanRoll.toLowerCase()}@srkrec.ac.in` : '');
    const effectiveDept   = formDept.trim()  || 'CSD';
    const effectiveId     = formId.trim()    || (formRole === 'student' ? `stu-${cleanRoll}` : '');
    const effectivePass   = formPass.trim()  || (formRole === 'student' ? cleanRoll : (formRole === 'faculty' || formRole === 'hod' ? '1234' : 'password123'));
    const effectiveAvatar = formAvatar.trim() || (formRole === 'student' && cleanRoll ? `https://srkrexams.in/SRKR/photo/${cleanRoll.toUpperCase()}.jpg` : '');

    if (!editingUser) {
      if (!effectiveId || !effectivePass) {
        setFormError('User ID and Password could not be generated.');
        return;
      }
      createMutation.mutate({
        userId: effectiveId,
        name: cleanName,
        email: effectiveEmail,
        role: formRole,
        department: effectiveDept,
        password: effectivePass,
        ...(formRole === 'student' && { rollNumber: cleanRoll, semester: formSem || 6, year: formYear, section: formSection, counselorId: formCounselorId || undefined }),
        ...(effectiveAvatar && { avatarUrl: effectiveAvatar }),
      });
    } else {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          name: cleanName,
          email: effectiveEmail,
          role: formRole,
          department: effectiveDept,
          ...(formPass && { password: formPass }),
          ...(formRole === 'student' && { rollNumber: cleanRoll, semester: formSem, year: formYear, section: formSection, counselorId: formCounselorId || undefined }),
          ...(effectiveAvatar && { avatarUrl: effectiveAvatar }),
        }
      });
    }
  };

  const filtered = usersList.filter(u => {
    const matchesSearch =
      (u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.rollNumber ?? u.userId ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.department ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' ? true : u.role === activeTab;
    const matchesDept = filterDept === 'all' || u.department === filterDept;
    const matchesYear = filterYear === 'all' || u.year === filterYear;
    const matchesSection = filterSection === 'all' || u.section === filterSection;
    return matchesSearch && matchesTab && matchesDept && matchesYear && matchesSection;
  });

  const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const allVisibleIds = sorted.map(u => u.id || u.userId || '').filter(Boolean);
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedUserIds.includes(id));
  const isSomeSelected = selectedUserIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(allVisibleIds);
    }
  };

  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <PageWrapper role="admin">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <span className="text-[11px] font-semibold text-[#18181b] bg-[#edf0f2] px-2 py-0.5 rounded-[5px]">
              ADMIN CONTROL
            </span>
            <h1 className="text-[22px] font-bold text-[#18181b] tracking-tight mt-1">Manage Accounts &amp; Students</h1>
            <p className="text-[13px] text-[#6b7280]">Create, edit, delete and bulk upload Student, Faculty, HOD, and Admin accounts</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Export in Excel Button */}
            <button
              type="button"
              disabled={isExportingExcel}
              onClick={() => handleExportExcelWithPhotos('xlsx')}
              title="Export filtered records in Excel (.xlsx) with embedded Photo thumbnails, Register Number, Name, Year, Department, and Section"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 font-medium text-[13px] rounded-lg bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isExportingExcel ? (
                <Loader2 size={15} className="animate-spin text-emerald-600" />
              ) : (
                <FileSpreadsheet size={15} className="text-emerald-600" />
              )}
              <span>{isExportingExcel ? (exportProgressText || 'Exporting...') : 'Export in Excel'}</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              disabled={isExportingExcel}
              onClick={() => handleExportExcelWithPhotos('csv')}
              title="Export filtered records in CSV format"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3 font-medium text-[13px] rounded-lg bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>

            <label
              htmlFor="header-csv-file-input"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 font-medium text-[13px] rounded-lg bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] transition-all cursor-pointer"
            >
              <UploadCloud size={15} />
              <span>Import</span>
              <input
                id="header-csv-file-input"
                type="file"
                accept=".csv, .xlsx, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = '';
                }}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelectForPreview(e.target.files[0]);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </label>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              title="Download sample CSV format template"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3 font-medium text-[13px] rounded-lg bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] transition-all cursor-pointer"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Template</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-1.5 h-[38px] px-4 bg-[#18181b] hover:bg-[#27272a] active:bg-[#09090b] text-white font-medium text-[13px] rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#edf0f2] rounded-lg w-fit mb-2">
          {[
            { id: 'all',          label: 'All Users' },
            { id: 'student',      label: 'Students' },
            { id: 'faculty',      label: 'Faculty' },
            { id: 'hod',          label: 'HODs' },
            { id: 'admin',        label: 'Admins' },
            { id: 'coordinators', label: 'Coordinators & Access' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-[#18181b] shadow-2xs font-semibold'
                  : 'text-[#6b7280] hover:text-[#18181b]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'coordinators' ? (
          <div className="mt-4">
            <CoordinatorManagement />
          </div>
        ) : (
          <>

        {/* Filter Toolbar & Filter Button */}
        <div className="flex gap-2.5 items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#88929e]" />
            <input
              type="text"
              placeholder="Search by name, email, roll no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-[40px] pl-9 pr-4 text-[13.5px] bg-[#edf0f2] text-[#18181b] placeholder:text-[#88929e] rounded-lg outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all"
            />
          </div>

          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`h-[40px] px-3.5 rounded-lg border font-medium text-[13px] flex items-center gap-1.5 transition-all cursor-pointer ${
              showFilterPanel || activeFilterCount > 0
                ? 'bg-[#18181b] text-white border-[#18181b]'
                : 'bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] border-transparent'
            }`}
          >
            <Filter size={14} />
            <span className="font-semibold">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Collapsible Dropdown Filter Panel */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                {/* Department Filter */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1">
                    Department / Branch
                  </label>
                  <select
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                    className="w-full h-[36px] px-2.5 bg-[#edf0f2] text-[#18181b] rounded-lg text-[13px] font-medium outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {departmentList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1">
                    Year
                  </label>
                  <select
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                    className="w-full h-[36px] px-2.5 bg-[#edf0f2] text-[#18181b] rounded-lg text-[13px] font-medium outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    {yearList.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                {/* Section Filter */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1">
                    Section
                  </label>
                  <select
                    value={filterSection}
                    onChange={e => setFilterSection(e.target.value)}
                    className="w-full h-[36px] px-2.5 bg-[#edf0f2] text-[#18181b] rounded-lg text-[13px] font-medium outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="all">All Sections</option>
                    {sectionList.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

                {/* Reset Filters */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDept('all');
                      setFilterYear('all');
                      setFilterSection('all');
                    }}
                    className="h-[36px] px-3.5 text-[12.5px] font-medium bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#18181b] rounded-lg transition-colors cursor-pointer w-full flex items-center justify-center"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Multi-select Batch Actions Bar */}
        <AnimatePresence>
          {selectedUserIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between gap-3 p-3 bg-[#18181b] text-white rounded-xl shadow-md mb-4 border border-slate-800"
            >
              <div className="flex items-center gap-2.5 pl-1.5 text-[13px] font-medium">
                <span className="w-6 h-6 rounded-md bg-white/20 text-white flex items-center justify-center font-bold text-[11.5px]">
                  {selectedUserIds.length}
                </span>
                <span>account{selectedUserIds.length > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1.5 text-[12px] font-medium bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  disabled={deleteMultipleMutation.isPending}
                  onClick={handleBatchDelete}
                  className="px-3.5 py-1.5 text-[12px] font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Trash2 size={13} />
                  <span>{deleteMultipleMutation.isPending ? 'Deleting...' : `Delete Selected (${selectedUserIds.length})`}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(249,115,22,0.15)', borderTopColor: '#F97316', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            <p className="text-[13px] font-medium">Loading user accounts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try adjusting your filters or add a new user to get started."
            action={<Button variant="secondary" onClick={() => { setSearch(''); setActiveTab('student'); }}>Reset Filters</Button>}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Stats Bar */}
            <div className="px-4 py-2.5 bg-[#f8f9fa] border-b border-slate-200 flex items-center justify-between text-[12px] text-[#6b7280]">
              <span>Showing <strong className="text-[#18181b]">{sorted.length}</strong> {activeTab === 'all' ? 'total accounts' : `${activeTab} accounts`}</span>
              <span className="text-[11px] text-[#88929e]">Scroll horizontally if needed</span>
            </div>

            {/* Structured Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#edf0f2] text-[#374151] border-b border-slate-200">
                    <th className="px-3 py-2.5 text-center border-r border-slate-200 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={el => { if (el) el.indeterminate = isSomeSelected; }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-[#18181b] focus:ring-0 cursor-pointer accent-[#18181b]"
                        title="Select All Accounts"
                      />
                    </th>
                    <th className="px-2.5 py-2.5 text-center font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 w-10">#</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 w-14">Photo</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 whitespace-nowrap">Register No.</th>
                    <th className="px-4 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 whitespace-nowrap">Full Name</th>
                    <th className="px-4 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 whitespace-nowrap">Email Address</th>
                    <th className="px-3 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 text-center whitespace-nowrap">Role</th>
                    <th className="px-3 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 text-center whitespace-nowrap">Year</th>
                    <th className="px-3 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 text-center whitespace-nowrap">Section</th>
                    <th className="px-3 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider border-r border-slate-200 text-center whitespace-nowrap">Branch</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11.5px] uppercase tracking-wider text-center whitespace-nowrap w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u, index) => {
                    const uKey = u.id || u.userId || '';
                    const isSelected = selectedUserIds.includes(uKey);
                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-slate-200 hover:bg-[#f0f4f8] transition-colors ${
                          isSelected ? 'bg-orange-50/60 hover:bg-orange-50' : index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2 text-center border-r border-slate-200 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectUser(uKey)}
                            className="w-4 h-4 rounded border-slate-300 text-[#18181b] focus:ring-0 cursor-pointer accent-[#18181b]"
                          />
                        </td>

                        {/* Serial Number */}
                        <td className="px-2.5 py-2 text-center text-[#88929e] font-mono text-[12px] border-r border-slate-200 w-10">
                          {index + 1}
                        </td>

                        {/* Photo Avatar */}
                        <td className="px-2 py-2 text-center border-r border-slate-200 w-14">
                          <div className="flex items-center justify-center">
                            <Avatar name={u.name} src={u.avatarUrl} rollNumber={u.rollNumber} size="sm" role={u.role} className="rounded-full shadow-2xs border border-slate-200/80" />
                          </div>
                        </td>

                        {/* Register Number */}
                        <td className="px-3.5 py-2 font-mono font-medium text-[#18181b] border-r border-slate-200 whitespace-nowrap">
                          {u.rollNumber || '—'}
                        </td>

                        {/* Name */}
                        <td className="px-4 py-2 font-semibold text-[#18181b] border-r border-slate-200 whitespace-nowrap">
                          {u.name}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-2 text-[#6b7280] border-r border-slate-200 whitespace-nowrap text-[12.5px]">
                          {u.email}
                        </td>

                        {/* Role */}
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap text-[12.5px] font-medium text-[#374151] capitalize">
                          {u.role === 'hod' ? 'HOD' : u.role}
                        </td>

                        {/* Year */}
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap text-[12px] font-medium text-[#374151]">
                          {u.year || '—'}
                        </td>

                        {/* Section */}
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap text-[12px] font-medium text-[#374151]">
                          {u.section ? (u.section.toUpperCase().startsWith('SEC') || u.section.includes('-') ? u.section : `Sec ${u.section}`) : '—'}
                        </td>

                        {/* Branch / Department */}
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap font-medium text-[12px] text-[#374151]">
                          {u.department}
                        </td>

                        {/* Actions */}
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="w-6 h-6 bg-[#edf0f2] hover:bg-[#18181b] text-[#374151] hover:text-white rounded flex items-center justify-center transition-all cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(u.id, u.name)}
                              className="w-6 h-6 bg-[#edf0f2] hover:bg-rose-600 text-[#374151] hover:text-white rounded flex items-center justify-center transition-all cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          title={editingUser ? 'Edit Portal Account' : 'Add New Account'}
          description={formRole === 'student' ? 'Fill Register Number and Name to auto-generate student details' : 'Enter account details below'}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-2">
            {/* System Role Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Account Type / Role
              </label>
              <select
                value={formRole}
                onChange={e => setFormRole(e.target.value as api.UserRole)}
                className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-bold text-slate-800 text-[13px] shadow-2xs"
              >
                <option value="student">Student Account</option>
                <option value="faculty">Faculty Account</option>
                <option value="hod">HOD Account</option>
                <option value="admin">Admin Account</option>
              </select>
            </div>

            {/* Mandatory Student Inputs Box */}
            {formRole === 'student' ? (
              <div className="p-3.5 bg-orange-50/70 border border-orange-200/80 rounded-xl space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                  <span>Required Student Details</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Register Number <span className="text-orange-600 font-extrabold">*</span>
                    </label>
                    <Input
                      placeholder="e.g. 24B91A0702"
                      value={formRoll}
                      onChange={e => setFormRoll(e.target.value)}
                      className="bg-white font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Student Name <span className="text-orange-600 font-extrabold">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Gowtham Krishna"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="bg-white font-bold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Assign Faculty Counselor
                  </label>
                  <select
                    value={formCounselorId}
                    onChange={e => setFormCounselorId(e.target.value)}
                    className="w-full h-[40px] px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium text-slate-800 text-[12px]"
                  >
                    <option value="">-- Select Faculty Counselor --</option>
                    {facultyList.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.department || 'Faculty'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Full Name <span className="text-orange-600 font-bold">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Dr. K. V. Sharma"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Email Address <span className="text-orange-600 font-bold">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="name@college.edu"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Department / Branch & Year / User ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Branch / Department</label>
                <select
                  value={formDept}
                  onChange={e => {
                    const newDept = e.target.value;
                    setFormDept(newDept);
                    if (formRole === 'student') {
                      if (newDept === 'CSD') setFormSection('CSD');
                      else if (formSection === 'CSD') setFormSection('CSIT-A');
                    }
                  }}
                  className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium text-slate-700 text-[13px]"
                >
                  <option value="CSD">CSD</option>
                  <option value="CSIT">CSIT</option>
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="MECH">MECH</option>
                  <option value="CIVIL">CIVIL</option>
                </select>
              </div>

              {formRole === 'student' ? (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Year</label>
                  <select
                    value={formYear}
                    onChange={e => setFormYear(e.target.value)}
                    className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium text-slate-700 text-[13px]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              ) : !editingUser ? (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">User ID</label>
                  <Input
                    placeholder="e.g. fac-002"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            {/* Semester & Section for Student */}
            {formRole === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Semester</label>
                  <select
                    value={formSem}
                    onChange={e => setFormSem(Number(e.target.value))}
                    className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium text-slate-700 text-[13px]"
                  >
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Section</label>
                  <select
                    value={formSection}
                    onChange={e => setFormSection(e.target.value)}
                    className="w-full h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-medium text-slate-700 text-[13px]"
                  >
                    <option value="CSD">CSD</option>
                    <option value="CSIT-A">CSIT-A</option>
                    <option value="CSIT-B">CSIT-B</option>
                  </select>
                </div>
              </div>
            )}

            {/* Student optional details: Email & User ID */}
            {formRole === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Email Address <span className="text-[10px] text-slate-400 font-normal">(auto-filled)</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="rollNumber@srkrec.ac.in"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                </div>
                {!editingUser && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      User ID <span className="text-[10px] text-slate-400 font-normal">(auto-filled)</span>
                    </label>
                    <Input
                      placeholder="stu-24B91A0702"
                      value={formId}
                      onChange={e => setFormId(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Password / 4-Digit Passcode Field */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {formRole === 'faculty' || formRole === 'hod' ? '4-Digit Passcode' : 'Password'}{' '}
                {editingUser ? (
                  <span className="text-[10px] text-slate-400">(leave blank to keep current)</span>
                ) : formRole === 'faculty' || formRole === 'hod' ? (
                  <span className="text-[10px] text-slate-400 font-normal">(defaults to 1234)</span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-normal">(defaults to Roll Number)</span>
                )}
              </label>
              <Input
                type="text"
                maxLength={formRole === 'faculty' || formRole === 'hod' ? 4 : undefined}
                placeholder={
                  editingUser
                    ? 'Leave blank to keep current'
                    : formRole === 'faculty' || formRole === 'hod'
                    ? 'e.g. 1234'
                    : 'Defaults to Roll Number'
                }
                value={formPass}
                onChange={e => setFormPass(e.target.value)}
              />
            </div>

            {/* Avatar URL Field */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Avatar Photo Link <span className="text-[10px] text-slate-400 font-normal">(optional — defaults to SRKR photo)</span>
              </label>
              <Input
                type="text"
                placeholder="https://srkrexams.in/SRKR/photo/24B91A0702.jpg"
                value={formAvatar}
                onChange={e => setFormAvatar(e.target.value)}
              />
            </div>

            {formError && (
              <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 font-medium">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="h-[38px] px-4 bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#374151] text-[13px] font-medium rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-[38px] px-5 bg-[#18181b] hover:bg-[#27272a] active:bg-[#09090b] text-white text-[13px] font-medium rounded-lg shadow-xs transition-all cursor-pointer"
              >
                {editingUser ? 'Save Updates' : 'Add User'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── CSV / Excel Preview Modal ───────────────────────────────── */}
        <Modal
          open={showPreviewModal}
          onClose={() => {
            if (!isUploading) {
              setShowPreviewModal(false);
              setPreviewData(null);
              setImportFile(null);
            }
          }}
          title="Import Preview"
          size="xl"
        >
          {previewData && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#edf0f2] border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#18181b] flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={16} color="#fff" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#18181b] truncate">{previewData.fileName}</p>
                    <p className="text-[11px] text-[#6b7280]">{(previewData.fileSize / 1024).toFixed(1)} KB • {previewData.totalRows} records found</p>
                  </div>
                </div>
                <span className="text-[11.5px] font-semibold bg-white text-[#18181b] px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                  {previewData.totalRows} {previewData.totalRows === 1 ? 'Record' : 'Records'}
                </span>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10.5px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                      {previewData.headers.map((h, i) => (
                        <th key={i} className="py-2.5 px-3 font-semibold text-[#18181b] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-center text-[11px] text-slate-400 font-mono">
                          {rIdx + 1}
                        </td>
                        {previewData.headers.map((h, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                            {row[h] || <span className="text-slate-300 italic">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setShowPreviewModal(false);
                    setPreviewData(null);
                    setImportFile(null);
                  }}
                  className="h-[38px] px-4 bg-[#edf0f2] hover:bg-[#e2e6e9] text-[#374151] text-[13px] font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleConfirmUpload}
                  className="h-[38px] px-5 bg-[#18181b] hover:bg-[#27272a] active:bg-[#09090b] text-white text-[13px] font-medium rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <span>Upload to Database ({previewData.totalRows})</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Global drag-over overlay ─────────────────────────────────── */}
        <AnimatePresence>
          {isDraggingOver && (
            <motion.div
              key="drag-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 300,
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
              >
                <Plus size={36} color="#ffffff" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}

      </div>
    </PageWrapper>
  );
}
