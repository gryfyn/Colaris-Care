/* Caregiver-facing resident directory for the staff portal.
   Facility-scoped operational data only. NO sensitive clinical detail or PHI:
   just the operational basics a caregiver needs on shift. */

export const STAFF_RESIDENTS = [];

export function getStaffResident(id) {
  return STAFF_RESIDENTS.find((resident) => resident.id === id);
}
