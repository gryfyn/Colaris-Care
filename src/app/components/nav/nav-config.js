export const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { id: "dashboard",   label: "Dashboard",   icon: "⊞" },
      { id: "residents",   label: "Residents",   icon: "♟" },
      { id: "care",        label: "Care Plans",  icon: "✚" },
      { id: "medications", label: "Medications", icon: "⬡" },
      { id: "staff",       label: "Staff",       icon: "◉" },
    ],
  },
  {
    label: "Clinical",
    items: [
      { id: "reports",     label: "Reports",      icon: "▦" },
      { id: "compliance",  label: "Compliance",   icon: "◈" },
      { id: "face-sheet",  label: "Face Sheets",  icon: "◧" },
    ],
  },
  {
    label: "Facility",
    items: [
      { id: "appointments",  label: "Appointments",  icon: "◷" },
      { id: "announcements", label: "Announcements", icon: "⚐" },
      { id: "calendar",      label: "Calendar",      icon: "▣" },
    ],
  },
];

export const NAV_ITEMS_FLAT = NAV_GROUPS.flatMap(g => g.items);
