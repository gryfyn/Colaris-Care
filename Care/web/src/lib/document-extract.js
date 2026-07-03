// Shared server-side text extraction for uploaded PDF / Word documents.
// Used by the progress-note and admission upload parsers. Must run in the
// Node.js runtime (pdf-parse / mammoth need Node Buffers) — callers set
// `export const runtime = 'nodejs'`.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export class DocumentExtractError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'DocumentExtractError';
    this.status = status;
  }
}

export function fileKind(name = '', type = '') {
  const lower = String(name).toLowerCase();
  if (type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return 'docx';
  }
  return null;
}

// Reads a web File (from formData) and returns its extracted plain text.
// Throws DocumentExtractError (with an HTTP-ish status) for user-facing issues.
export async function extractDocumentText(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new DocumentExtractError('No file uploaded. Attach a PDF or Word document.', 422);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DocumentExtractError('File is too large (max 15MB).', 413);
  }

  const kind = fileKind(file.name || '', file.type || '');
  if (!kind) {
    throw new DocumentExtractError('Unsupported file type. Upload a PDF (.pdf) or Word (.docx) file.', 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = '';
  try {
    text = kind === 'pdf' ? await extractPdf(buffer) : await extractDocx(buffer);
  } catch (err) {
    throw new DocumentExtractError(`Could not read the ${kind.toUpperCase()} file: ${err.message}`, 422);
  }

  text = (text || '').trim();
  if (!text) {
    throw new DocumentExtractError('The document appears to be empty or image-only (no extractable text).', 422);
  }
  return { kind, text };
}

async function extractPdf(buffer) {
  // pdf-parse v2 exposes a PDFParse class (not a default function).
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result?.text || '';
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocx(buffer) {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const { value } = await mammoth.extractRawText({ buffer });
  return value || '';
}
