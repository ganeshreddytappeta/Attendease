/**
 * Typed API client for AttendEase
 * Reads VITE_API_URL (defaults to http://localhost:3000)
 * Attaches JWT from localStorage to every authenticated request
 */

export const getApiBase = (): string => {
  // VITE_API_URL always takes priority (covers localhost dev with custom port)
  const envUrl = (import.meta.env['VITE_API_URL'] || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // If running in browser on localhost / 127.0.0.1 with no env override, target local backend
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3000';
  }

  // Production fallback (Render)
  return 'https://attendease-apuw.onrender.com';
};

// NOTE: Always call getApiBase() dynamically in fetch calls rather than using this constant
// so that the URL is resolved at request time, not frozen at module-load time.
export const BASE = getApiBase();

const TOKEN_KEY = 'attendease_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string, remember: boolean = true): void {
  // Always persist to localStorage so session survives tab/browser close.
  // The `remember` flag is kept for API compatibility but no longer changes behaviour
  // because the only way to end a session is an explicit logout.
  localStorage.setItem(TOKEN_KEY, token);
  if (remember) {
    localStorage.setItem('attendease_remember_me', 'true');
  }
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('attendease_remember_me');
  localStorage.removeItem('attendease_saved_user');
}

export function getSavedUser<T = any>(): T | null {
  try {
    const raw = localStorage.getItem('attendease_saved_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSavedUser(user: any): void {
  if (user) {
    try {
      localStorage.setItem('attendease_saved_user', JSON.stringify(user));
    } catch {}
  } else {
    localStorage.removeItem('attendease_saved_user');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type RequestReason = 'internship' | 'startup' | 'project_development' | 'medical' | 'sports' | 'family_emergency' | 'competition' | 'other';
export type UserRole = 'student' | 'faculty' | 'hod' | 'admin';

export interface AuthUser {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  designation?: string;
  rollNumber?: string;
  semester?: number;
  year?: string;
  section?: string;
  avatarUrl?: string;
  phone?: string;
  counselorId?: string;
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  email: string;
  section?: string;
  year?: string;
  avatarUrl?: string;
}

export interface Faculty {
  id: string;
  userId?: string;
  name: string;
  department: string;
  email: string;
  designation?: string;
  role?: string;
  avatarUrl?: string;
}

export interface RequestActionItem {
  id: string;
  action: string;
  remarks?: string;
  performedAt: string;
  performedBy: {
    id: string;
    name: string;
    role?: string;
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  requestId?: string;
}

export interface AttendanceRequest {
  id: string;
  requestId?: string;
  publicId?: string;
  studentId: string;
  student?: Student;
  studentName?: string;
  rollNumber?: string;
  department?: string;
  semester?: number | string;
  facultyName?: string;
  reason: RequestReason;
  reasonLabel: string;
  date: string;
  endDate?: string;
  periods?: string;
  startTime: string;
  endTime: string;
  description: string;
  documentName?: string;
  documentUrl?: string;
  status: RequestStatus;
  rejectionReason?: string;
  submittedAt: string;
  facultyId?: string;
  faculty?: Faculty;
  facultyIds?: string[];
  primaryFacultyId?: string;
  primaryFaculty?: Faculty;
  shareToken?: string;
  shareUrl?: string;
  faculties?: Faculty[];
  reviewedAt?: string;
  finalDecisionBy?: 'Faculty' | 'HOD' | string;
  finalDecisionUserId?: string;
  finalDecisionName?: string;
  actions?: RequestActionItem[];
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (auth) {
    const token = getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const reqInit = { ...options, headers };
  // Always call getApiBase() dynamically — never use the frozen BASE constant
  // This ensures mobile devices and different environments always get the correct URL
  const currentBase = getApiBase();
  let res: Response | null = null;
  try {
    res = await fetch(`${currentBase}${path}`, reqInit);
  } catch {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const fallbackBases = isLocal
      ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'].filter(b => b !== currentBase)
      : ['https://attendease-apuw.onrender.com'].filter(b => b !== currentBase);
    for (const fb of fallbackBases) {
      try {
        const fbRes = await fetch(`${fb}${path}`, reqInit);
        res = fbRes;
        break;
      } catch {
        // try next fallback port
      }
    }
  }

  if (!res) {
    throw new Error('Unable to connect to backend server. Please make sure the backend is running.');
  }

  if (!res.ok) {
    if (res.status === 401 && auth && !path.includes('/auth/login') && !path.includes('/api/activities') && !path.includes('/api/admin/coordinators')) {
      clearStoredToken();
    }
    const body = await res.json().catch(() => ({ error: res.statusText || 'API error' }));
    throw new Error((body as { error?: string }).error ?? 'API error');
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(
  identifier: string,
  password: string,
  role: UserRole,
): Promise<{ token: string; user: AuthUser; hasPasskey?: boolean; passkeyCount?: number }> {
  return apiFetch<{ token: string; user: AuthUser; hasPasskey?: boolean; passkeyCount?: number }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ identifier, password, role }) },
    false,
  );
}

export async function registerPasskeyChallenge(identifier?: string): Promise<any> {
  return apiFetch<any>('/api/auth/passkey/register-challenge', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function registerPasskey(
  credentialId: string,
  publicKey?: string,
  deviceName?: string,
  identifier?: string,
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/passkey/register', {
    method: 'POST',
    body: JSON.stringify({ credentialId, publicKey, deviceName, identifier }),
  });
}

export async function loginPasskeyChallenge(identifier: string): Promise<{
  challenge: string;
  hasPasskey: boolean;
  user: { userId: string; email: string; name: string };
  allowCredentials: { id: string; type: string }[];
}> {
  return apiFetch('/api/auth/passkey/login-challenge', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  }, false);
}

export async function verifyPasskeyLogin(
  identifier: string,
  credentialId?: string,
): Promise<{ token: string; user: AuthUser }> {
  return apiFetch<{ token: string; user: AuthUser }>('/api/auth/passkey/verify', {
    method: 'POST',
    body: JSON.stringify({ identifier, credentialId }),
  }, false);
}

export async function listPasskeys(): Promise<{ devices: { id: string; credentialId: string; deviceName?: string; createdAt: string; lastUsedAt: string }[] }> {
  return apiFetch('/api/auth/passkey/list');
}

export async function removePasskey(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/auth/passkey/remove/${id}`, { method: 'DELETE' });
}

export async function removeAllPasskeys(): Promise<{ success: boolean }> {
  return apiFetch('/api/auth/passkey/remove-all', { method: 'DELETE' });
}

export interface PublicFacultyMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation?: string;
  avatarUrl?: string;
}

export async function getPublicFacultyList(): Promise<PublicFacultyMember[]> {
  try {
    const res = await apiFetch<{ faculty: PublicFacultyMember[] }>('/api/auth/public-faculty', {}, false);
    return res.faculty;
  } catch {
    return [];
  }
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
  clearStoredToken();
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface GetRequestsParams {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
  department?: string;
  [key: string]: any;
}

export async function getRequests(
  params?: GetRequestsParams,
): Promise<AttendanceRequest[] & { total?: number; hasMore?: boolean }> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const url = `/api/requests${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await apiFetch<{ requests: AttendanceRequest[]; total?: number; hasMore?: boolean }>(url);
  const arr = (res.requests || []) as AttendanceRequest[] & { total?: number; hasMore?: boolean };
  arr.total = res.total ?? arr.length;
  arr.hasMore = res.hasMore ?? false;
  return arr;
}

export async function getRequestsSummary(): Promise<{
  stats: { total: number; pending: number; approved: number; rejected: number };
  recent: AttendanceRequest[];
}> {
  return await apiFetch<{
    stats: { total: number; pending: number; approved: number; rejected: number };
    recent: AttendanceRequest[];
  }>('/api/requests/summary');
}

export async function getPublicApprovedRequests(params?: {
  date?: string;
  section?: string;
  year?: string;
  department?: string;
}): Promise<AttendanceRequest[]> {
  const queryParams = new URLSearchParams();
  if (params?.date) queryParams.set('date', params.date);
  if (params?.section) queryParams.set('section', params.section);
  if (params?.year) queryParams.set('year', params.year);
  if (params?.department) queryParams.set('department', params.department);

  const url = `/api/requests/public-approved${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await apiFetch<{ requests: AttendanceRequest[] }>(url, {}, false);
  return res.requests;
}

export async function getRequest(id: string): Promise<AttendanceRequest> {
  const res = await apiFetch<{ request: AttendanceRequest }>(`/api/requests/${id}`);
  return res.request;
}

export interface CreateRequestPayload {
  reason: RequestReason;
  date: string;
  endDate?: string;
  periods?: string;
  startTime: string;
  endTime: string;
  description: string;
  documentName?: string;
  documentUrl?: string;
  facultyId?: string;
  facultyIds?: string[];
}

export async function uploadProofDocument(file: File): Promise<{ url: string; name: string }> {
  // 1. Try uploading via Backend Cloudinary upload route
  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const dataUrl = await base64Promise;

    const res = await apiFetch<{ url: string; documentName: string }>('/api/requests/upload-proof', {
      method: 'POST',
      body: JSON.stringify({ file: dataUrl, filename: file.name }),
    });

    if (res && res.url) {
      console.log('Proof uploaded via backend Cloudinary endpoint:', res.url);
      return { url: res.url, name: res.documentName || file.name };
    }
  } catch (err) {
    console.warn('Backend upload-proof endpoint error, trying direct Cloudinary upload:', err);
  }

  // 2. Direct Cloudinary upload fallback
  try {
    const cloudName = import.meta.env['VITE_CLOUDINARY_CLOUD_NAME'] || 'yp5l3jrg';
    const uploadPreset = import.meta.env['VITE_CLOUDINARY_UPLOAD_PRESET'] || 'attendease_proofs';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      const directUrl = data.secure_url || data.url;
      if (directUrl) {
        console.log('Proof uploaded directly to Cloudinary:', directUrl);
        return { url: directUrl, name: file.name };
      }
    }
  } catch (err) {
    console.warn('Direct Cloudinary upload error:', err);
  }

  return { url: '', name: file.name };
}

export async function createRequest(data: CreateRequestPayload): Promise<AttendanceRequest> {
  const res = await apiFetch<{ request: AttendanceRequest }>(
    '/api/requests',
    { method: 'POST', body: JSON.stringify(data) },
  );
  return res.request;
}

export async function updateRequest(id: string, data: Partial<CreateRequestPayload>): Promise<AttendanceRequest> {
  const res = await apiFetch<{ request: AttendanceRequest }>(
    `/api/requests/${id}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
  return res.request;
}

export async function deleteRequest(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/requests/${id}`, {
    method: 'DELETE',
  });
}

export async function reviewRequest(
  id: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
  asHodOrPeriods?: boolean | string,
  periodsParam?: string,
): Promise<AttendanceRequest> {
  const periods = typeof asHodOrPeriods === 'string' ? asHodOrPeriods : periodsParam;

  const res = await apiFetch<{ request: AttendanceRequest }>(
    `/api/requests/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        action,
        rejectionReason,
        ...(periods ? { periods } : {}),
      }),
    },
  );
  return res.request;
}

