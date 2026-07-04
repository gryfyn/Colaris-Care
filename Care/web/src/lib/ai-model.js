// Chooses the model used by all upload parsers.
//
// Preference order:
//  1. Google Gemini via a FREE Google AI Studio key (GOOGLE_GENERATIVE_AI_API_KEY)
//     — good multimodal model, reads PDFs/images + handwriting, generous free
//     tier. This is the recommended "free + good" setup.
//  2. Otherwise the Vercel AI Gateway (a plain `provider/model` string), which
//     needs AI_GATEWAY_API_KEY or Vercel OIDC and is metered (not free).
//
// generateObject accepts either a provider model instance or a gateway string,
// so callers don't care which path is active.
export async function resolveModel(preferred) {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { google } = await import('@ai-sdk/google');
    return google(process.env.GOOGLE_PARSE_MODEL || 'gemini-2.5-flash');
  }
  return preferred || process.env.FORM_PARSE_MODEL || 'anthropic/claude-sonnet-4.5';
}

// True when some model credential is available (free Google key, gateway key, or
// Vercel OIDC in a deployment). Used only to make the "unavailable" message
// accurate.
export function hasModelCredentials() {
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN
  );
}
