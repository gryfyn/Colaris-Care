import { PDFDocument, PDFPage, rgb, StandardFonts } from '@react-pdf/renderer';
import React from 'react';
import { pdf } from '@react-pdf/renderer';

/** Generic form PDF exporter with consistent header/footer */
export async function exportFormToPDF({
  formType,
  formData,
  residendId,
  residentName,
  residentDOB,
  tenantName = 'Dependable Care Residential Center',
  filename
}) {
  try {
    const PDFComponent = React.createElement(FormPDF, {
      formType,
      formData,
      residendId,
      residentName,
      residentDOB,
      tenantName,
    });

    const blob = await pdf(PDFComponent).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${formType}_${residendId}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
}

/** Generate table for displaying form fields */
function generateTable(formData, labelMapping = {}) {
  const rows = [];

  Object.entries(formData || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;

    const label = labelMapping[key] || key.replace(/_/g, ' ').toUpperCase();
    let displayValue = value;

    if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'object') {
      displayValue = JSON.stringify(value, null, 2);
    }

    rows.push({ label, value: String(displayValue) });
  });

  return rows;
}

/** Sanitize form data for PDF (remove internal fields) */
function sanitizeForPDF(data) {
  const exclude = ['id', 'admission_id', 'resident_id', 'tenant_id', 'created_at', 'updated_at'];
  const sanitized = {};

  Object.entries(data || {}).forEach(([key, value]) => {
    if (!exclude.includes(key) && value !== null && value !== undefined) {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/** Utility to format date for display */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * FormPDF Component - Base PDF layout with header, footer, pagination
 * Extend this for form-specific layouts
 */
export const FormPDF = React.memo(function FormPDF({
  formType,
  formData,
  residendId,
  residentName,
  residentDOB,
  tenantName,
}) {
  const sanitized = sanitizeForPDF(formData);
  const tableRows = generateTable(sanitized);

  // Placeholder: Use @react-pdf/renderer components
  // For now, this is a functional interface awaiting PDF library integration
  return (
    <div className="p-8">
      <h1>PDF Export Not Yet Implemented</h1>
      <p>Form Type: {formType}</p>
      <p>Resident: {residentName} (DOB: {formatDate(residentDOB)})</p>
      <pre>{JSON.stringify(sanitized, null, 2)}</pre>
    </div>
  );
});

/**
 * Client-side PDF download without server-side rendering
 * Generates downloadable text/CSV format as fallback
 */
export function downloadFormAsText({ formType, formData, residentName, filename }) {
  const sanitized = sanitizeForPDF(formData);
  const lines = [
    `${formType.toUpperCase()} - Admission Form`,
    `Resident: ${residentName}`,
    `Date: ${new Date().toLocaleString()}`,
    '',
    ...Object.entries(sanitized).map(([key, value]) => {
      const label = key.replace(/_/g, ' ').toUpperCase();
      return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
    }),
  ];

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${formType}_${residentName}_${new Date().toISOString().split('T')[0]}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Download form as CSV for spreadsheet import
 */
export function downloadFormAsCSV({ formType, formData, residentName, filename }) {
  const sanitized = sanitizeForPDF(formData);
  const headers = Object.keys(sanitized);
  const values = Object.values(sanitized).map(v => {
    if (typeof v === 'string' && (v.includes(',') || v.includes('\n') || v.includes('"'))) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  });

  const csv = [headers.join(','), values.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${formType}_${residentName}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export form data as JSON for backup/import */
export function downloadFormAsJSON({ formType, formData, residentName, filename }) {
  const sanitized = sanitizeForPDF(formData);
  const exportData = {
    formType,
    residentName,
    exportDate: new Date().toISOString(),
    data: sanitized,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${formType}_${residentName}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