export async function bulkReviewRequests(
  requestIds: string[],
  action: 'approve' | 'reject',
  rejectionReason?: string,
): Promise<{ success: boolean; count: number; requests: AttendanceRequest[]; skippedCount?: number }> {
  return apiFetch<{ success: boolean; count: number; requests: AttendanceRequest[]; skippedCount?: number }>(
    '/api/requests/bulk-review',
    {
      method: 'POST',
      body: JSON.stringify({ requestIds, action, rejectionReason }),
    },
  );
}

export async function cancelRequest(id: string): Promise<AttendanceRequest> {
  const res = await apiFetch<{ request: AttendanceRequest }>(
    `/api/requests/${id}/cancel`,
    { method: 'POST' },
  );
  return res.request;
}

export async function getRequestActions(id: string): Promise<RequestActionItem[]> {
  const res = await apiFetch<{ actions: RequestActionItem[] }>(`/api/requests/${id}/actions`);
  return res.actions;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<NotificationItem[]> {
  const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
  return res.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getFaculty(): Promise<Faculty[]> {
  const res = await apiFetch<{ faculty: Faculty[] }>('/api/users/faculty');
  return res.faculty;
}

export async function getMe(): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>('/api/users/me');
  return res.user;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatarUrl?: string;
  phone?: string;
  designation?: string;
  semester?: number;
  currentPassword?: string;
  password?: string;
}

export async function updateMe(data: UpdateProfilePayload): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.user;
}

