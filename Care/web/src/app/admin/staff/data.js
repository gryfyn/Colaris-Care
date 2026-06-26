export const STAFF = [
  {
    id: "dauda-okafor", name: "Dauda Okafor", role: "Registered nurse", status: "On shift", tone: "green",
    email: "dauda.okafor@example.org", phone: "(555) 014-2203",
    shift: { label: "Day · 7 AM–7 PM", today: "7:00 AM–7:00 PM", next: "Wed, Jun 24 · 7:00 AM" },
    schedule: [
      { title: "Today · Day shift", detail: "7:00 AM–7:00 PM · North wing", status: "In progress" },
      { title: "Wed, Jun 24 · Day shift", detail: "7:00 AM–7:00 PM · North wing", status: "Scheduled" },
      { title: "Fri, Jun 26 · Day shift", detail: "7:00 AM–7:00 PM · Clinical coverage", status: "Scheduled" },
    ],
    residents: ["Eleanor Whitfield", "Rosa Iniguez", "Lillian Park"],
    tasks: [
      { title: "Morning clinical review", detail: "3 residents · due 9:30 AM", status: "In progress" },
      { title: "Shift handoff summary", detail: "North wing · due 6:30 PM", status: "Planned" },
    ],
    certifications: [
      { title: "Registered Nurse license", detail: "Renewal tracked · Mar 2027", status: "Current" },
      { title: "CPR / Basic Life Support", detail: "Renewal tracked · Nov 2026", status: "Current" },
    ],
    teams: ["North wing care team", "Clinical quality group"],
  },
  {
    id: "amara-koch", name: "Amara Koch", role: "Intake nurse", status: "On shift", tone: "green",
    email: "amara.koch@example.org", phone: "(555) 014-9981",
    shift: { label: "Day · 8 AM–4 PM", today: "8:00 AM–4:00 PM", next: "Wed, Jun 24 · 8:00 AM" },
    schedule: [
      { title: "Today · Intake coverage", detail: "8:00 AM–4:00 PM · Admissions", status: "In progress" },
      { title: "Wed, Jun 24 · Intake coverage", detail: "8:00 AM–4:00 PM · Admissions", status: "Scheduled" },
    ],
    residents: ["Eleanor Whitfield", "Grace Tan"],
    tasks: [
      { title: "Admission readiness review", detail: "1 pending admission · due today", status: "In progress" },
      { title: "Care coordinator check-in", detail: "2 residents · this week", status: "Planned" },
    ],
    certifications: [
      { title: "Registered Nurse license", detail: "Renewal tracked · Jan 2027", status: "Current" },
      { title: "CPR / Basic Life Support", detail: "Renewal tracked · Sep 2026", status: "Current" },
    ],
    teams: ["Admissions team", "West wing care team"],
  },
  {
    id: "priya-nair", name: "Priya Nair", role: "Caregiver", status: "On shift", tone: "green",
    email: "priya.nair@example.org", phone: "(555) 014-7765",
    shift: { label: "Day · 7 AM–3 PM", today: "7:00 AM–3:00 PM", next: "Thu, Jun 25 · 7:00 AM" },
    schedule: [
      { title: "Today · Day shift", detail: "7:00 AM–3:00 PM · Skilled nursing", status: "In progress" },
      { title: "Thu, Jun 25 · Day shift", detail: "7:00 AM–3:00 PM · Skilled nursing", status: "Scheduled" },
    ],
    residents: ["Rosa Iniguez", "Grace Tan", "Lillian Park"],
    tasks: [
      { title: "Daily routine support", detail: "3 residents · today", status: "In progress" },
      { title: "Activity participation notes", detail: "Due before shift end", status: "Planned" },
    ],
    certifications: [
      { title: "Direct care credential", detail: "Renewal tracked · Feb 2027", status: "Current" },
      { title: "First aid", detail: "Renewal tracked · Oct 2026", status: "Current" },
    ],
    teams: ["Skilled nursing team", "Activities support group"],
  },
  {
    id: "tomas-reyes", name: "Tomas Reyes", role: "Caregiver", status: "Off shift", tone: "gray",
    email: "tomas.reyes@example.org", phone: "(555) 014-3320",
    shift: { label: "Night · 7 PM–7 AM", today: "Off shift", next: "Tonight · 7:00 PM" },
    schedule: [
      { title: "Tonight · Night shift", detail: "7:00 PM–7:00 AM · Memory care", status: "Scheduled" },
      { title: "Thu, Jun 25 · Night shift", detail: "7:00 PM–7:00 AM · Memory care", status: "Scheduled" },
    ],
    residents: ["Marcus Bell"],
    tasks: [{ title: "Evening handoff", detail: "Memory care · 7:00 PM", status: "Planned" }],
    certifications: [
      { title: "Direct care credential", detail: "Renewal tracked · Dec 2026", status: "Current" },
      { title: "Dementia care training", detail: "Refresher due · Aug 2026", status: "Due soon" },
    ],
    teams: ["Memory care team"],
  },
  {
    id: "sofia-marin", name: "Sofia Marin", role: "Care manager", status: "On shift", tone: "green",
    email: "sofia.marin@example.org", phone: "(555) 014-5512",
    shift: { label: "Day · 9 AM–5 PM", today: "9:00 AM–5:00 PM", next: "Wed, Jun 24 · 9:00 AM" },
    schedule: [
      { title: "Today · Management coverage", detail: "9:00 AM–5:00 PM · Facility-wide", status: "In progress" },
      { title: "Wed, Jun 24 · Management coverage", detail: "9:00 AM–5:00 PM · Facility-wide", status: "Scheduled" },
    ],
    residents: ["Eleanor Whitfield", "Marcus Bell", "Rosa Iniguez", "Grace Tan"],
    tasks: [
      { title: "Weekly care team review", detail: "4 resident summaries · 2:00 PM", status: "Planned" },
      { title: "Coverage plan approval", detail: "Next seven days", status: "In progress" },
    ],
    certifications: [
      { title: "Care management credential", detail: "Renewal tracked · May 2027", status: "Current" },
      { title: "CPR / Basic Life Support", detail: "Renewal tracked · Dec 2026", status: "Current" },
    ],
    teams: ["Care leadership team", "Clinical quality group"],
  },
  {
    id: "niall-brennan", name: "Niall Brennan", role: "Medication aide", status: "On leave", tone: "amber",
    email: "niall.brennan@example.org", phone: "(555) 014-8890",
    shift: { label: "Swing · 3 PM–11 PM", today: "On leave", next: "Mon, Jun 29 · 3:00 PM" },
    schedule: [
      { title: "Mon, Jun 29 · Swing shift", detail: "3:00 PM–11:00 PM · West wing", status: "Scheduled" },
      { title: "Tue, Jun 30 · Swing shift", detail: "3:00 PM–11:00 PM · West wing", status: "Scheduled" },
    ],
    residents: ["Eleanor Whitfield", "Grace Tan"],
    tasks: [{ title: "Return-to-shift handoff", detail: "West wing · Jun 29", status: "Planned" }],
    certifications: [
      { title: "Medication aide credential", detail: "Renewal tracked · Apr 2027", status: "Current" },
      { title: "CPR / Basic Life Support", detail: "Renewal tracked · Jul 2026", status: "Due soon" },
    ],
    teams: ["West wing care team", "Medication support team"],
  },
];

export function getStaff(id) {
  return STAFF.find((staff) => staff.id === id);
}
