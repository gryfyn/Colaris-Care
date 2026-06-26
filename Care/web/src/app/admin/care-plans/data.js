export const CARE_PLANS = [
  {
    id: "eleanor-whitfield", resident: "Eleanor Whitfield", room: "W-104",
    focus: "Mobility and daily independence", status: "Active", tone: "green",
    owner: "Amara Koch", lastReviewed: "June 18, 2026", nextReview: "September 18, 2026",
    reviewCycle: "Every 90 days", effectiveDate: "June 19, 2026",
    goals: [
      { title: "Maintain confidence with daily routines", progress: "On track", tone: "green" },
      { title: "Stay engaged in preferred community activities", progress: "In progress", tone: "blue" },
    ],
    objectives: [
      { title: "Choose and complete preferred morning activities", goal: "Daily routines", cadence: "Most days" },
      { title: "Participate in a chosen group activity", goal: "Community activities", cadence: "Weekly" },
    ],
    interventions: [
      { title: "Offer clear choices and allow time for independent completion", owner: "Care team", frequency: "Each shift" },
      { title: "Review the weekly activity schedule together", owner: "Life enrichment", frequency: "Weekly" },
    ],
    reviews: [
      { title: "Scheduled plan review completed", meta: "June 18, 2026 · Amara Koch", note: "Plan continued with updated activity preferences." },
      { title: "Quarterly review completed", meta: "March 20, 2026 · Care planning team", note: "Goals remained appropriate and on track." },
    ],
    signatures: [{ role: "Resident", status: "Acknowledged" }, { role: "Plan owner", status: "Signed" }, { role: "Representative", status: "On file" }],
  },
  {
    id: "marcus-bell", resident: "Marcus Bell", room: "M-210",
    focus: "Consistent and familiar daily routine", status: "Review due", tone: "amber",
    owner: "Tomas Reyes", lastReviewed: "March 12, 2026", nextReview: "June 20, 2026",
    reviewCycle: "Every 90 days", effectiveDate: "March 13, 2026",
    goals: [{ title: "Follow a comfortable and predictable daily rhythm", progress: "Review due", tone: "amber" }],
    objectives: [{ title: "Use a consistent sequence for daily activities", goal: "Daily rhythm", cadence: "Daily" }],
    interventions: [{ title: "Use familiar prompts and the posted routine", owner: "Care team", frequency: "Each shift" }],
    reviews: [{ title: "Quarterly review completed", meta: "March 12, 2026 · Tomas Reyes", note: "Routine supports were continued." }],
    signatures: [{ role: "Resident representative", status: "On file" }, { role: "Plan owner", status: "Signed" }],
  },
  {
    id: "rosa-iniguez", resident: "Rosa Iniguez", room: "N-118",
    focus: "Comfort, mobility, and preferred activities", status: "Active", tone: "green",
    owner: "Priya Nair", lastReviewed: "June 20, 2026", nextReview: "July 20, 2026",
    reviewCycle: "Monthly", effectiveDate: "June 21, 2026",
    goals: [{ title: "Participate comfortably in chosen daily activities", progress: "On track", tone: "green" }],
    objectives: [{ title: "Select one preferred activity each day", goal: "Preferred activities", cadence: "Daily" }],
    interventions: [{ title: "Offer activity choices at the resident's preferred pace", owner: "Care team", frequency: "Daily" }],
    reviews: [{ title: "Monthly review completed", meta: "June 20, 2026 · Priya Nair", note: "Preferences and schedule were refreshed." }],
    signatures: [{ role: "Resident", status: "Acknowledged" }, { role: "Plan owner", status: "Signed" }],
  },
  {
    id: "grace-tan", resident: "Grace Tan", room: "W-106",
    focus: "Social connection and independent choices", status: "Active", tone: "green",
    owner: "Amara Koch", lastReviewed: "June 4, 2026", nextReview: "September 4, 2026",
    reviewCycle: "Every 90 days", effectiveDate: "June 5, 2026",
    goals: [{ title: "Maintain meaningful social connections", progress: "On track", tone: "green" }],
    objectives: [{ title: "Choose a preferred social activity", goal: "Social connection", cadence: "Weekly" }],
    interventions: [{ title: "Share the activity calendar and support resident choice", owner: "Life enrichment", frequency: "Weekly" }],
    reviews: [{ title: "Scheduled review completed", meta: "June 4, 2026 · Amara Koch", note: "Current approach remains effective." }],
    signatures: [{ role: "Resident", status: "Acknowledged" }, { role: "Plan owner", status: "Signed" }],
  },
  {
    id: "henry-osei", resident: "Henry Osei", room: "Pending",
    focus: "Initial preferences and support planning", status: "Draft", tone: "gray",
    owner: "Admissions team", lastReviewed: "Not yet reviewed", nextReview: "After admission",
    reviewCycle: "To be confirmed", effectiveDate: "Not active",
    goals: [], objectives: [], interventions: [], reviews: [], signatures: [{ role: "Plan owner", status: "Pending" }],
  },
  {
    id: "lillian-park", resident: "Lillian Park", room: "N-120",
    focus: "Comfort and participation in preferred routines", status: "Review due", tone: "amber",
    owner: "Priya Nair", lastReviewed: "March 18, 2026", nextReview: "June 18, 2026",
    reviewCycle: "Every 90 days", effectiveDate: "March 19, 2026",
    goals: [{ title: "Continue preferred routines with consistent support", progress: "Review due", tone: "amber" }],
    objectives: [{ title: "Complete the preferred morning routine", goal: "Preferred routines", cadence: "Daily" }],
    interventions: [{ title: "Confirm preferences before beginning routine support", owner: "Care team", frequency: "Each shift" }],
    reviews: [{ title: "Quarterly review completed", meta: "March 18, 2026 · Priya Nair", note: "Plan continued without major changes." }],
    signatures: [{ role: "Resident representative", status: "On file" }, { role: "Plan owner", status: "Signed" }],
  },
];

export function getCarePlan(id) {
  return CARE_PLANS.find((plan) => plan.id === id);
}
