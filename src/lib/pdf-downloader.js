/**
 * PDF Download Utility
 * Handles PDF generation, download, and error handling
 */

/**
 * Generate filename with resident name and timestamp
 * @param {string} formType - 'nursing-assessment', 'pre-screening', 'advance-directive'
 * @param {string} residentName - resident name from form data
 * @returns {string} filename
 */
export function generatePdfFilename(formType, residentName = 'admission') {
  const sanitizedName = (residentName || 'admission')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  const typeMap = {
    'nursing-assessment': 'nursing',
    'pre-screening': 'pre_screening',
    'advance-directive': 'advance_directive',
  };

  const typeLabel = typeMap[formType] || formType;
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return `admission_${sanitizedName}_${typeLabel}_${date}.pdf`;
}

/**
 * Trigger PDF download in browser
 * @param {Buffer|Blob} pdfBlob - PDF data as Blob or Buffer
 * @param {string} filename - filename for download
 */
export function downloadPdfFile(pdfBlob, filename) {
  try {
    // Convert Buffer to Blob if necessary
    const blob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: 'application/pdf' });

    // Create object URL and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Append to DOM, click, and cleanup
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    return true;
  } catch (error) {
    console.error('PDF download failed:', error);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
}

/**
 * Call PDF generation endpoint and download
 * @param {string} formType - form type identifier
 * @param {object} formData - completed form data
 * @param {string} residentName - resident name for filename
 * @param {string} accessToken - auth token
 * @returns {Promise<{success: boolean, filename: string, error?: string}>}
 */
export async function generateAndDownloadPdf(
  formType,
  formData,
  residentName,
  accessToken
) {
  try {
    const filename = generatePdfFilename(formType, residentName);

    // Call API to generate PDF
    const response = await fetch('/api/v1/admission/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        formType,
        formData,
        filename,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Server error: ${response.status}`);
    }

    // Get PDF blob from response
    const pdfBlob = await response.blob();

    // Download the PDF
    downloadPdfFile(pdfBlob, filename);

    return {
      success: true,
      filename,
    };
  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      success: false,
      filename: generatePdfFilename(formType, residentName),
      error: error.message || 'Failed to generate PDF',
    };
  }
}

/**
 * Store form data in sessionStorage for recovery if needed
 * @param {string} formType - form type identifier
 * @param {object} formData - form data to store
 */
export function storeFormDataInSession(formType, formData) {
  try {
    sessionStorage.setItem(
      `form_data_${formType}`,
      JSON.stringify({
        data: formData,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn('Could not store form data in session:', error);
  }
}

/**
 * Retrieve form data from sessionStorage
 * @param {string} formType - form type identifier
 * @returns {object|null} stored form data or null
 */
export function retrieveFormDataFromSession(formType) {
  try {
    const stored = sessionStorage.getItem(`form_data_${formType}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.data;
    }
  } catch (error) {
    console.warn('Could not retrieve form data from session:', error);
  }
  return null;
}

/**
 * Clear form data from sessionStorage
 * @param {string} formType - form type identifier
 */
export function clearFormDataFromSession(formType) {
  try {
    sessionStorage.removeItem(`form_data_${formType}`);
  } catch (error) {
    console.warn('Could not clear form data from session:', error);
  }
}