// ─── Admin Users API ──────────────────────────────────────────────────────────

export interface CreateUserPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  password?: string;
  rollNumber?: string;
  semester?: number;
  year?: string;
  section?: string;
  designation?: string;
  phone?: string;
  counselorId?: string;
}

export async function getUsers(role?: string): Promise<AuthUser[]> {
  if (role === 'student') {
    try {
      const res = await apiFetch<{ students: AuthUser[] }>('/api/users/students');
      return res.students || [];
    } catch {
      return [];
    }
  }
  const url = role ? `/api/admin/users?role=${encodeURIComponent(role)}` : '/api/admin/users';
  const res = await apiFetch<{ users: AuthUser[] }>(url);
  const list = res.users ?? [];
  if (role) {
    return list.filter(u => u.role === role);
  }
  return list;
}

export async function createUser(data: CreateUserPayload): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.user;
}

export async function updateUser(id: string, data: Partial<CreateUserPayload>): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.user;
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function deleteMultipleUsers(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
  return apiFetch<{ success: boolean; deletedCount: number }>('/api/admin/users/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ userIds: ids }),
  });
}


export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  await apiFetch(`/api/admin/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password: newPassword }),
  });
}

// ─── Database Explorer API ──────────────────────────────────────────────────

export interface DBTableOverview {
  name: string;
  label: string;
  description: string;
  count: number;
  columns: string[];
}

export interface DBOverviewResponse {
  success: boolean;
  database: string;
  totalTables: number;
  tables: DBTableOverview[];
}

export interface DBTableDataResponse {
  success: boolean;
  tableName: string;
  label: string;
  description: string;
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
  columns: string[];
  rows: Record<string, any>[];
}

export async function getDatabaseOverview(): Promise<DBOverviewResponse> {
  return apiFetch<DBOverviewResponse>('/api/admin/database/overview');
}

export async function getDatabaseTableData(
  tableName: string,
  params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
): Promise<DBTableDataResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<DBTableDataResponse>(`/api/admin/database/tables/${tableName}${qStr}`);
}

export async function exportDatabaseTable(tableName: string): Promise<any> {
  return apiFetch<any>(`/api/admin/database/export/${tableName}`);
}

export interface ImportReport {
  inserted: number;
  skipped: number;
  upserted: number;
  failed: Array<{ row?: number; rollNumber?: string; reason: string }>;
}

export async function importStudentsFile(file: File): Promise<ImportReport> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const bases = isLocal
    ? [BASE, '', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'].filter((v, i, a) => a.indexOf(v) === i)
    : [BASE, 'https://attendease-apuw.onrender.com'].filter((v, i, a) => a.indexOf(v) === i);
  let lastError: any = null;
  let response: Response | null = null;

  for (const b of bases) {
    try {
      const res = await fetch(`${b}/api/admin/students/import`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (res.status === 404) continue;
      response = res;
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!response) {
    throw lastError || new Error('Failed to connect to backend server');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to import students file');
  }
  return data.import;
}

// ─── Attendance API ──────────────────────────────────────────────────────────

export interface AttendanceRecordItem {
  id: string;
  submissionId: string;
  rollNumber: string;
  status: 'present' | 'absent';
}

export interface AttendanceSubmissionItem {
  id: string;
  date: string;
  section: string;
  year: string;
  periods: string;
  periodLabel: string;
  markedById: string;
  createdAt: string;
  updatedAt: string;
  markedBy: {
    userId: string;
    name: string;
    email: string;
    department: string;
  };
  records: AttendanceRecordItem[];
}

export interface SubmitAttendancePayload {
  date: string;
  section: string;
  year?: string;
  periods: string;
  periodLabel?: string;
  records: { rollNumber: string; status: 'present' | 'absent' }[];
}

export interface PublicSectionItem {
  id?: string;
  key: string;
  department: string;
  section: string;
  year: string;
  label: string;
  value: string;
  displayName?: string;
  rollNumbers: string[];
  studentCount: number;
  students?: Array<{
    userId: string;
    name: string;
    rollNumber: string;
    displayRoll?: string;
    suffix: string;
    isColliding?: boolean;
  }>;
}

export async function getPublicSections(year?: string): Promise<PublicSectionItem[]> {
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  const queryString = params.toString();
  const url = `/api/requests/public-sections${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch<{ sections: PublicSectionItem[] }>(url, {}, false);
  return res.sections ?? [];
}

export async function getStudentsRoster(year?: string): Promise<PublicSectionItem[]> {
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  const queryString = params.toString();
  const url = `/api/students/roster${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch<{ sections: PublicSectionItem[] }>(url, {}, false);
  return res.sections ?? [];
}

export async function getAttendanceSubmissions(date?: string, section?: string, year?: string): Promise<AttendanceSubmissionItem[]> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (section) params.append('section', section);
  if (year) params.append('year', year);

  const queryString = params.toString();
  const url = `/api/attendance${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch<{ submissions: AttendanceSubmissionItem[] }>(url, {}, false);
  return res.submissions ?? [];
}

export async function submitSectionAttendance(payload: SubmitAttendancePayload): Promise<AttendanceSubmissionItem> {
  const res = await apiFetch<{ submission: AttendanceSubmissionItem }>('/api/attendance/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.submission;
}

export interface CounseleeStudent extends AuthUser {
  stats?: {
    conductedCount: number;
    presentCount: number;
    approvedPermissionsCount: number;
    absentCount: number;
    percentage: number;
  };
}

export async function getCounselees(): Promise<CounseleeStudent[]> {
  const res = await apiFetch<{ counselees: CounseleeStudent[] }>('/api/users/counselees');
  return res.counselees ?? [];
}

export async function updateCounseleeAttendance(payload: {
  studentId: string;
  conductedCount?: number;
  presentCount?: number;
  percentage?: number;
}): Promise<{ success: boolean; message: string; stats?: any }> {
  return apiFetch('/api/users/counselee-attendance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface FacultyCounselorOverview extends AuthUser {
  counselees: AuthUser[];
}

export interface AdminCounselingData {
  facultyCounselors: FacultyCounselorOverview[];
  unassignedStudents: AuthUser[];
}

export async function getAdminCounselingData(): Promise<AdminCounselingData> {
  return apiFetch<AdminCounselingData>('/api/users/counseling/all');
}

export async function assignCounselingStudents(facultyId: string, studentIds: string[]): Promise<{ success: boolean; message: string; count: number }> {
  return apiFetch('/api/users/counseling/assign', {
    method: 'POST',
    body: JSON.stringify({ facultyId, studentIds }),
  });
}

export async function unassignCounselingStudent(studentId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch('/api/users/counseling/unassign', {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export async function unassignMultipleCounselingStudents(studentIds: string[]): Promise<{ success: boolean; message: string; count?: number }> {
  return apiFetch('/api/users/counseling/unassign', {
    method: 'POST',
    body: JSON.stringify({ studentIds }),
  });
}

export async function unassignAllFacultyCounselees(facultyId: string): Promise<{ success: boolean; message: string; count?: number }> {
  return apiFetch('/api/users/counseling/unassign', {
    method: 'POST',
    body: JSON.stringify({ facultyId, unassignAll: true }),
  });
}

export interface SharePassResponse {
  success: boolean;
  request?: AttendanceRequest;
  authInfo?: {
    isGuest?: boolean;
    canReview?: boolean;
    isStudentOwner?: boolean;
    isAssignedFaculty?: boolean;
    isHOD?: boolean;
    role?: string;
    user?: { id: string; name: string; email: string; role: string };
    recommendedRedirect?: string;
  };
  error?: string;
  status?: number;
}

export async function getSharePassView(publicId: string): Promise<SharePassResponse> {
  return apiFetch<SharePassResponse>(`/api/share/view/${encodeURIComponent(publicId)}`);
}

export async function quickReviewSharePass(
  publicId: string,
  action: 'approve' | 'reject',
  payload?: { rejectionReason?: string; remarks?: string; facultyPin?: string; facultyEmail?: string }
): Promise<{ success: boolean; message: string; request: AttendanceRequest }> {
  return apiFetch<{ success: boolean; message: string; request: AttendanceRequest }>(`/api/share/quick-review/${encodeURIComponent(publicId)}`, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });
}

export async function getShareRedirect(publicId: string): Promise<{ success: boolean; redirectTo?: string; status?: number; error?: string }> {
  return apiFetch<{ success: boolean; redirectTo?: string; status?: number; error?: string }>(`/api/share/${encodeURIComponent(publicId)}`);
}

export interface HODDirectExemptionPayload {
  studentIds: string[];
  reason: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  periods?: string;
  description?: string;
}

export async function grantHODDirectExemption(payload: HODDirectExemptionPayload): Promise<{ success: boolean; message: string; count: number; requests: AttendanceRequest[] }> {
  return apiFetch('/api/requests/hod-direct-grant', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAllStudents(): Promise<Student[]> {
  const res = await apiFetch<{ students: Student[] }>('/api/users/students');
  return res.students ?? [];
}

export async function changePin(currentPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/api/auth/change-pin', {
    method: 'POST',
    body: JSON.stringify({ currentPin, newPin }),
  });
}

export async function sendChatMessage(messages: { role: string; content: string }[]): Promise<{ reply?: string; error?: string }> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error(`Chat server returned status ${res.status}`);
  }

  return res.json();
}

export type ShareViewerType = 'STUDENT_OWNER' | 'FACULTY' | 'HOD' | 'ADMIN';
export type ShareDestination = 'STUDENT_VIEW' | 'FACULTY_REVIEW' | 'HOD_REVIEW' | 'ADMIN_REVIEW';

export interface ShareTokenResolutionResult {
  success: boolean;
  authorized?: boolean;
  authenticated?: boolean;
  viewerType?: ShareViewerType;
  destination?: ShareDestination;
  requestId?: string;
  role?: UserRole;
  isOwner?: boolean;
  viewMode?: 'read-only';
  redirectPath?: string;
  redirectUrl?: string;
  error?: string;
  isRevoked?: boolean;
  isExpired?: boolean;
}

export async function resolveShareToken(shareToken: string): Promise<ShareTokenResolutionResult> {
  const base = getApiBase();
  const token = getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${base}/api/share/token/${encodeURIComponent(shareToken.trim())}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json().catch(() => ({ error: 'Invalid server response' }));
    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          authenticated: false,
          redirectUrl: data.redirectUrl || `/login?redirect=/r/${encodeURIComponent(shareToken.trim())}`,
          error: data.message || 'Please log in to view this request.',
        };
      }
      return {
        success: false,
        authorized: false,
        error: data.error || "Request not found or you don't have permission to view it.",
        isRevoked: Boolean(data.isRevoked),
        isExpired: Boolean(data.isExpired),
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      authorized: false,
      error: err.message || 'Network error resolving share link.',
    };
  }
}

export async function getRequestShareLink(requestId: string): Promise<{ success: boolean; shareToken: string; shareUrl: string }> {
  return apiFetch<{ success: boolean; shareToken: string; shareUrl: string }>(`/api/requests/${encodeURIComponent(requestId)}/share-link`);
}

export async function revokeShareToken(shareToken: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/share/revoke/${encodeURIComponent(shareToken)}`, {
    method: 'POST',
  });
}

// ─── Invigilation Management (Admin) ──────────────────────────────────────────

export type ExamType = 'MID' | 'SEM' | 'LAB' | 'SUPPLEMENTARY';
export type SessionType = 'MORNING' | 'AFTERNOON';

export interface AssignedFacultyInfo {
  assignmentId: string;
  facultyId: string;   // User.id (cuid)
  userId: string;      // User.userId (e.g. "fac-001")
  name: string;
  email: string;
  department: string;
  designation?: string | null;
}

export interface InvigilationDuty {
  id: string;
  examType: ExamType;
  date: string;        // YYYY-MM-DD in Asia/Kolkata
  session: SessionType;
  startTime: string | null;  // HH:mm or null
  endTime: string | null;    // HH:mm or null
  createdAt: string;
  updatedAt: string;
  assignedFaculty: AssignedFacultyInfo[];
}

export interface InvigilationDutyListResponse {
  duties: InvigilationDuty[];
  total: number;
}

export interface FacultyAssignmentInput {
  facultyId: string;  // User.id or User.userId — backend resolves both
}

export interface CreateDutyPayload {
  examType: ExamType;
  date: string;        // YYYY-MM-DD
  session: SessionType;
  startTime?: string | null;  // HH:mm, optional
  endTime?: string | null;    // HH:mm, optional
  assignedFaculty: FacultyAssignmentInput[];
}

export interface UpdateDutyPayload {
  examType?: ExamType;
  date?: string;
  session?: SessionType;
  startTime?: string | null;
  endTime?: string | null;
  assignedFaculty?: FacultyAssignmentInput[];
}

export interface InvigilationFilterParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  examType?: ExamType;
  session?: SessionType;
  facultyId?: string;
  department?: string;
}

export async function getInvigilationDuties(params?: InvigilationFilterParams): Promise<InvigilationDutyListResponse> {
  const query = new URLSearchParams();
  if (params) {
    if (params.date) query.append('date', params.date);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.examType) query.append('examType', params.examType);
    if (params.session) query.append('session', params.session);
    if (params.facultyId) query.append('facultyId', params.facultyId);
    if (params.department) query.append('department', params.department);
  }
  const queryString = query.toString();
  const endpoint = `/api/admin/invigilation${queryString ? `?${queryString}` : ''}`;
  return apiFetch<InvigilationDutyListResponse>(endpoint);
}

export async function getInvigilationDuty(id: string): Promise<InvigilationDuty> {
  const res = await apiFetch<{ duty: InvigilationDuty }>(`/api/admin/invigilation/${encodeURIComponent(id)}`);
  return res.duty;
}

export async function createInvigilationDuty(data: CreateDutyPayload): Promise<InvigilationDuty> {
  const res = await apiFetch<{ duty: InvigilationDuty }>('/api/admin/invigilation', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.duty;
}

export async function updateInvigilationDuty(id: string, data: UpdateDutyPayload): Promise<InvigilationDuty> {
  const res = await apiFetch<{ duty: InvigilationDuty }>(`/api/admin/invigilation/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.duty;
}

export async function deleteInvigilationDuty(id: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/admin/invigilation/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Faculty Invigilation Duties ──────────────────────────────────────────────

export interface FacultyInvigilationDuty {
  id: string;
  examType: ExamType;
  date: string;        // YYYY-MM-DD in Asia/Kolkata
  session: SessionType;
  startTime: string | null;  // HH:mm or null
  endTime: string | null;    // HH:mm or null
  status: 'UPCOMING' | 'COMPLETED';
  isToday?: boolean;
  isPast?: boolean;
  coInvigilators?: Array<{
    id: string;
    name: string;
    department?: string;
    email?: string;
  }>;
}

export interface FacultyInvigilationListResponse {
  duties: FacultyInvigilationDuty[];
  total: number;
}

export async function getMyInvigilationDuties(options?: { all?: boolean; scope?: string }): Promise<FacultyInvigilationListResponse> {
  const query = options?.all ? '?all=true' : options?.scope ? `?scope=${options.scope}` : '';
  return apiFetch<FacultyInvigilationListResponse>(`/api/invigilation/my-duties${query}`);
}

// ─── Student Activities & Coordinator Management API ──────────────────────────

export type ActivityCategory = 'internship' | 'startup' | 'project_work' | 'sports' | 'house_events';

export interface StudentActivity {
  id: string;
  studentId: string;
  category: ActivityCategory;
  titleOrCompany: string;
  roleOrPosition?: string;
  mentorOrAchievement?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    userId: string;
    name: string;
    email: string;
    rollNumber?: string;
    department?: string;
    year?: string;
    section?: string;
    semester?: number;
    avatarUrl?: string;
  };
}

export interface CoordinatorAccess {
  id: string;
  facultyId: string;
  category: ActivityCategory;
  codeMasked: string;
  isActive: boolean;
  assignedById: string;
  createdAt: string;
  updatedAt: string;
  faculty?: {
    id: string;
    userId: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
  };
  assignedBy?: {
    userId: string;
    name: string;
  };
}

export interface ActivityAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  category: string;
  studentId?: string;
  studentName?: string;
  details?: string;
  timestamp: string;
}

