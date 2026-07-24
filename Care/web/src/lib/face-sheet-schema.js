// Face-sheet upload schema helpers.
// Keep these fields aligned to the existing residents PATCH endpoint.

export const FACE_SHEET_PARSE_FIELDS = ['firstName', 'lastName', 'roomAssignment'];

export function buildFaceSheetSchema(z) {
  const s = () => z.string().nullish();
  return z.object({
    firstName: s(),
    lastName: s(),
    roomAssignment: s(),
  });
}

const str = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());

export function mergeParsedFaceSheet(current, parsed) {
  if (!parsed || typeof parsed !== 'object') return current;
  const next = { ...current };

  const firstName = str(parsed.firstName);
  if (firstName) next.firstName = firstName;

  const lastName = str(parsed.lastName);
  if (lastName) next.lastName = lastName;

  const roomAssignment = str(parsed.roomAssignment);
  if (roomAssignment) next.room = roomAssignment;

  return next;
}
