'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STAFF_ROSTER = [
  { id: 1, name: "Patricia Nguyen", role: "Clinical Director" },
  { id: 2, name: "Carlos Rivera",   role: "RN" },
  { id: 3, name: "Tamara Ellis",    role: "Caregiver" },
  { id: 4, name: "James Okoro",     role: "Caregiver" },
];

const RESIDENTS = [
  { id: 1, name: "Marcus Thompson", room: "101" },
  { id: 2, name: "Diane Kowalski",  room: "104" },
  { id: 3, name: "Roy Hendricks",   room: "107" },
  { id: 4, name: "Sylvia Crane",    room: "112" },
];

const NOTIFICATIONS = {
  admin: [
    { id: 1, type: "critical",     category: "Compliance",   title: "3 Progress Notes Unsigned",                    body: "Daily progress notes from May 10th are pending signature: Diane Kowalski (C. Rivera), Roy Hendricks (T. Ellis, J. Okoro). OAR requires same-day completion.",                                                     time: "2h ago",           read: false, action: "Review Notes",      actionTarget: "/staff" },
    { id: 2, type: "critical",     category: "Incident",     title: "Open Incident — Marcus Thompson",               body: "Verbal agitation incident in Common Area (May 8, 14:30) filed by Carlos Rivera is still open. Review and close or escalate as needed.",                                                                          time: "2 days ago",       read: false, action: "View Incident",     actionTarget: "/staff" },
    { id: 3, type: "warning",      category: "Medication",   title: "Medication Error Under Review — Diane Kowalski",body: "Lithium 300mg morning dose discrepancy (May 6). MAR flagged. Prescriber notified. Awaiting resolution.",                                                                                                           time: "4 days ago",       read: false, action: "View MAR",          actionTarget: "/staff" },
    { id: 4, type: "warning",      category: "Compliance",   title: "Controlled Substance Disposal — Missing Witness",body: "Lorazepam 0.5mg disposal (Sylvia Crane, Apr 10) lacks a required second witness signature. OAR 411-054-0070 mandates dual sign-off for controlled substances.",                                                    time: "1 month ago",      read: true,  action: "Fix Record",        actionTarget: "/staff" },
    { id: 5, type: "warning",      category: "Care Plans",   title: "Care Plan Review Due — Roy Hendricks",          body: "Roy Hendricks's initial care plan (effective Aug 25, 2024) is due for annual review. Counselor: Tamara Ellis, MSW.",                                                                                               time: "3 days ago",       read: false, action: "Open Plan",         actionTarget: "/" },
    { id: 6, type: "info",         category: "Staff",        title: "Night Shift Coverage — Tamara Ellis Clocked Out",body: "Tamara Ellis has not clocked in for the 7AM shift. James Okoro is currently the only overnight staff present.",                                                                                                    time: "Today, 07:30 AM",  read: true,  action: null,                actionTarget: null },
    { id: 7, type: "announcement", category: "Announcement", title: "Evening Medication Round Time Change",           body: "Effective May 1st, evening medication rounds shift from 8PM to 9PM per new psychiatrist orders. All staff must document the change in shift notes.",                                                                  time: "9 days ago",       read: true,  action: null,                actionTarget: null },
    { id: 8, type: "info",         category: "Appointments", title: "Upcoming: Marcus Thompson — Psychiatry (May 15)",body: "Quarterly medication review at Oregon Psychiatric Assoc., 10:00 AM. Staff transport confirmed. Fast not required.",                                                                                                  time: "5 days ago",       read: true,  action: "View Appointment",  actionTarget: "/" },
  ],
  staff: {
    rn: [
      { id: 1, type: "warning",      category: "Documentation", title: "You have 1 unsigned progress note",           body: "Your daily note for Diane Kowalski (May 10, Day Shift) is pending your signature. Complete before end of shift.",                                                                                              time: "3h ago",           read: false, action: "Sign Now",       actionTarget: "/staff" },
      { id: 2, type: "info",         category: "Incident",      title: "Incident Status Update — Marcus Thompson",    body: "The behavioral incident you filed on May 8 is still Open. Clinical Director has been notified.",                                                                                                                  time: "2 days ago",       read: false, action: "View",           actionTarget: "/staff" },
      { id: 3, type: "info",         category: "Medications",   title: "MAR Review Flag — Diane Kowalski",            body: "The Lithium discrepancy you documented on May 6 is under review by Patricia Nguyen. No action needed from you at this time.",                                                                                    time: "4 days ago",       read: true,  action: null,             actionTarget: null },
      { id: 4, type: "info",         category: "Appointments",  title: "Reminder: Marcus Thompson — Psychiatry Tomorrow",body: "Appointment at Oregon Psychiatric Assoc. tomorrow, May 15 at 10:00 AM. You are the assigned transport staff. Confirm by 8 AM.",                                                                             time: "Today",            read: false, action: "Confirm",        actionTarget: "/staff" },
      { id: 5, type: "announcement", category: "Announcement",  title: "Fire Safety Refresher — May 15th",            body: "Mandatory fire safety and evacuation refresher on May 15th at 9AM in the common room. All day-shift staff required.",                                                                                            time: "18 days ago",      read: true,  action: null,             actionTarget: null },
    ],
    caregiver: [
      { id: 1, type: "warning",      category: "Documentation", title: "Progress Note Pending — Roy Hendricks",       body: "Your daily progress note for Roy Hendricks (May 10, Day Shift) has not been submitted. Please complete before your shift ends.",                                                                               time: "4h ago",           read: false, action: "Write Note",     actionTarget: "/staff" },
      { id: 2, type: "info",         category: "Appointments",  title: "Roy Hendricks — Primary Care Today",          body: "Roy has a Primary Care appointment today, May 10 at 11:00 AM at Legacy Medical Group. Staff transport — you are assigned.",                                                                                    time: "This morning",     read: false, action: "View Details",   actionTarget: "/staff" },
      { id: 3, type: "announcement", category: "Announcement",  title: "Visitor Policy Reminder",                     body: "Visitors must check in at front desk with valid ID. Hours: 10AM–12PM and 2PM–6PM daily. Pre-approval required.",                                                                                                time: "22 days ago",      read: true,  action: null,             actionTarget: null },
    ],
  },
  resident: [
    { id: 1, type: "announcement", category: "Upcoming Event",    title: "Spring BBQ — This Saturday!",                 body: "We're hosting a spring BBQ in the courtyard on Saturday May 10th at 2PM. You're welcome to invite one family member. Let staff know if you'd like to RSVP.",                         time: "15 days ago", read: false, action: "RSVP with Staff", actionTarget: null },
    { id: 2, type: "info",         category: "Your Appointments", title: "Reminder: Psychiatry Appointment — May 15",   body: "You have a quarterly medication review with Dr. Alan Webb at Oregon Psychiatric Assoc. on May 15 at 10:00 AM. Staff will arrange transport.",                                         time: "5 days ago",  read: false, action: "View Details",    actionTarget: "/residents" },
    { id: 3, type: "info",         category: "Activities",        title: "New Activity: Music Therapy",                  body: "Music Therapy with a licensed music therapist is now on the schedule every Thursday at 4:00 PM in the Music Room. Sign up with your counselor!",                                     time: "1 week ago",  read: true,  action: "See Schedule",    actionTarget: "/residents" },
    { id: 4, type: "announcement", category: "Facility",          title: "Visitor Policy Reminder",                     body: "Visiting hours are 10AM–12PM and 2PM–6PM daily. All visitors must check in at the front desk with a valid ID. Please let a staff member know in advance.",                           time: "22 days ago", read: true,  action: null,              actionTarget: null },
    { id: 5, type: "info",         category: "From Your Team",    title: "Message from Carlos Rivera, RN",              body: "Hi Marcus, just a reminder that your lab work is scheduled for May 22 at 8:00 AM. We'll arrange transport. Let me know if you have any questions.",                                  time: "3 days ago",  read: true,  action: null,              actionTarget: null },
  ],
};

