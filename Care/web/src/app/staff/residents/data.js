/* Caregiver-facing resident directory for the staff portal.
   Sample, facility-scoped data only. NO sensitive clinical detail or PHI:
   just the operational basics a caregiver needs on shift. */

const ORG = "org-maple-health-partners";
const FACILITY = "facility-maple-grove-care";

export const STAFF_RESIDENTS = [
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "eleanor-whitfield", name: "Eleanor Whitfield", room: "W-104", wing: "West wing",
    level: "Assisted living", status: "Active", tone: "green", assigned: true,
    mobility: "Independent with walker", diet: "Regular · low salt",
    careLevelNote: "Assistance with bathing and dressing in the morning.",
    contacts: [
      { name: "Claire Whitfield", relationship: "Daughter · primary", phone: "(555) 014-2180" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Morning assist", detail: "Bathing & dressing support" },
      { title: "Garden group", detail: "Enjoys afternoon activities" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "marcus-bell", name: "Marcus Bell", room: "M-210", wing: "Memory care",
    level: "Memory care", status: "Active", tone: "green", assigned: true,
    mobility: "Independent", diet: "Regular · soft texture",
    careLevelNote: "Keep a consistent, familiar daily routine. Calm prompts work best.",
    contacts: [
      { name: "David Bell", relationship: "Son · primary", phone: "(555) 013-7712" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Music group", detail: "Responds well to familiar music" },
      { title: "Evening wind-down", detail: "Prefers quiet environment after 7p" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "rosa-iniguez", name: "Rosa Iniguez", room: "N-118", wing: "North wing",
    level: "Skilled nursing", status: "Active", tone: "amber", assigned: true,
    mobility: "Wheelchair · transfer assist", diet: "Regular · thickened liquids",
    careLevelNote: "Mobility follow-up in progress. Two-person transfer assist.",
    contacts: [
      { name: "Lucia Iniguez", relationship: "Niece · primary", phone: "(555) 018-4031" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Afternoon mobility", detail: "Scheduled with care team" },
      { title: "Meal support", detail: "Prefers smaller, frequent meals" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "grace-tan", name: "Grace Tan", room: "W-106", wing: "West wing",
    level: "Assisted living", status: "Active", tone: "green", assigned: true,
    mobility: "Independent", diet: "Regular",
    careLevelNote: "Encourage social connection and independent choices.",
    contacts: [
      { name: "Mei Tan", relationship: "Daughter · primary", phone: "(555) 019-2024" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Garden group", detail: "Social activity she enjoys" },
      { title: "Independent routines", detail: "Prefers minimal assistance" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "lillian-park", name: "Lillian Park", room: "N-120", wing: "North wing",
    level: "Skilled nursing", status: "Active", tone: "green", assigned: true,
    mobility: "Walker · standby assist", diet: "Regular · low sugar",
    careLevelNote: "Support comfort and participation in preferred routines.",
    contacts: [
      { name: "Daniel Park", relationship: "Son · primary", phone: "(555) 017-1147" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Reading group", detail: "Joins most afternoons" },
      { title: "Morning routine", detail: "Standby assist getting ready" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "albert-reyes", name: "Albert Reyes", room: "M-205", wing: "Memory care",
    level: "Memory care", status: "Active", tone: "green", assigned: true,
    mobility: "Independent", diet: "Regular · soft texture",
    careLevelNote: "Familiar faces and routines help reduce confusion.",
    contacts: [
      { name: "Nneka Reyes", relationship: "Daughter · primary", phone: "(555) 011-6022" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Walking group", detail: "Enjoys short hallway walks" },
      { title: "Consistent staff", detail: "Responds best to familiar caregivers" },
    ],
  },
  {
    organizationId: ORG, facilityId: FACILITY,
    id: "henry-osei", name: "Henry Osei", room: "W-108", wing: "West wing",
    level: "Assisted living", status: "Active", tone: "green", assigned: false,
    mobility: "Independent", diet: "Regular",
    careLevelNote: "New resident — orienting to facility routines.",
    contacts: [
      { name: "Ama Osei", relationship: "Sister · primary", phone: "(555) 016-8890" },
      { name: "On-call nurse", relationship: "Facility care line", phone: "(555) 200-0114" },
    ],
    routine: [
      { title: "Orientation support", detail: "Getting familiar with the wing" },
      { title: "Meal preferences", detail: "Being confirmed with family" },
    ],
  },
].map((resident) => ({ ...resident, ssnLast4: "[RESTRICTED]" }));

export function getStaffResident(id) {
  return STAFF_RESIDENTS.find((resident) => resident.id === id);
}
