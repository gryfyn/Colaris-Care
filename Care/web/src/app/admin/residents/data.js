export const RESIDENTS = [];

export function getResident(id) {
  return RESIDENTS.find((resident) => resident.id === id);
}