const ROLE_PERMS = {
  "Clinical Director": ["daily_notes","medications","incidents","drug_disposal","appointments","evac_drills","care_plans","sign_notes","view_all"],
  "RN":                ["daily_notes","medications","incidents","drug_disposal","appointments","evac_drills","care_plans","sign_notes"],
  "Caregiver":         ["daily_notes","incidents","appointments","evac_drills"],
};

const TYPE_CLS = {
  critical:     { unreadBg: "bg-red-50",     border: "border-red-200",    borderL: "border-l-red-500",    dot: "bg-red-500",    dotShadow: "shadow-[0_0_6px_#ef4444]",  catCls: "bg-red-50 border-red-200 text-red-800",     text: "text-red-500"    },
  warning:      { unreadBg: "bg-amber-50",   border: "border-amber-200",  borderL: "border-l-amber-400",  dot: "bg-amber-500",  dotShadow: "shadow-[0_0_6px_#f59e0b]",  catCls: "bg-amber-50 border-amber-200 text-amber-800", text: "text-amber-500"  },
  info:         { unreadBg: "bg-blue-50",    border: "border-blue-200",   borderL: "border-l-blue-500",   dot: "bg-blue-500",   dotShadow: "shadow-[0_0_6px_#3b82f6]",  catCls: "bg-blue-50 border-blue-200 text-blue-800",   text: "text-blue-500"   },
  announcement: { unreadBg: "bg-purple-50",  border: "border-purple-200", borderL: "border-l-purple-500", dot: "bg-purple-500", dotShadow: "shadow-[0_0_6px_#8b5cf6]",  catCls: "bg-purple-50 border-purple-200 text-purple-800", text: "text-purple-500" },
};

