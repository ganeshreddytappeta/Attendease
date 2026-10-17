import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, UserCheck, UserPlus, Trash2, GraduationCap, Building2, CheckSquare, Square } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Avatar } from '../../components/shared/Avatar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../lib/api';
import { extractRollSuffix } from '../../lib/utils';

// Year roll number prefix mapping
const YEAR_PREFIX_MAP: Record<string, string> = {
  '1st Year': '26',
  '2nd Year': '25',
  '3rd Year': '24',
  '4th Year': '23',
};

// Generate standard roll numbers based on Section
function getRollNumbersForSection(sectionKey: string): string[] {
  if (sectionKey.includes('CSIT B') || sectionKey.includes('CSIT-B')) {
    const list: string[] = [];
    for (let i = 73; i <= 99; i++) list.push(String(i));
    for (let i = 0; i <= 9; i++) list.push(`A${i}`);
    for (let i = 0; i <= 9; i++) list.push(`B${i}`);
    for (let i = 0; i <= 9; i++) list.push(`C${i}`);
    list.push('D0', 'D1');
    for (let i = 1; i <= 12; i++) list.push(`LE${i}`);
    return list;
  }

  // CSD and CSIT A: 1 to 72
  return Array.from({ length: 72 }, (_, i) => String(i + 1));
}

// ── Bulletproof Normalization Helpers ──────────────────────────────────────────

export function normalizeStudentYear(student: api.AuthUser): string {
  const yr = (student.year || '').trim();
  if (yr) {
    if (/\b(4|IV|4TH|FOURTH|FINAL)\b/i.test(yr)) return '4th Year';
    if (/\b(3|III|3RD|THIRD)\b/i.test(yr)) return '3rd Year';
    if (/\b(2|II|2ND|SECOND)\b/i.test(yr)) return '2nd Year';
    if (/\b(1|I|1ST|FIRST)\b/i.test(yr)) return '1st Year';
  }

  if (student.semester) {
    const sem = Number(student.semester);
    if (sem >= 7) return '4th Year';
    if (sem >= 5) return '3rd Year';
    if (sem >= 3) return '2nd Year';
    if (sem >= 1) return '1st Year';
  }

  const roll = (student.rollNumber || student.id || '').toUpperCase().trim();
  if (roll.includes('95A') || roll.includes('LE')) {
    if (roll.startsWith('25')) return '3rd Year';
    if (roll.startsWith('24')) return '4th Year';
    if (roll.startsWith('26')) return '2nd Year';
  }

  if (roll.startsWith('26')) return '1st Year';
  if (roll.startsWith('25')) return '2nd Year';
  if (roll.startsWith('24')) return '3rd Year';
  if (roll.startsWith('23')) return '4th Year';

  return '3rd Year';
}

export function normalizeStudentSection(student: api.AuthUser): string {
  const sec = (student.section || '').trim().toUpperCase();
  const dept = (student.department || '').trim().toUpperCase();
  const roll = (student.rollNumber || student.id || '').toUpperCase().trim();

  // 1. CSD department or section
  if (sec.includes('CSD') || dept.includes('CSD')) {
    return 'CSD';
  }

  // 2. Direct section string matches
  if (/CSIT[\s-_]*B\b|^B$|SECTION[\s-_]*B/i.test(sec)) {
    return 'CSIT-B';
  }
  if (/CSIT[\s-_]*A\b|^A$|SECTION[\s-_]*A/i.test(sec)) {
    return 'CSIT-A';
  }

  // 3. Roll number pattern for CSIT / general students
  if (roll.includes('95A') || roll.includes('LE')) {
    return 'CSIT-B';
  }

  const suffix = extractRollSuffix(roll);
  if (/^[A-D]\d$/i.test(suffix)) {
    return 'CSIT-B';
  }

  const num = parseInt(suffix, 10);
  if (!isNaN(num)) {
    if (num > 72) return 'CSIT-B';
    if (num >= 1 && num <= 72) return 'CSIT-A';
  }

  return 'CSIT-A';
}