export async function getStudentActivities(params?: { category?: string; search?: string; status?: string }): Promise<StudentActivity[]> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  
  const queryString = query.toString();
  const url = `/api/activities${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch<{ activities: StudentActivity[] }>(url);
  return res.activities || [];
}

export async function verifyCoordinatorCode(category: string, code: string): Promise<{ success: boolean; authorized: boolean; category: string; facultyName?: string }> {
  return apiFetch<{ success: boolean; authorized: boolean; category: string; facultyName?: string }>('/api/activities/verify-code', {
    method: 'POST',
    body: JSON.stringify({ category, code }),
  });
}

export async function addStudentActivity(data: {
  studentId: string;
  category: string;
  titleOrCompany: string;
  roleOrPosition?: string;
  mentorOrAchievement?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  coordinatorCode?: string;
}): Promise<StudentActivity> {
  const headers: Record<string, string> = {};
  if (data.coordinatorCode) {
    headers['X-Coordinator-Code'] = data.coordinatorCode;
  }
  const res = await apiFetch<{ activity: StudentActivity }>('/api/activities', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.activity;
}

export async function updateStudentActivity(id: string, data: {
  titleOrCompany?: string;
  roleOrPosition?: string;
  mentorOrAchievement?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  coordinatorCode?: string;
}): Promise<StudentActivity> {
  const headers: Record<string, string> = {};
  if (data.coordinatorCode) {
    headers['X-Coordinator-Code'] = data.coordinatorCode;
  }
  const res = await apiFetch<{ activity: StudentActivity }>(`/api/activities/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return res.activity;
}

