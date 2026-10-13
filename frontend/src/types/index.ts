// TypeScript type definitions for AttendEase

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type RequestReason =
  | 'internship'
  | 'startup'
  | 'project_development'
  | 'medical'
  | 'sports'
  | 'family_emergency'
  | 'competition'
  | 'other';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  semester: number;
  email: string;
  phone?: string;
  section?: string;
  year?: string;
  avatarUrl?: string;
  hasActivities?: boolean;
  studentActivities?: Array<{
    id?: string;
    category?: string;
    titleOrCompany?: string;
    roleOrPosition?: string;
    status?: string;
  }>;
}

export interface Faculty {
  id: string;
  userId?: string;
  name: string;
  department: string;
  email: string;
  avatarUrl?: string;
  designation?: string;
  role?: string;
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
  date: string; // ISO date string YYYY-MM-DD
  endDate?: string; // ISO date string YYYY-MM-DD for multi-day leave
  periods?: string; // comma-separated period numbers e.g. "1,2,3,4"
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  description: string;
  documentName?: string;
  documentUrl?: string;
  status: RequestStatus;
  submittedAt: string; // ISO datetime string
  facultyId?: string;
  faculty?: Faculty;
  primaryFacultyId?: string;
  primaryFaculty?: Faculty;
  facultyIds?: string[];
  faculties?: Faculty[];
  shareToken?: string;
  shareUrl?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  finalDecisionBy?: string;
  finalDecisionUserId?: string;
  finalDecisionName?: string;
  actions?: any[];
}

export interface NewRequestFormData {
  reason: RequestReason;
  date: Date;
  startTime: string;
  endTime: string;
  description: string;
  document?: File;
}

export interface FacultyFilters {
  search: string;
  department: string;
  dateFrom: string;
  dateTo: string;
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
