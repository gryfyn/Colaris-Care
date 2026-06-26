export const RESIDENTS = ["Eleanor Whitfield", "Marcus Bell", "Rosa Iniguez", "Grace Tan", "Lillian Park"];

export const RECORD_CONFIG = {
  progress: {
    title: "Progress Notes",
    eyebrow: "Clinical documentation",
    description: "Review progress notes submitted by staff and record an approval decision.",
    columns: ["Date", "Resident", "Shift", "Staff"],
    records: [
      { id: "PN-1042", date: "2026-06-25", resident: "Eleanor Whitfield", shift: "Morning", staff: "Amara Koch", status: "Pending", details: { "Progress Notes": "Resident participated in the morning routine and selected a recreational activity after breakfast.", "Mood & Behavior": "Alert, Cooperative", "Physical Health": "Stable", "Medications Given": "Morning", "Meal Intake": "Breakfast 75% · Lunch 50%", Activities: "Recreational, Social", "Incidents & Concerns": "None reported." } },
      { id: "PN-1041", date: "2026-06-25", resident: "Marcus Bell", shift: "Morning", staff: "Priya Nair", status: "Approved", details: { "Progress Notes": "Resident completed scheduled activities with verbal prompting.", "Mood & Behavior": "Cooperative", "Physical Health": "Stable", "Medications Given": "Morning", "Meal Intake": "Breakfast 100%", Activities: "Physical, Cognitive", "Incidents & Concerns": "None reported." } },
      { id: "PN-1040", date: "2026-06-24", resident: "Rosa Iniguez", shift: "Evening", staff: "Dauda Okafor", status: "Pending", details: { "Progress Notes": "Evening routine completed. Resident chose quiet reading before bedtime.", "Mood & Behavior": "Alert", "Physical Health": "Stable", "Medications Given": "Evening, Bedtime", "Meal Intake": "Dinner 75%", Activities: "Cognitive", "Incidents & Concerns": "None reported." } },
    ],
  },
  incidents: {
    title: "Incident Reports",
    eyebrow: "Safety review",
    description: "Review and approve incident reports submitted by staff.",
    columns: ["Date", "Resident", "Type", "Staff"],
    records: [
      { id: "INC-0264", date: "2026-06-25", resident: "Marcus Bell", type: "Fall without injury", staff: "Priya Nair", status: "Pending", details: { "Date / time": "June 25, 2026 · 10:18 AM", Location: "West wing hallway", Witnessed: "Yes · Priya Nair", "Other residents involved": "No", "Incident narrative": "Resident lost balance while turning near the activity room. Staff provided immediate support. No visible injury observed.", "Staff actions": "Assisted resident to a chair, completed observation, and notified the care manager.", "Body areas": "No injury identified", Notifications: "Care manager and responsible party notified", "Follow-up plan": "Mobility review and increased observation during transitions.", "Completed by": "Priya Nair" } },
      { id: "INC-0263", date: "2026-06-23", resident: "Grace Tan", type: "Medication refusal", staff: "Amara Koch", status: "Approved", details: { "Date / time": "June 23, 2026 · 8:05 PM", Location: "Resident room", Witnessed: "No", "Other residents involved": "No", "Incident narrative": "Resident declined the scheduled evening medication after two offers.", "Staff actions": "Documented refusal and notified the supervising nurse.", "Body areas": "Not applicable", Notifications: "Supervising nurse notified", "Follow-up plan": "Re-offer only if directed; monitor and document.", "Completed by": "Amara Koch" } },
    ],
  },
  disposal: {
    title: "Drug Disposal",
    eyebrow: "Medication accountability",
    description: "Review and approve medication disposal records submitted by staff.",
    columns: ["Date", "Resident", "Drug", "Quantity", "Staff"],
    records: [
      { id: "DSP-0317", date: "2026-06-24", resident: "Eleanor Whitfield", drug: "Acetaminophen 325 mg", quantity: "4 pills", staff: "Dauda Okafor", status: "Pending", details: { Date: "June 24, 2026", "Drug name": "Acetaminophen", Strength: "325 mg", "Quantity disposed": "4 pills", Reason: "Medication discontinued", Method: "Medication disposal pouch", "Counting & disposing staff": "Dauda Okafor", Witness: "Priya Nair", "Controlled substance": "No" } },
      { id: "DSP-0316", date: "2026-06-19", resident: "Marcus Bell", drug: "Lorazepam 0.5 mg", quantity: "2 pills", staff: "Priya Nair", status: "Approved", details: { Date: "June 19, 2026", "Drug name": "Lorazepam", Strength: "0.5 mg", "Quantity disposed": "2 pills", Reason: "Order changed", Method: "Pharmacy return", "Counting & disposing staff": "Priya Nair", Witness: "Sofia Marin", "Controlled substance": "Yes" } },
    ],
  },
  evacuation: {
    title: "Evacuation Drills",
    eyebrow: "Emergency readiness",
    description: "Review and approve evacuation drill records submitted by staff.",
    columns: ["Date", "Type", "Location", "Accounted", "Staff"],
    records: [
      { id: "DRL-0088", date: "2026-06-24", type: "Fire", location: "North parking assembly area", accounted: "All", staff: "Amara Koch", status: "Pending", details: { "Drill type": "Fire", "Date / time": "June 24, 2026 · 2:15 PM", Duration: "6 minutes 40 seconds", "Location evacuated": "Entire facility", "Assembly location": "North parking assembly area", "Residents evacuated": "18", "Staff involved": "5", "All residents accounted for": "Yes", "Issues encountered": "One exit path was partially obstructed and cleared during the drill.", "Completed on schedule": "Yes", "Follow-up actions": "Review exit-path checks during shift handoff.", "Signed by": "Amara Koch" } },
      { id: "DRL-0087", date: "2026-05-28", type: "Severe weather", location: "Interior safe area", accounted: "All", staff: "Tomas Reyes", status: "Approved", details: { "Drill type": "Severe weather", "Date / time": "May 28, 2026 · 7:00 PM", Duration: "8 minutes 12 seconds", "Location evacuated": "All wings", "Assembly location": "Interior safe area", "Residents evacuated": "17", "Staff involved": "4", "All residents accounted for": "Yes", "Issues encountered": "None", "Completed on schedule": "Yes", "Follow-up actions": "None", "Signed by": "Tomas Reyes" } },
    ],
  },
};
