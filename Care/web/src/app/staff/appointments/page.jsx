"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck, CalendarClock, CarFront, Clock3, MapPin, Search, Stethoscope, Users,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/data";

const FACILITY = { organizationId: "org-maple-health-partners", facilityId: "facility-maple-grove-care" };

const TYPES = ["All", "Medical visit", "Activity", "Transport", "Family visit"];

const TYPE_STYLE = {
  "Medical visit": { tone: "blue", icon: Stethoscope, bg: "#E8EEF6", color: "#2D5C88" },
  Activity: { tone: "green", icon: Users, bg: "var(--cx-accent-soft)", color: "var(--cx-accent)" },
  Transport: { tone: "amber", icon: CarFront, bg: "var(--cx-amber-soft)", color: "var(--cx-amber)" },
  "Family visit": { tone: "gray", icon: CalendarClock, bg: "var(--cx-paper-2)", color: "var(--cx-muted)" },
};

const STATUS_TONE = { Scheduled: "blue", Confirmed: "green", Completed: "gray", Cancelled: "red" };

const pad = (value) => String(value).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// Fixed reference day so this sample calendar renders identically on the server
// and the client (a live `new Date()` here caused React hydration mismatches).
const dateFromOffset = (offset) => {
  const date = new Date(2026, 5, 22, 12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

const SAMPLE = [
  { id: 1, dayOffset: 0, time: "9:00 AM", resident: "Eleanor Whitfield", type: "Activity", detail: "Garden group", location: "Courtyard", status: "Confirmed", escort: false },
  { id: 2, dayOffset: 0, time: "10:30 AM", resident: "Rosa Iniguez", type: "Medical visit", detail: "Riverside Clinic", location: "North entrance", status: "Confirmed", escort: true },
  { id: 3, dayOffset: 0, time: "2:15 PM", resident: "Marcus Bell", type: "Family visit", detail: "Family lounge", location: "Maple Grove", status: "Scheduled", escort: false },
  { id: 4, dayOffset: 1, time: "8:30 AM", resident: "Lillian Park", type: "Transport", detail: "Community shuttle", location: "Main entrance", status: "Confirmed", escort: true },
  { id: 5, dayOffset: 1, time: "1:00 PM", resident: "Grace Tan", type: "Activity", detail: "Reading group", location: "Library nook", status: "Scheduled", escort: false },
  { id: 6, dayOffset: 3, time: "10:00 AM", resident: "Albert Reyes", type: "Activity", detail: "Walking group", location: "West wing hall", status: "Confirmed", escort: false },
  { id: 7, dayOffset: 5, time: "3:30 PM", resident: "Eleanor Whitfield", type: "Family visit", detail: "Garden room", location: "Maple Grove", status: "Scheduled", escort: false },
  { id: 8, dayOffset: 8, time: "9:45 AM", resident: "Rosa Iniguez", type: "Medical visit", detail: "Lakeside Medical Group", location: "North entrance", status: "Scheduled", escort: true },
].map(({ dayOffset, ...item }) => ({ ...FACILITY, ...item, date: dateFromOffset(dayOffset) }));

function dayHeading(dateKey) {
  if (dateKey === dateFromOffset(0)) return "Today";
  if (dateKey === dateFromOffset(1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function timeValue(time) {
  const match = time.match(/(\d+):(\d+)\s(AM|PM)/);
  if (!match) return time;
  let hour = Number(match[1]) % 12;
  if (match[3] === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

export default function StaffAppointmentsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");

  const today = dateFromOffset(0);
  const weekEnd = dateFromOffset(6);
  const active = SAMPLE.filter((item) => item.status !== "Cancelled");
  const stats = {
    today: active.filter((item) => item.date === today).length,
    week: active.filter((item) => item.date >= today && item.date <= weekEnd).length,
    upcoming: active.filter((item) => item.date >= today && item.status !== "Completed").length,
    escort: active.filter((item) => item.date >= today && item.escort).length,
  };

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return SAMPLE
      .filter((item) => type === "All" || item.type === type)
      .filter((item) => !search || [item.resident, item.type, item.detail, item.location, item.status]
        .some((value) => value.toLowerCase().includes(search)))
      .sort((a, b) => a.date.localeCompare(b.date) || timeValue(a.time) - timeValue(b.time));
  }, [query, type]);

  const grouped = filtered.reduce((groups, item) => {
    (groups[item.date] ||= []).push(item);
    return groups;
  }, {});

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Resident schedule"
        title="Appointments"
        lede="Resident visits, activities, and transport you may be supporting this week."
      />

      <div className="cx-stats">
        <StatCard icon={Clock3} label="Today" value={stats.today} />
        <StatCard icon={CalendarCheck} label="This week" value={stats.week} />
        <StatCard icon={CalendarClock} label="Upcoming" value={stats.upcoming} />
        <StatCard icon={CarFront} label="Needs escort" value={stats.escort} delta="coordinate" />
      </div>

      <div className="cx-toolbar">
        <div className="cx-search">
          <Search size={15} />
          <input aria-label="Search appointments" placeholder="Search resident, type, or location..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="cx-chips" aria-label="Filter appointments by type">
          {TYPES.map((item) => (
            <button type="button" className="cx-chip" data-on={type === item ? "true" : "false"} aria-pressed={type === item} onClick={() => setType(item)} key={item}>{item}</button>
          ))}
        </div>
        <span className="cx-tb-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--cx-faint)" }}>{filtered.length} appointment{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <Panel title="Appointment schedule" action={<span style={{ fontSize: 12, color: "var(--cx-muted)" }}>Chronological</span>}>
        {filtered.length ? Object.entries(grouped).map(([date, items]) => (
          <section key={date} aria-labelledby={`day-${date}`}>
            <div id={`day-${date}`} style={{ padding: "12px 18px 9px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".055em", textTransform: "uppercase", color: "var(--cx-muted)", background: "var(--cx-paper-2)", borderBottom: "1px solid var(--cx-border-soft)" }}>
              {dayHeading(date)} <span style={{ fontWeight: 500, color: "var(--cx-faint)", marginLeft: 5 }}>{items.length}</span>
            </div>
            <div className="cx-feed">
              {items.map((appointment) => {
                const style = TYPE_STYLE[appointment.type];
                const Icon = style.icon;
                return (
                  <article className="cx-feed-item" key={appointment.id} style={{ alignItems: "center", paddingTop: 15, paddingBottom: 15, flexWrap: "wrap" }}>
                    <span className="cx-feed-ico" style={{ background: style.bg, color: style.color }}><Icon size={15} /></span>
                    <Avatar name={appointment.resident} sm />
                    <div className="cx-feed-main" style={{ flex: "1 1 260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                        <span className="cx-feed-t" style={{ fontWeight: 650 }}>{appointment.resident}</span>
                        <Badge tone={style.tone}>{appointment.type}</Badge>
                      </div>
                      <div className="cx-feed-s" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span><MapPin size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />{appointment.detail} · {appointment.location}</span>
                        {appointment.escort && appointment.type !== "Transport" && <span style={{ color: "var(--cx-amber)", fontWeight: 600 }}><CarFront size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />Escort needed</span>}
                      </div>
                    </div>
                    <span className="cx-feed-time" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 0 }}><Clock3 size={11} /> {appointment.time}</span>
                    <Badge tone={STATUS_TONE[appointment.status]} dot>{appointment.status}</Badge>
                  </article>
                );
              })}
            </div>
          </section>
        )) : (
          <EmptyState
            icon={CalendarClock}
            title="No appointments match"
            note="Try a different search term or appointment type."
            action={<button type="button" className="cx-btn cx-btn-ghost" onClick={() => { setQuery(""); setType("All"); }}>Clear filters</button>}
          />
        )}
      </Panel>
    </div>
  );
}
