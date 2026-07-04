// Shared AI Gateway structured extraction with graceful fallback.
// Server-only (dynamically imports `ai` + `zod`). Callers pass a schema builder
// so each form keeps its own field shape while reusing the model call, error
// handling and "manual entry still works" degradation.

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
