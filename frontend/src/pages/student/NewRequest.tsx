import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { UploadArea } from '../../components/forms/UploadArea';
import * as api from '../../lib/api';
import {
  ArrowLeft, CalendarDays, FileText, Upload,
  BookOpen, PenLine, Send, UserCheck, ChevronDown,
  Check, Zap, Calendar, ChevronsUpDown
} from 'lucide-react';
import { getFacultyInitials } from '../../lib/utils';

const schema = z
  .object({
    reason: z.string().min(1, 'Please select a reason'),
    facultyId: z.string().optional(),
    date: z.string().min(1, 'Please select a date'),
    startTime: z.string().min(1, 'Please enter start time'),
    endTime: z.string().min(1, 'Please enter end time'),
    description: z
      .string()
      .min(3, 'Description must be at least 3 characters')
      .max(500, 'Description must be under 500 characters'),
  })
  .refine(data => data.startTime < data.endTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

type FormData = z.infer<typeof schema>;

const reasonOptions = [
  { value: 'internship', label: 'Internship' },
  { value: 'startup', label: 'Startup Work' },
  { value: 'project_development', label: 'Project Development' },
  { value: 'medical', label: 'Medical Leave' },
  { value: 'sports', label: 'Sports Event' },
  { value: 'family_emergency', label: 'Family Emergency' },
  { value: 'competition', label: 'Competition' },
  { value: 'other', label: 'Other' },
];

const card = (extra: object = {}) => ({
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #EEF2F7',
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  ...extra,
});

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box' as const,
  height: 46, padding: '0 14px 0 40px',
  fontSize: 14, color: '#1E293B',
  background: '#F8FAFC', border: '1.5px solid #E8EDF2',
  borderRadius: 12, outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6,
};

const glassIconStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10,
  background: 'rgba(249, 115, 22, 0.12)',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(249, 115, 22, 0.25)',
  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

