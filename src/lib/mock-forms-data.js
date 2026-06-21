/**
 * Mock data generator for forms history hub
 * Used for frontend development while backend APIs are being built
 */

const RESIDENTS = [
  'John Doe',
  'Sarah Smith',
  'Michael Johnson',
  'Emily Brown',
  'Robert Davis',
  'Maria Garcia',
  'James Wilson',
  'Lisa Anderson',
  'David Martinez',
  'Jennifer Taylor',
];

const AUTHORS = [
  'Jane Thompson',
  'Dr. James Wilson',
  'Lisa Anderson',
  'Michael Lee',
  'Jennifer Martin',
  'David Chen',
  'Rachel Green',
  'Thomas Brown',
  'Amanda White',
];

const STATUSES = ['completed', 'in_progress', 'draft', 'pending_review', 'approved'];

/**
 * Generate mock form records for a specific form type
 * @param {string} formTypeId - The form type ID (e.g., 'care_plans')
 * @param {number} count - Number of records to generate (default: 48)
 * @returns {Array} Array of mock form objects
 */
export function generateMockFormData(formTypeId, count = 48) {
  const forms = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const dateCreated = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    forms.push({
      id: `form-${formTypeId}-${i}`,
      formType: formTypeId,
      residentId: `resident-${i % RESIDENTS.length}`,
      residentName: RESIDENTS[i % RESIDENTS.length],
      dateCreated: dateCreated.toISOString().split('T')[0],
      author: AUTHORS[Math.floor(Math.random() * AUTHORS.length)],
      status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
      progressPercent: Math.random() > 0.3 ? 100 : Math.floor(Math.random() * 100),
    });
  }

  // Sort by date descending (most recent first)
  return forms.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
}

/**
 * Get a list of unique resident names from mock data
 * @param {Array} forms - Array of form objects
 * @returns {Array} Sorted array of unique resident names
 */
export function getResidentsFromForms(forms) {
  return [...new Set(forms.map((f) => f.residentName))].sort();
}

/**
 * Filter forms by multiple criteria
 * @param {Array} forms - Array of form objects to filter
 * @param {Object} criteria - Filter criteria
 * @param {string} criteria.residentName - Partial match on resident name
 * @param {string} criteria.dateFrom - ISO date string (YYYY-MM-DD)
 * @param {string} criteria.dateTo - ISO date string (YYYY-MM-DD)
 * @param {string} criteria.status - Exact match on status
 * @param {string} criteria.author - Partial match on author name
 * @returns {Array} Filtered array of forms
 */
export function filterForms(forms, criteria = {}) {
  return forms.filter((form) => {
    const { residentName, dateFrom, dateTo, status, author } = criteria;

    if (residentName && !form.residentName.toLowerCase().includes(residentName.toLowerCase())) {
      return false;
    }

    if (dateFrom && new Date(form.dateCreated) < new Date(dateFrom)) {
      return false;
    }

    if (dateTo && new Date(form.dateCreated) > new Date(dateTo)) {
      return false;
    }

    if (status && form.status !== status) {
      return false;
    }

    if (author && !form.author.toLowerCase().includes(author.toLowerCase())) {
      return false;
    }

    return true;
  });
}

/**
 * Paginate an array of forms
 * @param {Array} forms - Array of form objects
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Number of items per page
 * @returns {Object} { items: Array, total: number, totalPages: number, currentPage: number }
 */
export function paginateForms(forms, page = 1, pageSize = 10) {
  const total = forms.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: forms.slice(startIndex, endIndex),
    total,
    totalPages,
    currentPage: page,
  };
}

/**
 * Get statistics about forms
 * @param {Array} forms - Array of form objects
 * @returns {Object} Statistics object with counts by status, latest date, etc.
 */
export function getFormStatistics(forms) {
  const stats = {
    total: forms.length,
    byStatus: {},
    byResident: {},
    dateRange: { earliest: null, latest: null },
  };

  forms.forEach((form) => {
    // Count by status
    stats.byStatus[form.status] = (stats.byStatus[form.status] || 0) + 1;

    // Count by resident
    stats.byResident[form.residentName] = (stats.byResident[form.residentName] || 0) + 1;

    // Track date range
    const formDate = new Date(form.dateCreated);
    if (!stats.dateRange.earliest || formDate < new Date(stats.dateRange.earliest)) {
      stats.dateRange.earliest = form.dateCreated;
    }
    if (!stats.dateRange.latest || formDate > new Date(stats.dateRange.latest)) {
      stats.dateRange.latest = form.dateCreated;
    }
  });

  return stats;
}

export default {
  generateMockFormData,
  getResidentsFromForms,
  filterForms,
  paginateForms,
  getFormStatistics,
};
