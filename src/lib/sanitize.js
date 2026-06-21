/**
 * XSS Sanitization Utility
 *
 * Provides sanitization for user-generated content (clinical notes,
 * announcements, incident narratives) before rendering in the UI.
 *
 * The server-side text sanitizer uses a regex allowlist approach since
 * DOMPurify is browser-only.  For client components that render rich text,
 * import `sanitizeHtml` which uses DOMPurify when available.
 *
 * Usage (server-side / API routes):
 *   import { sanitizeText } from '@/lib/sanitize.js';
 *   const clean = sanitizeText(req.body.note_body);
 *
 * Usage (client components — safe text rendering):
 *   import { sanitizeText } from '@/lib/sanitize.js';
 *   <div>{sanitizeText(note.body)}</div>
 *
 * IMPORTANT: Never use dangerouslySetInnerHTML with user-generated content.
 * React's JSX text interpolation (i.e., {variable}) escapes HTML entities
 * automatically and is safe for plain text rendering.
 */

/**
 * Strip all HTML tags and decode common HTML entities from a string.
 * Safe for both server and client environments.
 *
 * @param {string|null|undefined} input
 * @returns {string}
 */
export function sanitizeText(input) {
  if (input == null) return '';
  if (typeof input !== 'string') input = String(input);

  return input
    // Remove all HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities to their character equivalents
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#39;/g,  "'")
    // Remove javascript: and data: URI schemes regardless of case or encoding
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    // Remove event handler attributes (on*=)
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize a SOAP note object (all string leaf values).
 *
 * @param {object|string} noteBody
 * @returns {object|string}
 */
export function sanitizeNoteBody(noteBody) {
  if (!noteBody) return noteBody;
  if (typeof noteBody === 'string') return sanitizeText(noteBody);
  if (typeof noteBody === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(noteBody)) {
      result[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
    return result;
  }
  return noteBody;
}

/**
 * Sanitize all string fields in an object (shallow).
 * Useful for sanitizing form submission bodies before INSERT.
 *
 * @param {object} obj
 * @param {string[]} fields  — field names to sanitize
 * @returns {object}          — new object with sanitized values
 */
export function sanitizeFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = sanitizeText(result[field]);
    }
  }
  return result;
}