export async function removeStudentActivity(id: string, coordinatorCode?: string): Promise<{ success: boolean; message: string }> {
  const headers: Record<string, string> = {};
  if (coordinatorCode) {
    headers['X-Coordinator-Code'] = coordinatorCode;
  }
  return apiFetch<{ success: boolean; message: string }>(`/api/activities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ coordinatorCode }),
  });
}

export async function bulkAddStudentActivities(data: {
  studentIds: string[];
  category: string;
  titleOrCompany: string;
  roleOrPosition?: string;
  mentorOrAchievement?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  coordinatorCode?: string;
}): Promise<{ success: boolean; addedCount: number; skippedCount: number; message: string }> {
  const headers: Record<string, string> = {};
  if (data.coordinatorCode) {
    headers['X-Coordinator-Code'] = data.coordinatorCode;
  }
  return apiFetch<{ success: boolean; addedCount: number; skippedCount: number; message: string }>('/api/activities/bulk-add', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export async function bulkRemoveStudentActivities(activityIds: string[], coordinatorCode?: string): Promise<{ success: boolean; removedCount: number; message: string }> {
  const headers: Record<string, string> = {};
  if (coordinatorCode) {
    headers['X-Coordinator-Code'] = coordinatorCode;
  }
  return apiFetch<{ success: boolean; removedCount: number; message: string }>('/api/activities/bulk-remove', {
    method: 'POST',
    headers,
    body: JSON.stringify({ activityIds, coordinatorCode }),
  });
}

export async function getActivityAuditLogs(category?: string): Promise<ActivityAuditLog[]> {
  const url = category && category !== 'all' ? `/api/activities/audit-logs?category=${encodeURIComponent(category)}` : '/api/activities/audit-logs';
  const res = await apiFetch<{ logs: ActivityAuditLog[] }>(url);
  return res.logs || [];
}

export async function getMyCoordinatorAssignments(): Promise<{ success: boolean; isAdmin: boolean; categories: string[] }> {
  return apiFetch<{ success: boolean; isAdmin: boolean; categories: string[] }>('/api/activities/my-assignments');
}

export async function getCoordinators(): Promise<CoordinatorAccess[]> {
  const res = await apiFetch<{ coordinators: CoordinatorAccess[] }>('/api/admin/coordinators');
  return res.coordinators || [];
}

export async function assignCoordinator(facultyId: string, category: string, customCode?: string): Promise<{ success: boolean; generatedCode: string; coordinator: CoordinatorAccess }> {
  return apiFetch<{ success: boolean; generatedCode: string; coordinator: CoordinatorAccess }>('/api/admin/coordinators', {
    method: 'POST',
    body: JSON.stringify({ facultyId, category, customCode }),
  });
}

export async function regenerateCoordinatorCode(id: string, customCode?: string): Promise<{ success: boolean; generatedCode: string; coordinator: CoordinatorAccess }> {
  return apiFetch<{ success: boolean; generatedCode: string; coordinator: CoordinatorAccess }>(`/api/admin/coordinators/${encodeURIComponent(id)}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ customCode }),
  });
}

