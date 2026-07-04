// Shared AI Gateway structured extraction with graceful fallback.
// Server-only (dynamically imports `ai` + `zod`). Callers pass a schema builder
// so each form keeps its own field shape while reusing the model call, error
// handling and "manual entry still works" degradation.

import { readUpload } from '@/lib/document-extract.js';

const DEFAULT_MODEL = process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';
// Vision path needs a multimodal model that can read PDFs/images (Claude does
// OCR + handwriting). Default to Sonnet; override with VISION_PARSE_MODEL.
const VISION_MODEL = process.env.VISION_PARSE_MODEL || process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';

function unavailable() {
  return {
    parsed: false,
    fields: {},
    warning:
      'Automatic extraction is unavailable, so please complete the fields manually. ' +
      (process.env.AI_GATEWAY_API_KEY ? '' : '(AI_GATEWAY_API_KEY is not configured.)'),
  };
}

export async function extractStructured({ text, buildSchema, system, model, maxChars = 40000 }) {
  const clipped = String(text || '').slice(0, maxChars);
  try {
    const [{ generateObject }, { z }] = await Promise.all([import('ai'), import('zod')]);
    const schema = buildSchema(z);
    const { object } = await generateObject({
      model: model || DEFAULT_MODEL,
      schema,
      system,
      prompt: `Document text:\n\n${clipped}`,
    });
    return { parsed: true, fields: object, source: 'text' };
  } catch {
    return unavailable();
  }
}

// Hybrid upload → fields extraction reused by every form parser. Digital text
// (>= minText chars) is parsed cheaply; otherwise the raw PDF/image bytes go to
// a vision model that OCRs pages and reads handwriting. Returns the raw `upload`
// too so a caller can preserve any extracted text on failure. Throws
// DocumentExtractError (from readUpload) for unsupported/oversize files.
export async function parseUpload({ file, buildSchema, system, model, visionPrompt, minText = 200, maxChars = 40000 }) {
  const upload = await readUpload(file);
  let result;
  if (upload.text && upload.text.length >= minText) {
    result = await extractStructured({ text: upload.text, buildSchema, system, model, maxChars });
  } else if (upload.kind === 'docx') {
    result = {
      parsed: false,
      fields: {},
      warning: 'This Word document has no readable text. For a scanned or handwritten form, upload it as a PDF or a photo (PNG/JPG) so it can be read.',
    };
  } else {
    result = await extractStructuredFromFile({ buffer: upload.buffer, mediaType: upload.mediaType, buildSchema, system, model, prompt: visionPrompt });
  }
  return { ...result, upload };
}

// Vision extraction: hand the raw document bytes (PDF or image) to a multimodal
// model so it can read scanned pages AND handwriting. Used when digital text
// extraction yields little/nothing.
export async function extractStructuredFromFile({ buffer, mediaType, buildSchema, system, prompt, model }) {
  try {
    const [{ generateObject }, { z }] = await Promise.all([import('ai'), import('zod')]);
    const schema = buildSchema(z);
    const { object } = await generateObject({
      model: model || VISION_MODEL,
      schema,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'Extract the fields from this document. Read printed AND handwritten entries; transcribe handwriting as best you can.' },
            { type: 'file', data: buffer, mediaType },
          ],
        },
      ],
    });
    return { parsed: true, fields: object, source: 'vision' };
  } catch {
    return unavailable();
  }
}
