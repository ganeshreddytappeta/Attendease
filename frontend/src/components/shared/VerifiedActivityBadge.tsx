import { useQuery } from '@tanstack/react-query';
import * as api from '../../lib/api';

export interface VerifiedActivityBadgeProps {
  student?: {
    id?: string;
    userId?: string;
    rollNumber?: string;
    hasActivities?: boolean;
    studentActivities?: Array<{
      category?: string;
      titleOrCompany?: string;
      roleOrPosition?: string;
      status?: string;
    }>;
  } | null;
  studentId?: string;
  rollNumber?: string;
  requests?: any[];
  forceVerified?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const ACTIVITY_REASONS = ['internship', 'startup', 'project_development', 'sports', 'competition'];

/**
 * VerifiedActivityBadge
 * Displays the official Bold C-Arc with Orange Checkmark badge beside requests & student card
 * for students who are registered in student activities or have approved activity permissions.
 */
export function VerifiedActivityBadge({
  student,
  studentId,
  rollNumber,
  requests,
  forceVerified = false,
  className = '',
  size = 'sm',
}: VerifiedActivityBadgeProps) {
  // 1. Direct check on student object from API / AuthContext
  const hasDirect = Boolean(
    forceVerified ||
    student?.hasActivities ||
    (student?.studentActivities && student.studentActivities.length > 0)
  );

  // 2. Check if student has approved activity requests (internships, sports, startups, etc.)
  const approvedActivityReqs = requests?.filter(
    (r: any) => r.status === 'approved' && ACTIVITY_REASONS.includes(r.reason)
  ) || [];
  const hasApprovedActivity = approvedActivityReqs.length > 0;

  // 3. Query fallback: fetch all active activities from registry
  const { data: activityData } = useQuery({
    queryKey: ['verified-activity-registry'],
    queryFn: async () => {
      try {
        const res = await api.getStudentActivities({ category: 'all' });
        const idSet = new Set<string>();
        const labelMap = new Map<string, string[]>();

        const list = Array.isArray(res) ? res : ((res as any)?.activities || []);

        for (const act of list) {
          const keys = [
            act.studentId,
            act.student?.id,
            act.student?.userId,
            act.student?.rollNumber,
          ].filter(Boolean).map(k => String(k).toLowerCase().trim());

          for (const k of keys) {
            idSet.add(k);
            const existing = labelMap.get(k) || [];
            const catName = act.category ? act.category.replace('_', ' ') : 'Activity';
            if (!existing.includes(catName)) {
              existing.push(catName);
              labelMap.set(k, existing);
            }
          }
        }
        return { idSet, labelMap };
      } catch {
        return { idSet: new Set<string>(), labelMap: new Map<string, string[]>() };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const rollKey = (student?.rollNumber || rollNumber || '').toLowerCase().trim();
  const idKey = (student?.userId || student?.id || studentId || '').toLowerCase().trim();

  const isVerifiedInRegistry = Boolean(
    (rollKey && activityData?.idSet.has(rollKey)) ||
    (idKey && activityData?.idSet.has(idKey))
  );

  const isVerified = hasDirect || hasApprovedActivity || isVerifiedInRegistry;

  if (!isVerified) return null;

  // Determine tooltip categories
  const categories: string[] = [];

  if (student?.studentActivities && student.studentActivities.length > 0) {
    for (const a of student.studentActivities) {
      const name = a.category?.replace('_', ' ');
      if (name && !categories.includes(name)) categories.push(name);
    }
  }

  if (rollKey && activityData?.labelMap.get(rollKey)) {
    for (const name of activityData.labelMap.get(rollKey)!) {
      if (!categories.includes(name)) categories.push(name);
    }
  }

  if (idKey && activityData?.labelMap.get(idKey)) {
    for (const name of activityData.labelMap.get(idKey)!) {
      if (!categories.includes(name)) categories.push(name);
    }
  }

  if (approvedActivityReqs.length > 0) {
    for (const r of approvedActivityReqs) {
      const name = r.reasonLabel || r.reason?.replace('_', ' ');
      if (name && !categories.includes(name)) categories.push(name);
    }
  }

  const tooltipText = categories.length > 0
    ? `Student Activity Verified (${categories.join(', ')})`
    : 'Student Activity Verified';

  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <span
      className={`inline-flex items-center shrink-0 cursor-help select-none ${className}`}
      title={tooltipText}
    >
      <img
        src="/Bold C-Arc with Orange Checkmark.png"
        alt="Verified Student Activity"
        className={`${sizeClasses} object-contain transition-transform hover:scale-115`}
        loading="lazy"
      />
    </span>
  );
}

export default VerifiedActivityBadge;