export default function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // New Period Selector & Leave Calendar State
  const [requestType, setRequestType] = useState<'permission' | 'leave'>('permission');
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([1, 2]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const togglePeriod = (id: number) => {
    setSelectedPeriods(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id].sort((a, b) => a - b)
    );
  };

  // Calculate start & end times based on selected period boxes
  const computedTimeRange = useMemo(() => {
    if (requestType === 'leave') {
      return { start: '09:00 AM', end: '04:30 PM', periodsStr: '1,2,3,4,5,6,7,8' };
    }
    if (selectedPeriods.length === 0) {
      return { start: '09:00 AM', end: '10:30 AM', periodsStr: '1,2' };
    }
    const timesMap: Record<number, { start: string; end: string }> = {
      1: { start: '09:00 AM', end: '09:45 AM' },
      2: { start: '09:45 AM', end: '10:30 AM' },
      3: { start: '10:30 AM', end: '11:15 AM' },
      4: { start: '11:15 AM', end: '12:00 PM' },
      5: { start: '01:30 PM', end: '02:15 PM' },
      6: { start: '02:15 PM', end: '03:00 PM' },
      7: { start: '03:00 PM', end: '03:45 PM' },
      8: { start: '03:45 PM', end: '04:30 PM' },
    };
    const sorted = [...selectedPeriods].sort((a, b) => a - b);
    const minP = sorted[0];
    const maxP = sorted[sorted.length - 1];
    return {
      start: timesMap[minP]?.start || '09:00 AM',
      end: timesMap[maxP]?.end || '12:00 PM',
      periodsStr: sorted.join(','),
    };
  }, [requestType, selectedPeriods]);

  const {
    data: rawFacultyList = [],
    isLoading: isFacultyLoading,
    isError: isFacultyError,
  } = useQuery({
    queryKey: ['faculty'],
    queryFn: () => api.getFaculty(),
  });

  const facultyList = (Array.isArray(rawFacultyList) ? rawFacultyList : [])
    .filter(f => f && f.name)
    .sort((a: api.Faculty, b: api.Faculty) =>
      (a.name || '').localeCompare(b.name || '')
    );

  const toggleFaculty = (id: string) => {
    setSelectedFacultyIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: '',
      facultyId: '',
      date: startDate,
      startTime: computedTimeRange.start,
      endTime: computedTimeRange.end,
      description: ''
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let uploadedDoc = { url: '', name: file ? file.name : '' };
      if (file) {
        uploadedDoc = await api.uploadProofDocument(file);
      }

      return api.createRequest({
        reason: data.reason as api.RequestReason,
        date: startDate,
        ...(requestType === 'leave' && endDate ? { endDate } : {}),
        periods: computedTimeRange.periodsStr,
        startTime: computedTimeRange.start,
        endTime: computedTimeRange.end,
        description: data.description,
        ...(selectedFacultyIds.length > 0
          ? { facultyIds: selectedFacultyIds, facultyId: selectedFacultyIds[0] }
          : data.facultyId
            ? { facultyId: data.facultyId, facultyIds: [data.facultyId] }
            : {}),
        ...(file ? {
          documentName: uploadedDoc.name || file.name,
          documentUrl: uploadedDoc.url || undefined,
        } : {}),
      });
    },
    onSuccess: (createdReq: any) => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/student/success', { state: { request: createdReq } });
    },
  });

  const onSubmit = (data: FormData) => {
    if (requestType === 'permission' && selectedPeriods.length === 0) {
      return;
    }
    mutation.mutate(data);
  };

  const isSubmitting = mutation.isPending;

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#F97316';
    e.target.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.08)';
    e.target.style.background = '#fff';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#E8EDF2';
    e.target.style.boxShadow = 'none';
    e.target.style.background = '#F8FAFC';
  };

  return (
    <PageWrapper role="student">
      <div style={{ maxWidth: 720 }}>

        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 38, height: 38, borderRadius: 11, border: '1px solid #E8EDF2',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748B', flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 2px' }}>New Attendance Request</h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Fill in the details below to submit your request</p>
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, delay: 0.05 }}
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >

          {/* Section 1 — Reason */}
          <div style={{ ...card({ padding: '22px 24px' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
              <div style={glassIconStyle}>
                <FileText size={15} style={{ color: '#EA580C' }} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Reason for Absence</h2>
            </div>

            <label style={labelStyle}>Select Reason</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <BookOpen size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <select
                {...register('reason')}
                onFocus={focusStyle as any}
                onBlur={blurStyle as any}
                style={{ ...inputStyle, appearance: 'none', paddingRight: 36, cursor: 'pointer' }}
              >
                <option value="">Select a reason...</option>
                {reasonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {errors.reason && <p style={{ fontSize: 12, color: '#DC2626', margin: '-10px 0 12px' }}>{errors.reason.message}</p>}

            {/* Target Faculty — Dropdown Box with Avatars */}
            <label style={labelStyle}>
              Point to Faculty Member(s)
            </label>

            {/* Custom Dropdown Trigger Box */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div
                onClick={() => setIsDropdownOpen(prev => !prev)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  minHeight: 50, padding: '8px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#F8FAFC', border: isDropdownOpen ? '1.5px solid #F97316' : '1.5px solid #E8EDF2',
                  borderRadius: 14, cursor: 'pointer',
                  boxShadow: isDropdownOpen ? '0 0 0 3px rgba(249,115,22,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {selectedFacultyIds.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {selectedFacultyIds.map(fId => {
                      const fac = facultyList.find((f: api.Faculty) => f.id === fId);
                      if (!fac) return null;
                      return (
                        <div
                          key={fac.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 10px 4px 6px', background: '#FFF7ED',
                            border: '1px solid #FED7AA', borderRadius: 10,
                          }}
                        >
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, overflow: 'hidden',
                            background: '#EA580C', color: '#ffffff', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700,
                          }}>
                            {fac.avatarUrl ? (
                              <img
                                src={fac.avatarUrl}
                                alt={fac.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.innerText = getFacultyInitials(fac.name);
                                  }
                                }}
                              />
                            ) : (
                              getFacultyInitials(fac.name)
                            )}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{fac.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94A3B8' }}>
                    <UserCheck size={18} style={{ color: '#94A3B8' }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Select Faculty Member from dropdown...</span>
                  </div>
                )}
                <ChevronDown size={18} style={{ color: '#64748B', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 8 }} />
              </div>

              {/* Dropdown Options List */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      marginTop: 6, zIndex: 40,
                      background: '#ffffff', border: '1.5px solid #E8EDF2',
                      borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      maxHeight: 300, overflowY: 'auto', padding: 6,
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    {isFacultyLoading ? (
                      <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                        Loading faculty...
                      </div>
                    ) : isFacultyError ? (
                      <div style={{ padding: '16px 12px', textAlign: 'center', color: '#EF4444', fontSize: 13 }}>
                        Failed to load faculty
                      </div>
                    ) : facultyList.length === 0 ? (
                      <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                        No faculty available
                      </div>
                    ) : (
                      facultyList.map((f: api.Faculty) => {
                        const isSelected = selectedFacultyIds.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              toggleFaculty(f.id);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                              background: isSelected ? '#FFF7ED' : 'transparent',
                              border: isSelected ? '1px solid #FED7AA' : '1px solid transparent',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#F8FAFC'; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: '#F97316', color: '#ffffff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700,
                                overflow: 'hidden', flexShrink: 0,
                              }}>
                                {f.avatarUrl ? (
                                  <img
                                    src={f.avatarUrl}
                                    alt={f.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = 'none';
                                      if (e.currentTarget.parentElement) {
                                        e.currentTarget.parentElement.innerText = getFacultyInitials(f.name);
                                      }
                                    }}
                                  />
                                ) : (
                                  getFacultyInitials(f.name)
                                )}
                              </div>
                              <span style={{
                                fontSize: 13, fontWeight: 600, color: '#0F172A',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {f.name}
                              </span>
                            </div>
                            <div style={{
                              width: 18, height: 18, borderRadius: 6,
                              border: isSelected ? 'none' : '1.5px solid #CBD5E1',
                              background: isSelected ? '#F97316' : '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', flexShrink: 0, marginLeft: 8,
                            }}>
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {facultyList.length > 4 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '6px 0 2px',
                        fontSize: 11, color: '#94A3B8', borderTop: '1px solid #F1F5F9',
                        marginTop: 2,
                      }}>
                        <ChevronsUpDown size={12} />
                        <span>Scroll to see all {facultyList.length} faculty</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 0' }}>
              Only selected faculty members (e.g. Class Mentor, Counselor, Subject Teacher) will be authorized to view &amp; approve your request.
            </p>
          </div>

          {/* Section 2 — Date, Duration & Period Selection */}
          <div style={{ ...card({ padding: '22px 24px', overflow: 'hidden' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
              <div style={glassIconStyle}>
                <CalendarDays size={15} style={{ color: '#EA580C' }} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Request Type &amp; Duration</h2>
            </div>

            {/* Request Type Selector Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#F8FAFC', padding: 3, borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => {
                  setRequestType('permission');
                  if (selectedPeriods.length === 0) setSelectedPeriods([1, 2]);
                }}
                style={{
                  flex: 1, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: requestType === 'permission' ? '#ffffff' : 'transparent',
                  color: requestType === 'permission' ? '#EA580C' : '#64748B',
                  boxShadow: requestType === 'permission' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Zap size={16} strokeWidth={2.2} style={{ color: requestType === 'permission' ? '#EA580C' : '#94A3B8' }} />
                <span>Short</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequestType('leave');
                  setEndDate(startDate);
                }}
                style={{
                  flex: 1, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: requestType === 'leave' ? '#ffffff' : 'transparent',
                  color: requestType === 'leave' ? '#EA580C' : '#64748B',
                  boxShadow: requestType === 'leave' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Calendar size={16} strokeWidth={2.2} style={{ color: requestType === 'leave' ? '#EA580C' : '#94A3B8' }} />
                <span>Long</span>
              </button>
            </div>

            {requestType === 'permission' ? (
              <>
                {/* Single Date Input */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Permission Date</label>
                  <div style={{ position: 'relative' }}>
                    <CalendarDays size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      onFocus={focusStyle as any}
                      onBlur={blurStyle as any}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* 8 Linear Period Selector Boxes */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>
                      Select Periods
                    </label>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', border: '1px solid #FFEDD5', padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                      {computedTimeRange.start} – {computedTimeRange.end}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {[
                      { id: 1, label: 'P1', time: '9:00 – 9:45' },
                      { id: 2, label: 'P2', time: '9:45 – 10:30' },
                      { id: 3, label: 'P3', time: '10:30 – 11:15' },
                      { id: 4, label: 'P4', time: '11:15 – 12:00' },
                      { id: 5, label: 'P5', time: '1:30 – 2:15' },
                      { id: 6, label: 'P6', time: '2:15 – 3:00' },
                      { id: 7, label: 'P7', time: '3:00 – 3:45' },
                      { id: 8, label: 'P8', time: '3:45 – 4:30' },
                    ].map(p => {
                      const isSel = selectedPeriods.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePeriod(p.id)}
                          style={{
                            padding: '9px 4px', borderRadius: 12, border: isSel ? '2px solid #F97316' : '1.5px solid #E8EDF2',
                            background: isSel ? '#FFF7ED' : '#F8FAFC',
                            color: isSel ? '#EA580C' : '#334155',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                            boxShadow: isSel ? '0 2px 8px rgba(249,115,22,0.15)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800 }}>{p.label}</span>
                          <span style={{ fontSize: 8.5, fontWeight: 600, opacity: isSel ? 0.95 : 0.6, whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>{p.time}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedPeriods.length === 0 && (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: '6px 0 0' }}>Please select at least one period</p>
                  )}
                </div>
              </>
            ) : (
              /* Multi-Day Leave Scroll Calendar Input */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>Start Date</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <CalendarDays size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        if (e.target.value > endDate) setEndDate(e.target.value);
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      onFocus={focusStyle as any}
                      onBlur={blurStyle as any}
                      style={{ ...inputStyle, padding: '0 8px 0 32px', fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>End Date</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <CalendarDays size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      min={startDate}
                      onFocus={focusStyle as any}
                      onBlur={blurStyle as any}
                      style={{ ...inputStyle, padding: '0 8px 0 32px', fontSize: 13, minWidth: 0, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3 — Description */}
          <div style={{ ...card({ padding: '22px 24px' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
              <div style={glassIconStyle}>
                <PenLine size={15} style={{ color: '#EA580C' }} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Description</h2>
            </div>

            <label style={labelStyle}>Describe your absence in detail</label>
            <textarea
              {...register('description')}
              placeholder="Provide a detailed explanation of why you were absent..."
              rows={5}
              onFocus={focusStyle as any}
              onBlur={blurStyle as any}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', fontSize: 14, color: '#1E293B',
                background: '#F8FAFC', border: '1.5px solid #E8EDF2',
                borderRadius: 12, outline: 'none', resize: 'vertical',
                lineHeight: 1.6, fontFamily: 'inherit',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '5px 0 0' }}>Minimum 20 characters</p>
            {errors.description && <p style={{ fontSize: 12, color: '#DC2626', margin: '4px 0 0' }}>{errors.description.message}</p>}
          </div>

          {/* Section 4 — Document */}
          <div style={{ ...card({ padding: '22px 24px' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
              <div style={glassIconStyle}>
                <Upload size={15} style={{ color: '#EA580C' }} />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Supporting Document <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>(Optional)</span></h2>
            </div>
            <UploadArea file={file} onFileSelect={setFile} />
          </div>

          {/* Mutation Error Banner */}
          {mutation.isError && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
              {(mutation.error as Error)?.message || 'Failed to submit request. Please check your inputs and try again.'}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, paddingBottom: 8 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                flex: 1, height: 48, borderRadius: 13,
                background: '#F8FAFC', border: '1.5px solid #E8EDF2',
                color: '#64748B', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2, height: 48, borderRadius: 13,
                background: isSubmitting ? '#FED7AA' : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(249,115,22,0.30)',
                transition: 'all 0.15s',
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </motion.form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageWrapper>
  );
}
