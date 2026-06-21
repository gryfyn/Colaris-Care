import {
  generateNursingAssessmentPDF,
  generatePreScreeningPDF,
  generateAdvanceDirectivePDF,
} from '@/lib/pdf/form-pdf';
import { authenticate, authorize } from '@/lib/auth-guard.js';
import { PERMISSIONS } from '@/lib/roles.js';

/**
 * POST /api/v1/admission/generate-pdf
 * Generates a PDF for the specified form type and returns it as a blob
 *
 * Body:
 * {
 *   formType: 'nursing-assessment' | 'pre-screening' | 'advance-directive',
 *   formData: { ...formData },
 *   filename: string (optional, for logging)
 * }
 *
 * Response: PDF blob with Content-Type: application/pdf
 */
export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    if (!authorize(authResult.user.role, PERMISSIONS.ADMISSION_FORMS_READ, PERMISSIONS.ADMISSION_FORMS_WRITE)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { formType, formData, filename } = body;

    if (!formType || !formData) {
      return Response.json(
        { message: 'Missing formType or formData' },
        { status: 400 }
      );
    }

    let pdfBuffer;

    // Route to appropriate PDF generator
    switch (formType) {
      case 'nursing-assessment':
        pdfBuffer = await generateNursingAssessmentPDF(formData);
        break;

      case 'pre-screening':
        pdfBuffer = await generatePreScreeningPDF(formData);
        break;

      case 'advance-directive':
        pdfBuffer = await generateAdvanceDirectivePDF(formData);
        break;

      default:
        return Response.json(
          { message: `Unknown form type: ${formType}` },
          { status: 400 }
        );
    }

    // Return PDF as blob with proper headers
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || `form_${Date.now()}.pdf`}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return Response.json(
      {
        message: 'PDF generation failed',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