export default function AdminCounseling() {
  const queryClient = useQueryClient();
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState('3rd Year');
  const [selectedSection, setSelectedSection] = useState<'CSIT-A' | 'CSIT-B' | 'CSD'>('CSIT-A');
  const [searchFaculty, setSearchFaculty] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-select for unassigning assigned counselees
  const [selectedUnassignIds, setSelectedUnassignIds] = useState<string[]>([]);

  // Fetch admin counseling overview data
  const { data } = useQuery({
    queryKey: ['admin-counseling'],
    queryFn: () => api.getAdminCounselingData(),
  });

  const facultyCounselors = data?.facultyCounselors ?? [];
  const unassignedStudents = data?.unassignedStudents ?? [];

  // Combine all students across the institution
  const allStudents = useMemo(() => {
    const list: api.AuthUser[] = [...unassignedStudents];
    facultyCounselors.forEach(f => {
      if (f.counselees) {
        list.push(...f.counselees);
      }
    });
    return list;
  }, [unassignedStudents, facultyCounselors]);

  // All students belonging strictly to the selected Year & Section
  const currentSectionStudents = useMemo(() => {
    return allStudents.filter(
      s => normalizeStudentYear(s) === selectedYear && normalizeStudentSection(s) === selectedSection
    );
  }, [allStudents, selectedYear, selectedSection]);

  // Student map for the currently selected Year & Section (suffix/roll/id -> student)
  const currentSectionStudentsMap = useMemo(() => {
    const map = new Map<string, api.AuthUser>();

    currentSectionStudents.forEach(s => {
      const roll = (s.rollNumber || s.id || '').trim();
      const suffix = extractRollSuffix(roll);
      if (suffix) {
        map.set(suffix, s);
        map.set(suffix.toUpperCase(), s);
        if (/^\d+$/.test(suffix)) {
          map.set(String(parseInt(suffix, 10)), s);
          map.set(suffix.padStart(2, '0'), s);
        }
      }
      if (roll) {
        map.set(roll.toUpperCase(), s);
        map.set(roll, s);
      }
      if (s.id) {
        map.set(s.id, s);
      }
    });

    return map;
  }, [currentSectionStudents]);

  // Counselor map for current Year & Section (suffix/roll -> counselorName)
  const currentCounselorMap = useMemo(() => {
    const map = new Map<string, string>();
    facultyCounselors.forEach(f => {
      f.counselees?.forEach(s => {
        if (normalizeStudentYear(s) === selectedYear && normalizeStudentSection(s) === selectedSection) {
          const roll = (s.rollNumber || s.id || '').trim();
          const suffix = extractRollSuffix(roll);
          if (suffix) {
            map.set(suffix, f.name);
            map.set(suffix.toUpperCase(), f.name);
            if (/^\d+$/.test(suffix)) {
              map.set(String(parseInt(suffix, 10)), f.name);
              map.set(suffix.padStart(2, '0'), f.name);
            }
          }
          if (roll) {
            map.set(roll.toUpperCase(), f.name);
            map.set(roll, f.name);
          }
        }
      });
    });
    return map;
  }, [facultyCounselors, selectedYear, selectedSection]);

  // Section Roll Numbers list (standard + any extra students in DB)
  const sectionRollNumbers = useMemo(() => {
    const standardList = getRollNumbersForSection(selectedSection);
    const existingSuffixes = new Set(standardList);
    const extraSuffixes: string[] = [];

    currentSectionStudents.forEach(s => {
      const suffix = extractRollSuffix(s.rollNumber || s.id || '');
      if (suffix && !existingSuffixes.has(suffix)) {
        existingSuffixes.add(suffix);
        extraSuffixes.push(suffix);
      }
    });

    return [...standardList, ...extraSuffixes];
  }, [selectedSection, currentSectionStudents]);

  // Helper to find student from suffix
  const getStudentBySuffix = (suffix: string): api.AuthUser | undefined => {
    return (
      currentSectionStudentsMap.get(suffix) ||
      currentSectionStudentsMap.get(suffix.toUpperCase()) ||
      currentSectionStudentsMap.get(suffix.padStart(2, '0')) ||
      currentSectionStudentsMap.get(suffix.replace(/^0+/, ''))
    );
  };

  // Helper to find counselor from suffix
  const getCounselorBySuffix = (suffix: string): string | undefined => {
    return (
      currentCounselorMap.get(suffix) ||
      currentCounselorMap.get(suffix.toUpperCase()) ||
      currentCounselorMap.get(suffix.padStart(2, '0')) ||
      currentCounselorMap.get(suffix.replace(/^0+/, ''))
    );
  };

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: ({ facultyId, studentIds }: { facultyId: string; studentIds: string[] }) =>
      api.assignCounselingStudents(facultyId, studentIds),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-counseling'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedStudentIds([]);
      setToastMsg(`✅ ${res.message}`);
      setTimeout(() => setToastMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to assign students');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  // Unassign Single Mutation
  const unassignMutation = useMutation({
    mutationFn: (studentId: string) => api.unassignCounselingStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-counseling'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setToastMsg('✅ Student unassigned from counselor');
      setTimeout(() => setToastMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to unassign student');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  // Unassign Multiple Mutation
  const unassignMultipleMutation = useMutation({
    mutationFn: (studentIds: string[]) => api.unassignMultipleCounselingStudents(studentIds),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-counseling'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUnassignIds(prev => prev.filter(id => !selectedUnassignIds.includes(id)));
      setToastMsg(`✅ ${res.message || 'Selected students unassigned successfully'}`);
      setTimeout(() => setToastMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to unassign students');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  // Unassign All for a Faculty Mutation
  const unassignAllFacultyMutation = useMutation({
    mutationFn: (facultyId: string) => api.unassignAllFacultyCounselees(facultyId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-counseling'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUnassignIds([]);
      setToastMsg(`✅ ${res.message || 'All students unassigned from faculty'}`);
      setTimeout(() => setToastMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to unassign all students');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const handleToggleRollNumber = (suffix: string) => {
    const student = getStudentBySuffix(suffix);
    let targetId = '';

    if (student) {
      targetId = student.id || student.rollNumber || (student as any).userId;
    } else {
      const yrPrefix = YEAR_PREFIX_MAP[selectedYear] || '24';
      const formattedSuffix = /^\d+$/.test(suffix) ? String(suffix).padStart(2, '0') : suffix;
      const deptCode = selectedSection === 'CSD' ? 'A67' : 'A07';
      targetId = `${yrPrefix}B91${deptCode}${formattedSuffix}`;
    }

    if (!targetId) return;

    setSelectedStudentIds(prev =>
      prev.includes(targetId) ? prev.filter(i => i !== targetId) : [...prev, targetId]
    );
  };

  const handleSelectAllSection = () => {
    const idsToSelect: string[] = [];
    const yrPrefix = YEAR_PREFIX_MAP[selectedYear] || '24';

    sectionRollNumbers.forEach(suffix => {
      const student = getStudentBySuffix(suffix);
      if (student) {
        idsToSelect.push(student.id || student.rollNumber || (student as any).userId);
      } else {
        const formattedSuffix = /^\d+$/.test(suffix) ? String(suffix).padStart(2, '0') : suffix;
        const deptCode = selectedSection === 'CSD' ? 'A67' : 'A07';
        idsToSelect.push(`${yrPrefix}B91${deptCode}${formattedSuffix}`);
      }
    });
    setSelectedStudentIds(Array.from(new Set(idsToSelect)));
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleAssign = () => {
    if (!selectedFacultyId) {
      setErrorMsg('Please select a target Faculty member first on the left column.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    if (selectedStudentIds.length === 0) {
      setErrorMsg('Please select at least one student roll number to assign.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    assignMutation.mutate({ facultyId: selectedFacultyId, studentIds: selectedStudentIds });
  };

  // Toggle selection for removing counselees
  const handleToggleUnassignSelect = (studentId: string) => {
    setSelectedUnassignIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Toggle select all counselees for a faculty
  const handleToggleSelectAllFacultyCounselees = (counselees: api.AuthUser[]) => {
    const facultyStudentIds = counselees.map(s => s.id || (s as any).userId || s.rollNumber).filter(Boolean);
    const allSelected = facultyStudentIds.every(id => selectedUnassignIds.includes(id));

    if (allSelected) {
      setSelectedUnassignIds(prev => prev.filter(id => !facultyStudentIds.includes(id)));
    } else {
      setSelectedUnassignIds(prev => Array.from(new Set([...prev, ...facultyStudentIds])));
    }
  };

  const filteredFaculty = facultyCounselors.filter(f =>
    (f.name || '').toLowerCase().includes(searchFaculty.toLowerCase()) ||
    (f.department || '').toLowerCase().includes(searchFaculty.toLowerCase())
  );

  const selectedFacultyObj = facultyCounselors.find(f => f.id === selectedFacultyId || (f as any).userId === selectedFacultyId);

  // Statistics for the active Year & Section
  const assignedCount = currentSectionStudents.filter(s => s.counselorId).length;
  const unassignedCount = currentSectionStudents.length - assignedCount;

  return (
    <PageWrapper role="admin">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-[11px] font-semibold text-[#18181b] bg-[#edf0f2] px-2 py-0.5 rounded-[5px]">
            ADMIN PORTAL
          </span>
          <h1 className="text-[22px] font-bold text-[#18181b] tracking-tight mt-1">Faculty Counseling Management</h1>
          <p className="text-[13px] text-[#6b7280]">Assign and bulk manage student counseling mappings across all faculty members</p>
        </motion.div>

        {/* Toast Alerts */}
        {toastMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[13px] font-bold shadow-xs">
            {toastMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[13px] font-bold shadow-xs">
            {errorMsg}
          </div>
        )}

        {/* ── Step 1: Assignment Studio (2-Column Grid) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Select Faculty Counselor */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UserCheck size={18} className="text-orange-500" />
              <h2 className="text-[16px] font-bold text-slate-900">1. Select Faculty Counselor</h2>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter faculty by name…"
                value={searchFaculty}
                onChange={e => setSearchFaculty(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              />
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {filteredFaculty.map(f => {
                const isSelected = selectedFacultyId === f.id || selectedFacultyId === (f as any).userId;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFacultyId(f.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-orange-50/80 border-orange-300 ring-2 ring-orange-500/20'
                        : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={f.name} src={f.avatarUrl} size="sm" role="faculty" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-400">{f.department} • {f.email}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[10.5px] font-bold shrink-0">
                      {f.counselees?.length ?? 0} Students
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Roll Number Grid */}
          <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserPlus size={18} className="text-orange-500" />
                  <h2 className="text-[16px] font-bold text-slate-900">2. Select Students by Roll Number</h2>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={handleSelectAllSection}
                    className="text-orange-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Target Notice */}
              {selectedFacultyObj ? (
                <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[12px] text-orange-900 font-medium flex items-center justify-between">
                  <span>Assigning to: <strong>{selectedFacultyObj.name}</strong></span>
                  <span className="font-bold text-orange-700">{selectedStudentIds.length} Selected</span>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-500 font-medium italic">
                  👈 Select a faculty counselor on the left to assign students.
                </div>
              )}

              {/* Top Filter Controls: Year & Section */}
              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 space-y-2.5">
                {/* Year Selectors */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <GraduationCap size={13} className="text-orange-500" />
                    Year:
                  </span>
                  {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(yr => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setSelectedYear(yr);
                        setSelectedStudentIds([]);
                      }}
                      className={`px-3 py-1 font-bold rounded-lg cursor-pointer shrink-0 transition-all ${
                        selectedYear === yr
                          ? 'bg-orange-500 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>

                {/* Section Selectors */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                      <Building2 size={13} className="text-orange-500" />
                      Section:
                    </span>
                    {([
                      { id: 'CSD', label: 'CSD' },
                      { id: 'CSIT-A', label: 'CSIT - Sec A' },
                      { id: 'CSIT-B', label: 'CSIT - Sec B' },
                    ] as const).map(sec => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setSelectedSection(sec.id);
                          setSelectedStudentIds([]);
                        }}
                        className={`px-3 py-1 font-bold rounded-lg cursor-pointer shrink-0 transition-all ${
                          selectedSection === sec.id
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10.5px] font-medium text-slate-500 shrink-0">
                    {currentSectionStudents.length} in DB ({unassignedCount} unassigned)
                  </span>
                </div>
              </div>

              {/* ── Stationary Roll Number Buttons Grid (Dynamic per Year & Section) ── */}
              <div className="p-3 bg-slate-50/40 border border-slate-200/50 rounded-xl">
                <div className="flex flex-wrap justify-center gap-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                  {sectionRollNumbers.map(suffix => {
                    const student = getStudentBySuffix(suffix);
                    const yrPrefix = YEAR_PREFIX_MAP[selectedYear] || '24';
                    const formattedSuffix = /^\d+$/.test(suffix) ? String(suffix).padStart(2, '0') : suffix;
                    const deptCode = selectedSection === 'CSD' ? 'A67' : 'A07';
                    const targetId = student ? (student.id || student.rollNumber || (student as any).userId) : `${yrPrefix}B91${deptCode}${formattedSuffix}`;
                    
                    const isSelected = selectedStudentIds.includes(targetId);
                    const assignedCounselor = getCounselorBySuffix(suffix);

                    let buttonBg = 'bg-white border-slate-200/80 text-[#374151] hover:bg-[#edf0f2]';
                    if (isSelected) {
                      buttonBg = 'bg-[#18181b] border-[#18181b] text-white shadow-xs';
                    } else if (assignedCounselor) {
                      buttonBg = 'bg-[#edf0f2] border-slate-200 text-[#6b7280] hover:bg-slate-200';
                    }

                    return (
                      <motion.button
                        key={suffix}
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handleToggleRollNumber(suffix)}
                        className={`
                          w-[48px] h-[48px] sm:w-[50px] sm:h-[50px]
                          rounded-lg font-bold text-[13px] sm:text-[13.5px]
                          flex flex-col items-center justify-center
                          select-none cursor-pointer border shadow-2xs shrink-0
                          transition-all duration-150 relative
                          ${buttonBg}
                        `}
                        title={
                          student
                            ? `[${selectedYear} ${selectedSection}] Roll #${student.rollNumber || suffix} (${student.name}): ${assignedCounselor ? `Assigned to ${assignedCounselor}` : 'Unassigned'}`
                            : assignedCounselor
                            ? `[${selectedYear} ${selectedSection}] Roll #${suffix}: Assigned to ${assignedCounselor}`
                            : `[${selectedYear} ${selectedSection}] Roll #${suffix}: Click to select for assignment`
                        }
                      >
                        <span>{suffix}</span>
                        {assignedCounselor && !isSelected && (
                          <span className="text-[8px] opacity-75 truncate max-w-[42px]">
                            {assignedCounselor.split(' ')[0]}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAssign}
                disabled={assignMutation.isPending || !selectedFacultyId || selectedStudentIds.length === 0}
                className="w-full h-[40px] bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 text-white font-medium rounded-lg text-[13.5px] shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UserCheck size={15} />
                <span>Assign {selectedStudentIds.length} Student(s) to Counselor</span>
              </button>
            </div>
          </div>

        </div>

        {/* ── Step 2: Faculty Counseling Directory Overview (With Multi-Remove Support) ── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900">Current Faculty Counseling Directory</h2>
              <p className="text-[12px] text-slate-400">Select multiple counselees to batch remove or unassign all students from a faculty</p>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedUnassignIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to unassign ${selectedUnassignIds.length} selected student(s)?`)) {
                      unassignMultipleMutation.mutate(selectedUnassignIds);
                    }
                  }}
                  disabled={unassignMultipleMutation.isPending}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove Selected ({selectedUnassignIds.length})</span>
                </button>
              )}

              <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold">
                {facultyCounselors.length} Faculty Members
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {facultyCounselors.map(faculty => {
              const counselees = faculty.counselees || [];
              const facultyStudentIds = counselees.map(s => s.id || (s as any).userId || s.rollNumber).filter(Boolean);
              const selectedFromThisFaculty = facultyStudentIds.filter(id => selectedUnassignIds.includes(id));
              const allSelectedForThisFaculty = counselees.length > 0 && selectedFromThisFaculty.length === counselees.length;

              return (
                <div key={faculty.id} className="border border-slate-200/70 rounded-xl p-4 bg-slate-50/40 space-y-3">
                  {/* Faculty Header Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={faculty.name} src={faculty.avatarUrl} size="md" role="faculty" />
                      <div>
                        <h3 className="text-[15px] font-bold text-slate-900">{faculty.name}</h3>
                        <p className="text-[12px] text-slate-500">{faculty.department} • {faculty.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                      {counselees.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleSelectAllFacultyCounselees(counselees)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11.5px] font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {allSelectedForThisFaculty ? (
                              <>
                                <CheckSquare size={13} className="text-slate-900" />
                                <span>Deselect All</span>
                              </>
                            ) : (
                              <>
                                <Square size={13} className="text-slate-400" />
                                <span>Select All</span>
                              </>
                            )}
                          </button>

                          {selectedFromThisFaculty.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Unassign ${selectedFromThisFaculty.length} selected student(s) from ${faculty.name}?`)) {
                                  unassignMultipleMutation.mutate(selectedFromThisFaculty);
                                }
                              }}
                              disabled={unassignMultipleMutation.isPending}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 size={12} />
                              <span>Remove ({selectedFromThisFaculty.length})</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to unassign ALL ${counselees.length} student(s) from ${faculty.name}?`)) {
                                unassignAllFacultyMutation.mutate(faculty.id || (faculty as any).userId);
                              }
                            }}
                            disabled={unassignAllFacultyMutation.isPending}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 text-slate-600 rounded-lg text-[11.5px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title={`Unassign all ${counselees.length} students from this faculty member`}
                          >
                            <Trash2 size={12} />
                            <span>Remove All</span>
                          </button>
                        </>
                      )}

                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[12px] font-bold text-slate-700 shadow-2xs">
                        {counselees.length} Counselees
                      </span>
                    </div>
                  </div>

                  {/* Student Counselees Grid with Checkboxes */}
                  {counselees.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                      {counselees.map(st => {
                        const targetId = st.id || (st as any).userId || st.rollNumber;
                        const isChecked = selectedUnassignIds.includes(targetId);
                        const yr = normalizeStudentYear(st);
                        const sec = normalizeStudentSection(st);

                        return (
                          <div
                            key={targetId}
                            onClick={() => handleToggleUnassignSelect(targetId)}
                            className={`rounded-xl p-2.5 flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none border ${
                              isChecked
                                ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleUnassignSelect(targetId)}
                                onClick={e => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer accent-rose-600 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-slate-800 truncate leading-snug">{st.name}</p>
                                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-mono">
                                  <span>{st.rollNumber}</span>
                                  <span>•</span>
                                  <span className="text-[9.5px] font-sans font-medium px-1 py-0.2 bg-slate-100 rounded text-slate-600">{sec}</span>
                                  <span>•</span>
                                  <span className="text-[9.5px] font-sans font-medium text-slate-500">{yr}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Unassign ${st.name} (${st.rollNumber})?`)) {
                                  unassignMutation.mutate(targetId);
                                }
                              }}
                              className="w-6 h-6 rounded-md bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center cursor-pointer transition-all shrink-0"
                              title="Unassign Student"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-slate-400 italic pt-1">No counselees assigned to this faculty member yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}
