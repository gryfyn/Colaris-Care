"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";

// DCLLC-style month-grid calendar, adapted to Colaris. Appointments are the
// interactive layer (view + create); announcements and evacuation drills are
// overlaid as read-only day markers so nothing from the old list view is lost.

const KIND = {
  appointment: { label: "Appointment", color: "var(--cx-accent, #1a56db)", bg: "rgba(26,86,219,0.10)" },
  announcement: { label: "Announcement", color: "#b45309", bg: "rgba(180,83,9,0.12)" },
  drill: { label: "Evacuation drill", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const inp = { width: "100%", padding: "9px 12px", border: "1px solid var(--cx-line)", borderRadius: 8, fontSize: 13.5, background: "var(--cx-surface, #fff)", color: "var(--cx-ink)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };
const navBtn = { width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--cx-surface, #fff)", border: "1px solid var(--cx-line)", borderRadius: 8, color: "var(--cx-ink)", cursor: "pointer" };

const pad = (n) => String(n).padStart(2, "0");
const ymdLocal = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Normalize any stored date/timestamp to a local YYYY-MM-DD + HH:mm (time null
// for date-only values).
function toDayTime(value) {
  if (!value) return { day: null, time: null };
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { day: str, time: null };
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return { day: null, time: null };
  return { day: ymdLocal(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

export default function CalendarMonth({ apiData }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [overlayDate, setOverlayDate] = useState(null); // YYYY-MM-DD
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [appts, anns, drills] = await Promise.all([
      apiData("/api/v1/appointments").catch(() => []),
      apiData("/api/v1/announcements").catch(() => []),
      apiData("/api/v1/evacuation-drills").catch(() => []),
    ]);
    const mapped = [
      ...(Array.isArray(appts) ? appts : []).map((a) => {
        const { day, time } = toDayTime(a.startsAt || a.date);
        return { id: `a-${a.id}`, kind: "appointment", title: a.title || "Appointment", resident: a.residentName || null, status: a.status || "scheduled", location: a.location, day, time };
      }),
      ...(Array.isArray(anns) ? anns : []).map((a) => {
        const { day, time } = toDayTime(a.publishedAt || a.createdAt);
        return { id: `n-${a.id}`, kind: "announcement", title: a.title || "Announcement", resident: a.audience || "Facility", status: a.priority || "Published", day, time };
      }),
      ...(Array.isArray(drills) ? drills : []).map((a) => {
        const { day, time } = toDayTime(a.drillDate || a.createdAt);
        return { id: `d-${a.id}`, kind: "drill", title: a.title || "Evacuation drill", resident: a.scope || "Facility-wide", status: a.status || "Completed", day, time };
      }),
    ].filter((e) => e.day);
    setEvents(mapped);
    setLoading(false);
  }, [apiData]);

  useEffect(() => {
    void load();
    apiData("/api/v1/residents").then((r) => Array.isArray(r) && setResidents(r)).catch(() => {});
  }, [load, apiData]);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.day] = map[e.day] || []).push(e);
    for (const day of Object.keys(map)) map[day].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return map;
  }, [events]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const dayKey = (d) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const prev = () => (month === 0 ? (setMonth(11), setYear((y) => y - 1)) : setMonth((m) => m - 1));
  const next = () => (month === 11 ? (setMonth(0), setYear((y) => y + 1)) : setMonth((m) => m + 1));

  const overlayEvents = overlayDate ? byDay[overlayDate] || [] : [];

  function openDay(day) { setOverlayDate(day); setAdding(false); setForm({}); setError(""); }
  function openAdd(day) {
    const d = day || overlayDate || dayKey(today.getDate());
    setOverlayDate(d); setAdding(true); setError("");
    setForm({ date: d, time: "09:00", duration: 60, status: "scheduled", residentId: "", title: "", location: "" });
  }
  function closeOverlay() { setOverlayDate(null); setAdding(false); setForm({}); setError(""); }

  async function save() {
    setError("");
    if (!form.title?.trim()) return setError("Title is required.");
    if (!form.date || !form.time) return setError("Date and time are required.");
    setSaving(true);
    try {
      const startsAt = new Date(`${form.date}T${form.time}:00`);
      const endsAt = new Date(startsAt.getTime() + (parseInt(form.duration, 10) || 60) * 60000);
      await apiData("/api/v1/appointments", {
        method: "POST",
        body: JSON.stringify({
          residentId: form.residentId || null,
          title: form.title.trim(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: form.location?.trim() || null,
          status: form.status || "scheduled",
        }),
      });
      closeOverlay();
      await load();
    } catch (err) {
      setSaving(false);
      setError(err.message || "Failed to save event.");
    }
  }

  const residentOptions = residents.map((r) => ({ value: r.id, label: r.name || `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Resident" }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 14 }}>
        <button type="button" className="cx-btn cx-btn-primary" onClick={() => openAdd()}><Plus size={15} /> Add event</button>
      </div>

      <div style={{ background: "var(--cx-surface, #fff)", border: "1px solid var(--cx-line)", borderRadius: 14, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--cx-line)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cx-ink)", minWidth: 180 }}>{monthLabel}</div>
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-compact" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>Today</button>
          {loading && <Loader2 size={14} className="cx-spin" style={{ color: "var(--cx-faint)" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <button type="button" onClick={prev} aria-label="Previous month" style={navBtn}><ChevronLeft size={17} /></button>
            <button type="button" onClick={next} aria-label="Next month" style={navBtn}><ChevronRight size={17} /></button>
          </div>
        </div>
        {/* Weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--cx-line)" }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ padding: "9px 0 9px 10px", fontSize: 11, fontWeight: 700, color: "var(--cx-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`b${i}`} style={{ minHeight: 104, borderRight: "1px solid var(--cx-line)", borderBottom: "1px solid var(--cx-line)", background: "var(--cx-tint, #f7f9fc)" }} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const key = dayKey(d);
            const list = byDay[key] || [];
            const tdy = isToday(d);
            return (
              <div key={d} onClick={() => openDay(key)} style={{ minHeight: 104, borderRight: "1px solid var(--cx-line)", borderBottom: "1px solid var(--cx-line)", padding: "6px 6px 8px", background: "var(--cx-surface, #fff)", cursor: "pointer" }}>
                <div style={{ marginBottom: 5 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: tdy ? "var(--cx-accent, #1a56db)" : "transparent", color: tdy ? "#fff" : "var(--cx-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: tdy ? 700 : 500 }}>{d}</span>
                </div>
                {list.length > 0 && (
                  <div style={{ display: "grid", gap: 3 }}>
                    {list.slice(0, 3).map((e) => {
                      const k = KIND[e.kind];
                      return (
                        <div key={e.id} title={`${e.title}${e.resident ? " — " + e.resident : ""}`} style={{ display: "flex", alignItems: "center", gap: 5, background: k.bg, borderRadius: 5, padding: "2px 6px", overflow: "hidden" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: k.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: k.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.time ? fmtTime(e.time) + " · " : ""}{e.resident || e.title}</span>
                        </div>
                      );
                    })}
                    {list.length > 3 && <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cx-faint)", paddingLeft: 4 }}>+{list.length - 3} more</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overlay */}
      {overlayDate && (
        <div className="cx-ob-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !saving) closeOverlay(); }}>
          <div role="dialog" aria-modal="true" aria-label="Day events" className="cx-panel" style={{ width: "min(620px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cx-line)" }}>
              <div>
                <div className="cx-eyebrow">{adding ? "New event" : "Calendar"}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cx-ink)" }}>{new Date(overlayDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
              </div>
              <button type="button" className="cx-icon-btn" aria-label="Close" onClick={closeOverlay} disabled={saving}><X size={17} /></button>
            </div>

            <div style={{ overflowY: "auto", padding: 18, flex: 1 }}>
              {!adding && (
                overlayEvents.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--cx-faint)", fontSize: 13 }}>Nothing scheduled on this day.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {overlayEvents.map((e) => {
                      const k = KIND[e.kind];
                      return (
                        <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "var(--cx-tint, #f7f9fc)", borderRadius: 8, borderLeft: `3px solid ${k.color}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--cx-ink)" }}>{e.title}</div>
                            <div style={{ fontSize: 12, color: "var(--cx-faint)", marginTop: 2 }}>{k.label}{e.resident ? ` · ${e.resident}` : ""}{e.time ? ` · ${fmtTime(e.time)}` : ""}{e.location ? ` · ${e.location}` : ""}</div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: k.color, background: k.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{e.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {adding && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={lbl}>Resident (optional)</label>
                    <select style={inp} value={form.residentId || ""} onChange={(e) => setForm((f) => ({ ...f, residentId: e.target.value }))}>
                      <option value="">Facility event — no resident</option>
                      {residentOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Title</label>
                    <input style={inp} value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Dr. Smith — follow-up, or Staff meeting" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={lbl}>Date</label><input type="date" style={inp} value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
                    <div><label style={lbl}>Time</label><input type="time" style={inp} value={form.time || ""} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={lbl}>Duration (min)</label><input type="number" min="0" style={inp} value={form.duration ?? 60} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} /></div>
                    <div><label style={lbl}>Status</label><select style={inp} value={form.status || "scheduled"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
                  </div>
                  <div><label style={lbl}>Location</label><input style={inp} value={form.location || ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Optional" /></div>
                  {error && <div style={{ padding: "10px 12px", background: "#fef2f2", color: "#b42318", borderRadius: 8, fontSize: 13, borderLeft: "3px solid #b42318" }}>{error}</div>}
                </div>
              )}
            </div>

            <div className="cx-actionbar" style={{ marginTop: 0 }}>
              <button type="button" className="cx-btn cx-btn-quiet" onClick={closeOverlay} disabled={saving}>Close</button>
              <span className="cx-ab-spacer" />
              {!adding ? (
                <button type="button" className="cx-btn cx-btn-primary" onClick={() => openAdd(overlayDate)}><Plus size={14} /> Add event on this day</button>
              ) : (
                <button type="button" className="cx-btn cx-btn-primary" onClick={save} disabled={saving}>{saving ? <><Loader2 size={15} className="cx-spin" /> Saving...</> : "Save event"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
