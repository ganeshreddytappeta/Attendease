import type { ActivityCategory, StudentActivity } from '../lib/api';

interface ActivityCategoryOptions {
  label: string;
  companyLabel: string;
  companies: Readonly<Record<string, readonly string[]>>;
}

export const STUDENT_ACTIVITY_FILTERS: Record<ActivityCategory, ActivityCategoryOptions> = {
  internship: {
    label: 'Internship',
    companyLabel: 'Company / Organization',
    companies: {
      'Bhimavaram Digitals': ['Full Time Interns', 'Project Interns'],
    },
  },
  startup: {
    label: 'Startups',
    companyLabel: 'Company / Organization',
    companies: {
      'Bhimavaram Online': ['Content creation', 'Designing'],
      'Nutri Delight': ['Content Writing'],
      'Smart Wash': [],
      'Bhimavaram Digitals': [],
    },
  },
  project_work: {
    label: 'Project Work',
    companyLabel: 'Project',
    companies: {},
  },
  sports: {
    label: 'Sports',
    companyLabel: 'Sport / Activity',
    companies: {},
  },
  house_events: {
    label: 'House Events',
    companyLabel: 'House Event',
    companies: {},
  },
};

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
const splitLegacyValue = (value: string) => value.split(/[,;|]/).map(part => part.trim()).filter(Boolean);

export function getStudentActivityCompanies(category: ActivityCategory | 'all'): string[] {
  return category === 'all' ? [] : Object.keys(STUDENT_ACTIVITY_FILTERS[category].companies);
}

export function getStudentActivityTypes(category: ActivityCategory, selectedCompany: string): string[] {
  const companies = STUDENT_ACTIVITY_FILTERS[category].companies;
  const selectedCompanyKey = Object.keys(companies).find(company => normalize(company) === normalize(selectedCompany));
  if (selectedCompany && selectedCompanyKey) return [...companies[selectedCompanyKey]];
  return [...new Set(Object.values(companies).flat())];
}

function matchingCompanyPart(activity: StudentActivity, company: string): boolean {
  const normalizedCompany = normalize(company);
  return splitLegacyValue(activity.titleOrCompany || '').some(part => normalize(part) === normalizedCompany);
}

function hasActivityType(activity: StudentActivity, category: ActivityCategory, activityType: string): boolean {
  const normalizedType = normalize(activityType);
  const titleParts = splitLegacyValue(activity.titleOrCompany || '');

  if (category === 'internship') {
    return titleParts.some(part => {
      const normalizedPart = normalize(part);
      return normalizedPart === normalizedType ||
        (normalizedType === 'fulltimeinterns' && normalizedPart === 'fulltimeinternsatstartups') ||
        (normalizedType === 'projectinterns' && normalizedPart === 'projectinterns');
    });
  }

  if (category === 'startup') {
    const companyParts = new Set(Object.keys(STUDENT_ACTIVITY_FILTERS.startup.companies).map(normalize));
    const titleTypes = titleParts.filter(part => !companyParts.has(normalize(part)));
    return [...titleTypes, activity.roleOrPosition || ''].some(value => normalize(value) === normalizedType);
  }

  return [activity.titleOrCompany || '', activity.roleOrPosition || '']
    .some(value => normalize(value) === normalizedType);
}

export function filterStudentActivities(
  activities: StudentActivity[],
  category: ActivityCategory | 'all',
  company: string,
  activityType: string,
): StudentActivity[] {
  return activities.filter(activity => {
    if (category !== 'all' && activity.category !== category) return false;
    if (category !== 'all' && company && !matchingCompanyPart(activity, company)) return false;
    if (category !== 'all' && activityType && !hasActivityType(activity, category, activityType)) return false;
    return true;
  });
}