export async function toggleCoordinatorStatus(id: string, isActive: boolean): Promise<{ success: boolean; coordinator: CoordinatorAccess }> {
  return apiFetch<{ success: boolean; coordinator: CoordinatorAccess }>(`/api/admin/coordinators/${encodeURIComponent(id)}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function revokeCoordinator(id: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/admin/coordinators/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ─── Dynamic Announcements, Widgets & Opening Animations ──────────────────────

export type AnnouncementType = 'WIDGET' | 'OPENING_ANIMATION' | 'BANNER';
export type AnnouncementState = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type AnnouncementMediaType = 'IFRAME' | 'VIDEO' | 'IMAGE' | 'LOTTIE' | 'TEXT';
export type AnnouncementPlacement = 'HOME_TOP' | 'HOME_MIDDLE' | 'HOME_BOTTOM' | 'POPUP';
export type AnnouncementDisplayMode =
  | 'EVERY_PAGE_LOAD'
  | 'ONCE_PER_SESSION'
  | 'ONCE_PER_DAY'
  | 'ONCE_PER_LOGIN'
  | 'ONCE_PER_USER';

export type ComputedAnnouncementStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'EXPIRED';

export interface AnnouncementItem {
  id: string;
  title: string;
  type: AnnouncementType;
  mediaType: AnnouncementMediaType;
  placement: AnnouncementPlacement;
  srcUrl: string | null;
  externalUrl: string | null;
  content: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  openInNewTab: boolean;
  displayOrder: number;
  priority: number;
  displayMode: AnnouncementDisplayMode;
  closable: boolean;
  showCloseButton: boolean;
  autoCloseSeconds: number | null;
  backdropDismiss: boolean;
  height: number | null;
  width: number | null;
  mobileHeight: number | null;
  desktopHeight: number | null;
  aspectRatio: string | null;
  fullWidth: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementAnalytics {
  viewsCount: number;
  dismissalsCount: number;
  clicksCount: number;
  ctr: number;
}

export interface AnnouncementAdminItem extends AnnouncementItem {
  state: AnnouncementState;
  computedStatus: ComputedAnnouncementStatus;
  targetRoles: string[];
  targetYears: string[];
  targetDepartments: string[];
  targetSections: string[];
  startsAt: string | null;
  endsAt: string | null;
  createdById: string | null;
  updatedById: string | null;
  analytics?: AnnouncementAnalytics;
}

export interface CreateAnnouncementInput {
  title: string;
  type: AnnouncementType;
  mediaType: AnnouncementMediaType;
  state?: AnnouncementState;
  placement?: AnnouncementPlacement;
  srcUrl?: string | null;
  externalUrl?: string | null;
  content?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  openInNewTab?: boolean;
  displayOrder?: number;
  priority?: number;
  targetRoles?: string[];
  targetYears?: string[];
  targetDepartments?: string[];
  targetSections?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  displayMode?: AnnouncementDisplayMode;
  closable?: boolean;
  showCloseButton?: boolean;
  autoCloseSeconds?: number | null;
  backdropDismiss?: boolean;
  height?: number | null;
  width?: number | null;
  mobileHeight?: number | null;
  desktopHeight?: number | null;
  aspectRatio?: string | null;
  fullWidth?: boolean;
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {}

/**
 * Fetch eligible active announcements for the current student/user.
 */
export async function getAnnouncements(): Promise<AnnouncementItem[]> {
  try {
    const res = await apiFetch<{ announcements: AnnouncementItem[] }>('/api/announcements');
    return res.announcements || [];
  } catch (err) {
    console.error('getAnnouncements fetch error:', err);
    return [];
  }
}

/**
 * Fetch all announcements for admin management.
 */
export async function getAdminAnnouncements(params?: {
  type?: string;
  state?: string;
  placement?: string;
  search?: string;
}): Promise<AnnouncementAdminItem[]> {
  const query = new URLSearchParams();
  if (params?.type && params.type !== 'ALL') query.set('type', params.type);
  if (params?.state && params.state !== 'ALL') query.set('state', params.state);
  if (params?.placement && params.placement !== 'ALL') query.set('placement', params.placement);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch<{ announcements: AnnouncementAdminItem[]; total: number }>(`/api/admin/announcements${qs}`);
  return res.announcements || [];
}

/**
 * Fetch a single announcement by ID for admin editing.
 */
export async function getAdminAnnouncement(id: string): Promise<AnnouncementAdminItem> {
  const res = await apiFetch<{ announcement: AnnouncementAdminItem }>(`/api/admin/announcements/${encodeURIComponent(id)}`);
  return res.announcement;
}

/**
 * Create a new announcement.
 */
export async function createAnnouncement(data: CreateAnnouncementInput): Promise<AnnouncementAdminItem> {
  const res = await apiFetch<{ announcement: AnnouncementAdminItem }>('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.announcement;
}

/**
 * Update an existing announcement.
 */
export async function updateAnnouncement(id: string, data: UpdateAnnouncementInput): Promise<AnnouncementAdminItem> {
  const res = await apiFetch<{ announcement: AnnouncementAdminItem }>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.announcement;
}

/**
 * Toggle announcement active/inactive state.
 */
export async function toggleAnnouncementState(id: string, state: AnnouncementState): Promise<AnnouncementAdminItem> {
  const res = await apiFetch<{ announcement: AnnouncementAdminItem }>(`/api/admin/announcements/${encodeURIComponent(id)}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
  return res.announcement;
}

/**
 * Delete an announcement.
 */
export async function deleteAnnouncement(id: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/admin/announcements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Mark announcement as viewed (impression tracking).
 */
export async function markAnnouncementViewed(id: string): Promise<void> {
  try {
    await apiFetch(`/api/announcements/${encodeURIComponent(id)}/view`, { method: 'POST' });
  } catch {}
}

/**
 * Mark announcement as dismissed.
 */
export async function dismissAnnouncement(id: string): Promise<void> {
  try {
    await apiFetch(`/api/announcements/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
  } catch {}
}

/**
 * Track announcement CTA click.
 */
export async function trackAnnouncementClick(id: string): Promise<void> {
  try {
    await apiFetch(`/api/announcements/${encodeURIComponent(id)}/click`, { method: 'POST' });
  } catch {}
}





