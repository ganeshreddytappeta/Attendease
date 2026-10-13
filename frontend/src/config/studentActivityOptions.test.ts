import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityCategory, StudentActivity } from '../lib/api';
import {
  filterStudentActivities,
  getStudentActivityCompanies,
  getStudentActivityTypes,
  STUDENT_ACTIVITY_FILTERS,
} from './studentActivityOptions';

const categories: ActivityCategory[] = ['internship', 'startup', 'project_work', 'sports', 'house_events'];

function activity(
  category: ActivityCategory,
  titleOrCompany: string,
  roleOrPosition = '',
  status = 'active',
): StudentActivity {
  return {
    id: `${category}-${titleOrCompany}`,
    studentId: 'student-1',
    category,
    titleOrCompany,
    roleOrPosition,
    status,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}

describe('Three-level student activity filters', () => {
  const records = [
    activity('internship', 'FULL TIME INTERNS AT STARTUPS', 'SOFTWARE DEVELOPER'),
    activity('internship', 'PROJECT INTERNS'),
    activity('startup', 'Content creation, Designing , Bhimavaram Online', 'internship in department startups'),
    activity('startup', 'Nutridelight', 'Content Writing'),
    activity('project_work', 'Project Alpha', 'Machine Learning'),
    activity('sports', 'Cricket', 'Batting'),
    activity('house_events', 'Annual Day', 'Dance'),
    activity('startup', ''),
  ];

  it('has separate organizations per category, based on observed records and requested companies', () => {
    assert.deepEqual(getStudentActivityCompanies('internship'), ['Bhimavaram Digitals']);
    assert.deepEqual(getStudentActivityCompanies('startup'), ['Bhimavaram Online', 'Nutri Delight', 'Smart Wash', 'Bhimavaram Digitals']);
    assert.deepEqual(getStudentActivityCompanies('project_work'), []);
    assert.deepEqual(getStudentActivityCompanies('sports'), []);
    assert.deepEqual(getStudentActivityCompanies('house_events'), []);
  });

  it('shows only the activity types configured for the selected organization', () => {
    assert.deepEqual(getStudentActivityTypes('internship', 'Bhimavaram Digitals'), ['Full Time Interns', 'Project Interns']);
    assert.deepEqual(getStudentActivityTypes('startup', 'Smart Wash'), []);
    assert.deepEqual(getStudentActivityTypes('startup', 'Bhimavaram Online'), ['Content creation', 'Designing']);
    assert.deepEqual(getStudentActivityTypes('startup', 'Nutri Delight'), ['Content Writing']);
    for (const category of categories) {
      for (const company of getStudentActivityCompanies(category)) {
        assert.ok(STUDENT_ACTIVITY_FILTERS[category].companies[company]);
      }
    }
  });

  it('filters every configured category, organization, and subcategory combination without cross-category records', () => {
    const search = 'a';
    const status = 'active';
    const searchAndStatusFiltered = records.filter(record =>
      record.status === status &&
      `${record.titleOrCompany} ${record.roleOrPosition}`.toLocaleLowerCase().includes(search)
    );
    for (const category of categories) {
      for (const company of getStudentActivityCompanies(category)) {
        const types = getStudentActivityTypes(category, company);
        const typeSelections = ['', ...types];
        for (const activityType of typeSelections) {
          const matching = filterStudentActivities(searchAndStatusFiltered, category, company, activityType);
          const expected = filterStudentActivities(records, category, company, activityType).filter(record =>
            record.status === status &&
            `${record.titleOrCompany} ${record.roleOrPosition}`.toLocaleLowerCase().includes(search)
          );
          assert.deepEqual(matching, expected);
          assert.ok(matching.every(record => record.category === category));
          assert.ok(matching.every(record => record.titleOrCompany.toLocaleLowerCase().includes(company.toLocaleLowerCase()) ||
            record.titleOrCompany.split(/[,;|]/).some(part => part.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, '') === company.toLocaleLowerCase().replace(/[^a-z0-9]/g, ''))));
        }
      }
    }
  });

  it('normalizes observed internship type labels and filters the existing records', () => {
    assert.deepEqual(
      filterStudentActivities(records, 'internship', '', 'Full Time Interns').map(record => record.titleOrCompany),
      ['FULL TIME INTERNS AT STARTUPS'],
    );
    assert.deepEqual(
      filterStudentActivities(records, 'internship', '', 'Project Interns').map(record => record.titleOrCompany),
      ['PROJECT INTERNS'],
    );
  });

  it('filters startup records by organization and matching subcategory together', () => {
    assert.deepEqual(
      filterStudentActivities(records, 'startup', 'Bhimavaram Online', 'Designing').map(record => record.titleOrCompany),
      ['Content creation, Designing , Bhimavaram Online'],
    );
    assert.deepEqual(
      filterStudentActivities(records, 'startup', 'Nutri Delight', 'Content Writing').map(record => record.titleOrCompany),
      ['Nutridelight'],
    );
  });

  it('does not misattribute an internship type to a selected company when the record has no company value', () => {
    assert.deepEqual(
      filterStudentActivities(records, 'internship', 'Bhimavaram Digitals', 'Full Time Interns'),
      [],
    );
  });

  it('requires both company and internship type to match the same record', () => {
    const internshipAssignments = [
      activity('internship', 'Bhimavaram Digitals, FULL TIME INTERNS AT STARTUPS'),
      activity('internship', 'Bhimavaram Digitals, PROJECT INTERNS'),
      activity('internship', 'Smart Wash, FULL TIME INTERNS AT STARTUPS'),
    ];
    assert.deepEqual(
      filterStudentActivities(internshipAssignments, 'internship', 'Bhimavaram Digitals', 'Full Time Interns')
        .map(record => record.titleOrCompany),
      ['Bhimavaram Digitals, FULL TIME INTERNS AT STARTUPS'],
    );
    assert.deepEqual(
      filterStudentActivities(internshipAssignments, 'internship', 'Bhimavaram Digitals', 'Project Interns')
        .map(record => record.titleOrCompany),
      ['Bhimavaram Digitals, PROJECT INTERNS'],
    );
  });

  it('keeps all records in the category when both dependent filters use their All choices', () => {
    for (const category of categories) {
      const matching = filterStudentActivities(records, category, '', '');
      assert.ok(matching.length > 0);
      assert.ok(matching.every(record => record.category === category));
    }
  });

  it('ignores case and spacing differences and excludes empty assignment values', () => {
    assert.deepEqual(
      filterStudentActivities(records, 'startup', 'nutri delight', 'contentwriting').map(record => record.titleOrCompany),
      ['Nutridelight'],
    );
    assert.deepEqual(filterStudentActivities(records, 'startup', 'Bhimavaram Online', 'Content creation').length, 1);
  });

  it('combines local filters with the existing search and status-filtered record set', () => {
    const search = 'nutri';
    const status = 'active';
    const loadedRecords = records.filter(record =>
      record.category === 'startup' &&
      record.status === status &&
      record.titleOrCompany.toLocaleLowerCase().includes(search)
    );
    assert.deepEqual(
      filterStudentActivities(loadedRecords, 'startup', 'Nutri Delight', 'Content Writing').map(record => record.titleOrCompany),
      ['Nutridelight'],
    );
  });
});
