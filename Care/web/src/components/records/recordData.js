export const RESIDENTS = [];

export const RECORD_CONFIG = {
  progress: {
    title: "Progress Notes",
    eyebrow: "Clinical documentation",
    description: "Review progress notes submitted by staff and record an approval decision.",
    columns: ["Date", "Resident", "Shift", "Staff"],
    records: [],
  },
  incidents: {
    title: "Incident Reports",
    eyebrow: "Safety review",
    description: "Review and approve incident reports submitted by staff.",
    columns: ["Date", "Resident", "Type", "Staff"],
    records: [],
  },
  disposal: {
    title: "Drug Disposal",
    eyebrow: "Medication accountability",
    description: "Review and approve medication disposal records submitted by staff.",
    columns: ["Date", "Resident", "Drug", "Quantity", "Staff"],
    records: [],
  },
  evacuation: {
    title: "Evacuation Drills",
    eyebrow: "Emergency readiness",
    description: "Review and approve evacuation drill records submitted by staff.",
    columns: ["Date", "Type", "Location", "Accounted", "Staff"],
    records: [],
  },
};
