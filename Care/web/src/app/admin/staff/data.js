export const STAFF = [];

export function getStaff(id) {
  return STAFF.find((staff) => staff.id === id);
}
