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

const IMAGE_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.heic': 'image/heic' };

// Classify an upload including images (photos/scans of forms). Returns
// { kind: 'pdf'|'docx'|'image', mediaType } or null for unsupported types.
export function uploadKind(name = '', type = '') {
  const doc = fileKind(name, type);
  if (doc === 'pdf') return { kind: 'pdf', mediaType: 'application/pdf' };
  if (doc === 'docx') return { kind: 'docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const lower = String(name).toLowerCase();
  if (String(type).startsWith('image/')) return { kind: 'image', mediaType: type };
  for (const [ext, mediaType] of Object.entries(IMAGE_EXT)) {
    if (lower.endsWith(ext)) return { kind: 'image', mediaType };
  }
  return null;
}

// Read an upload for parsers that can fall back to vision (OCR / handwriting):
// returns the raw bytes + any extractable digital text. Unlike
// extractDocumentText it does NOT throw when there is no text (an image-only or
// handwritten scan is expected to yield ''), so the caller can send the bytes to
// a vision model instead. Still throws for unsupported type / oversize files.
export async function readUpload(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new DocumentExtractError('No file uploaded. Attach a PDF, Word, or image file.', 422);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DocumentExtractError('File is too large (max 15MB).', 413);
  }
  const info = uploadKind(file.name || '', file.type || '');
  if (!info) {
    throw new DocumentExtractError('Unsupported file type. Upload a PDF, Word (.docx), or image (PNG/JPG).', 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = '';
  try {
    if (info.kind === 'pdf') text = await extractPdf(buffer);
    else if (info.kind === 'docx') text = await extractDocx(buffer);
    // images: no digital text — vision handles them
  } catch {
    // Leave text empty so the caller can fall back to a vision model.
    text = '';
  }

  return { kind: info.kind, mediaType: info.mediaType, buffer, text: (text || '').trim() };
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
