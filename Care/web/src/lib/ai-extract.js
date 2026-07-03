// Shared AI Gateway structured extraction with graceful fallback.
// Server-only (dynamically imports `ai` + `zod`). Callers pass a schema builder
// so each form keeps its own field shape while reusing the model call, error
// handling and "manual entry still works" degradation.

const DEFAULT_MODEL = process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';

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
    return { parsed: true, fields: object };
  } catch {
    return {
      parsed: false,
      fields: {},
      warning:
        'Automatic extraction is unavailable, so please complete the fields manually. ' +
        (process.env.AI_GATEWAY_API_KEY ? '' : '(AI_GATEWAY_API_KEY is not configured.)'),
    };
  }
}