function NotifCard({ n, onDismiss }) {
  const s = TYPE_CLS[n.type] || TYPE_CLS.info;
  return (
    <div className={`${n.read ? "bg-white border-slate-200" : `${s.unreadBg} ${s.border}`} border border-l-4 ${s.borderL} rounded-lg p-4 transition-shadow hover:shadow-md`}>
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? "bg-slate-300" : `${s.dot} ${s.dotShadow}`}`} />

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 uppercase tracking-wider ${s.catCls}`}>{n.category}</span>
            <span className="text-[11px] text-slate-400">{n.time}</span>
            {!n.read && <span className={`text-[10px] font-bold ml-auto ${s.text}`}>NEW</span>}
          </div>
          {/* Title */}
          <div className="text-sm font-bold text-navy mb-1.5 leading-tight">{n.title}</div>
          {/* Body */}
          <div className={`text-xs text-slate-600 leading-relaxed ${n.action ? "mb-2.5" : ""}`}>{n.body}</div>
          {/* Action button */}
          {n.action && (
            <button className="bg-brand text-white border-none rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-blue-700 transition-colors">
              {n.action} →
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button onClick={() => onDismiss(n.id)} title="Dismiss"
          className="bg-transparent border-none text-slate-400 cursor-pointer text-base leading-none p-0.5 shrink-0 hover:text-slate-600 transition-colors">
          ✕
        </button>
      </div>
    </div>
  );
}

const PERSONAS = [
  { id: "admin",    label: "Clinical Director (Admin)", initials: "PN", color: "#3b82f6" },
  { id: "staff_rn", label: "Carlos Rivera — RN",        initials: "CR", color: "#7c3aed" },
  { id: "staff_cg", label: "Tamara Ellis — Caregiver",  initials: "TE", color: "#0891b2" },
  { id: "resident", label: "Marcus Thompson (Resident)",initials: "MT", color: "#10b981" },
];

function NotificationsInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const typeParam    = searchParams.get('type');

  const defaultPersona = typeParam === 'resident' ? "resident" : "admin";
  const [personaId, setPersonaId] = useState(defaultPersona);
  const [dismissed, setDismissed] = useState([]);
  const [filter, setFilter]       = useState("all");

  const persona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];

  const getNotifs = () => {
    if (personaId === "admin")    return NOTIFICATIONS.admin;
    if (personaId === "staff_rn") return NOTIFICATIONS.staff.rn;
    if (personaId === "staff_cg") return NOTIFICATIONS.staff.caregiver;
    if (personaId === "resident") return NOTIFICATIONS.resident;
    return [];
  };

  const allNotifs   = getNotifs().filter(n => !dismissed.includes(n.id));
  const unreadCount = allNotifs.filter(n => !n.read).length;

  const filtered = filter === "all" ? allNotifs : allNotifs.filter(n => {
    if (filter === "unread")   return !n.read;
    if (filter === "critical") return n.type === "critical" || n.type === "warning";
    return true;
  });

  const FILTERS = [
    { id: "all",      label: "All",           count: allNotifs.length },
    { id: "unread",   label: "Unread",        count: unreadCount },
    { id: "critical", label: "Action Needed", count: allNotifs.filter(n => n.type === "critical" || n.type === "warning").length },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <div className="shrink-0">
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 35%, #7c3aed 65%, #3b82f6 100%)" }} />
        <div className="bg-white border-b border-slate-200 px-6 h-[58px] flex items-center gap-3.5 shadow-sm">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer shrink-0 hover:bg-slate-200 transition-colors">
            ← Back
          </button>

          <div className="w-px h-5 bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-brand-muted to-brand-light border border-blue-200 flex items-center justify-center text-[17px]">🔔</div>
            <div className="leading-none">
              <div className="text-sm font-bold text-slate-900">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-[11px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unreadCount} new</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Dependable Care WC</div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Persona switcher */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Viewing as:</span>
            <select value={personaId} onChange={e => { setPersonaId(e.target.value); setFilter("all"); setDismissed([]); }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 outline-none cursor-pointer appearance-none">
              {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-[760px] mx-auto px-5 py-7">

        {/* Current user chip */}
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-4 py-3 mb-5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${persona.color} 0%, ${persona.color}cc 100%)`, boxShadow: `0 2px 8px ${persona.color}40` }}>
            {persona.initials}
          </div>
          <div className="leading-none">
            <div className="text-sm font-bold text-navy">{persona.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{unreadCount} unread · {allNotifs.length} total</div>
          </div>
          {unreadCount === 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-green-700 font-bold">All caught up</span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-4">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                filter === f.id ? "bg-brand border-brand text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              {f.label}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${filter === f.id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"}`}>
                {f.count}
              </span>
            </button>
          ))}
          <button onClick={() => setDismissed(allNotifs.map(n => n.id))}
            className="ml-auto px-3.5 py-1.5 rounded-lg border border-slate-200 bg-transparent text-slate-400 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
            Clear all
          </button>
        </div>

        {/* Notification list */}
        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
              <div className="text-[32px] mb-3">🔔</div>
              <div className="text-sm font-semibold text-navy mb-1.5">No notifications here</div>
              <div className="text-sm text-slate-400">
                {filter === "unread" ? "You're all caught up — no unread notifications." : "Nothing to show for this filter."}
              </div>
            </div>
          ) : (
            filtered.map(n => (
              <NotifCard key={n.id} n={n} onDismiss={id => setDismissed(prev => [...prev, id])} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    }>
      <NotificationsInner />
    </Suspense>
  );
}
