'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorNotification } from '@/app/components/ErrorNotification';
import { parseAPIError, APIError } from '@/lib/api-error-handler';
import ResidentSideNav from '../components/nav/ResidentSideNav';
import ResidentTopNav from '../components/nav/ResidentTopNav';
import { useIsMobile } from '@/lib/useIsMobile';

// ─── UI CONSTANTS (not mock data) ─────────────────────────────────────────────
const C = {
  paper:       "var(--resident-paper)",
  canvas:      "var(--resident-canvas)",
  ink:         "var(--resident-ink)",
  text:        "var(--resident-text)",
  textSoft:    "var(--resident-text-soft)",
  textMuted:   "var(--resident-text-muted)",
  border:      "var(--resident-border)",
  borderSoft:  "var(--resident-border-soft)",
  accent:      "var(--resident-accent)",
  accentSoft:  "var(--resident-accent-soft)",
  success:     "var(--resident-success)",
  successBg:   "var(--resident-success-bg)",
  warning:     "var(--resident-warning)",
  warningBg:   "var(--resident-warning-bg)",
  danger:      "var(--resident-danger)",
  dangerBg:    "var(--resident-danger-bg)",
  info:        "var(--resident-info)",
  infoBg:      "var(--resident-info-bg)",
};

const CAT_COLORS = {
  Therapy:       { bg: "#E8DCF5", border: "#B19CD9", text: C.ink, topHex: "#8B6FA3" },
  Wellness:      { bg: "#DCF5E8", border: "#B1DFB1", text: C.ink, topHex: "#047857" },
  Creative:      { bg: "#F5E8DC", border: "#DCC5A1", text: C.ink, topHex: "#B45309" },
  "Life Skills": { bg: "#F5F0DC", border: "#E8DEB1", text: C.ink, topHex: "#92400E" },
  Community:     { bg: "#E8F5F0", border: "#B1D9D0", text: C.ink, topHex: "#047857" },
};
const CAT_FALLBACK = { bg: "#F0ECFA", border: "#D4C8E8", text: C.ink, topHex: "#8B6FA3" };
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const REQUEST_TYPES = ["Appointment Request","Supply/Item Request","Dietary Preference","Room Concern","Activity Request","Message to Care Team","General Question or Feedback"];

const REQUEST_STATUS_STYLE = {
  pending:   { color: C.warning,   bg: C.warningBg,   label: "Pending"   },
  approved:  { color: C.success,   bg: C.successBg,   label: "Approved"  },
  fulfilled: { color: C.info,      bg: C.infoBg,      label: "Fulfilled" },
  completed: { color: C.info,      bg: C.infoBg,      label: "Fulfilled" },
  denied:    { color: C.danger,    bg: C.dangerBg,    label: "Denied"    },
};

const PRIO_STYLE = {
  event:   { bg: C.infoBg, color: C.info, icon: "🎉" },
  info:    { bg: C.infoBg, color: C.info, icon: "ℹ️" },
  urgent:  { bg: C.dangerBg, color: C.danger, icon: "⚠️" },
  default: { bg: C.infoBg, color: C.info, icon: "ℹ️" },
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.border}`,
      borderRadius: "10px",
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, action, onAction }) {
  return (
    <div style={{
      paddingLeft: "18px",
      paddingRight: "18px",
      paddingTop: "13px",
      paddingBottom: "13px",
      borderBottom: `1px solid ${C.borderSoft}`,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{title}</div>
        {sub && <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>{sub}</div>}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: C.accent,
            color: "white",
            border: "none",
            borderRadius: "6px",
            paddingLeft: "14px",
            paddingRight: "14px",
            paddingTop: "5px",
            paddingBottom: "5px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div style={{
      height: "6px",
      borderRadius: "9999px",
      background: C.borderSoft,
      overflow: "hidden",
    }}>
      <div
        style={{
          height: "100%",
          borderRadius: "9999px",
          transition: "width 500ms ease-out",
          width: `${value}%`,
          background: "linear-gradient(90deg, #10b981 0%, #0891b2 100%)",
        }}
      />
    </div>
  );
}

function SectionLoader({ message = "Loading..." }) {
  return (
    <div style={{
      paddingTop: "40px",
      paddingBottom: "40px",
      textAlign: "center",
      color: C.textMuted,
      fontSize: "13px",
    }}>{message}</div>
  );
}

function SectionError({ message }) {
  return (
    <div style={{
      paddingTop: "24px",
      paddingBottom: "24px",
      paddingLeft: "16px",
      paddingRight: "16px",
      background: C.dangerBg,
      border: `1px solid ${C.danger}`,
      borderRadius: "8px",
      textAlign: "center",
      color: C.danger,
      fontSize: "13px",
    }}>
      {message || "Something went wrong. Please try again."}
    </div>
  );
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return isoString;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  try {
    const [h, m] = timeStr.split(":");
    const d = new Date();
    d.setHours(parseInt(h, 10));
    d.setMinutes(parseInt(m, 10));
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return timeStr;
  }
}

function mapActivity(a) {
  return {
    id:       a.id,
    day:      a.day_of_week,
    time:     formatTime(a.start_time),
    name:     a.name,
    location: a.location,
    category: a.category,
    desc:     a.description || "",
  };
}

function mapAnnouncement(a) {
  let priority = "info";
  if (a.priority === "event" || a.priority === 2) priority = "event";
  else if (a.priority === "urgent" || a.priority >= 2) priority = "urgent";
  const postedBy =
    a.created_by_first_name
      ? `${a.created_by_first_name} ${a.created_by_last_name || ""}`.trim()
      : "Admin";
  return {
    id:      a.id,
    title:   a.title,
    message: a.body,
    priority,
    sender:  postedBy,
    date:    formatDate(a.published_at || a.created_at),
  };
}

function mapRequest(r) {
  const status = r.status === 'completed' ? 'fulfilled' : r.status;
  return {
    id:      r.id,
    type:    r.request_type,
    details: r.details,
    status,
    date:    formatDate(r.created_at),
  };
}

// ─── API HOOK ──────────────────────────────────────────────────────────────────
function useApi(auth) {
  return useCallback(async (path, opts = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(auth?.accessToken && { 'Authorization': `Bearer ${auth.accessToken}` })
    };
    try {
      const response = await fetch(path, { ...opts, headers, credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) {
        throw new APIError(data.error || `Request failed (${response.status})`, response.status);
      }
      return data;
    } catch (err) {
      if (err instanceof APIError) throw err;
      throw new APIError(err.message || 'Network request failed', 0, err);
    }
  }, [auth?.accessToken]);
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
function HomeView({ residentProfile, profileLoading, profileError }) {
  const [todayActivities, setTodayActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState(null);
  const [accountNotifications, setAccountNotifications] = useState([]);
  const { auth } = useAuth();
  const api = useApi(auth);

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const fetchTodayActivities = useCallback(async () => {
    if (!auth?.accessToken) return;
    setActivitiesLoading(true);
    setActivitiesError(null);
    try {
      const data = await api(`/api/v1/activities?day_of_week=${encodeURIComponent(dayName)}&limit=50`);
      setTodayActivities((data.data || []).map(mapActivity));
    } catch (err) {
      const parsed = parseAPIError(err);
      setActivitiesError(parsed);
      setTodayActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, [auth?.accessToken, api, dayName]);

  useEffect(() => {
    fetchTodayActivities();
  }, [fetchTodayActivities]);

  useEffect(() => {
    if (!auth?.accessToken) return;
    let cancelled = false;
    api('/api/v1/notifications?page=1&pageSize=10')
      .then((data) => {
        if (cancelled) return;
        const notifications = data.data || data.notifications || [];
        setAccountNotifications(
          notifications.filter((item) =>
            item?.category === 'account' ||
            item?.type === 'credentials' ||
            item?.notification_type === 'new_credentials'
          )
        );
      })
      .catch(() => {
        if (!cancelled) setAccountNotifications([]);
      });
    return () => { cancelled = true; };
  }, [auth?.accessToken, api]);

  if (profileLoading) return <SectionLoader message="Loading your dashboard..." />;
  if (profileError) return <SectionError message={profileError} />;
  if (!residentProfile) return <SectionLoader message="Loading your dashboard..." />;

  const firstName = (residentProfile.preferred_name || residentProfile.first_name || "Resident");
  const wellnessSummary = residentProfile.wellness_summary || residentProfile.wellnessSummary || "";
  const goals = residentProfile.goals || [];
  const upcomingAppointments = residentProfile.upcoming_appointments || residentProfile.upcomingAppointments || [];
  const intakeDays = residentProfile.intake_days ?? residentProfile.intakeDays ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Welcome banner */}
      <div
        style={{
          borderRadius: "12px",
          paddingLeft: "26px",
          paddingRight: "26px",
          paddingTop: "24px",
          paddingBottom: "24px",
          color: "white",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #2A1F3A 0%, #3D2E4D 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            pointerEvents: "none",
            background: `rgba(139, 111, 163, 0.08)`,
          }}
        />
        <div style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.45)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "6px",
        }}>
          {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>{greeting}, {firstName}</div>
        {wellnessSummary && (
          <div style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.65)",
            lineHeight: "1.65",
            maxWidth: "500px",
          }}>
            {wellnessSummary}
          </div>
        )}
      </div>

      {accountNotifications.length > 0 && (
        <Card style={{ borderColor: C.accent, background: C.accentSoft }}>
          <div style={{
            paddingLeft: "18px",
            paddingRight: "18px",
            paddingTop: "15px",
            paddingBottom: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: C.ink, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Account access
              </div>
              <div style={{ fontSize: "13px", color: C.text, marginTop: "5px", lineHeight: 1.55 }}>
                {accountNotifications[0].message || "Your resident portal account is ready. Please change your temporary password."}
              </div>
            </div>
            <a
              href={accountNotifications[0].action_url || "/auth/change-password-required"}
              style={{
                flexShrink: 0,
                background: C.accent,
                color: "white",
                borderRadius: "6px",
                paddingLeft: "13px",
                paddingRight: "13px",
                paddingTop: "8px",
                paddingBottom: "8px",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Change password
            </a>
          </div>
        </Card>
      )}

      {/* Quick stats */}
      <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[
          { label: "Days in Care",          value: intakeDays,                    sub: "Keep going",             accent: "#10b981" },
          { label: "Upcoming Appointments", value: upcomingAppointments.length,   sub: "This month",             accent: "#3b82f6" },
          { label: "Activities Today",      value: todayActivities.length,        sub: dayName,                  accent: "#8b5cf6" },
        ].map(s => (
          <Card key={s.label} style={{ borderTop: `3px solid ${s.accent}` }}>
            <div style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "14px", paddingBottom: "14px" }}>
              <div style={{
                fontSize: "10px",
                color: C.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "6px",
              }}>{s.label}</div>
              <div style={{ fontSize: "26px", fontWeight: 700, color: C.text }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>{s.sub}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
        {/* Today's activities */}
        <Card>
          <CardHead title="Today's Activities" sub={dayName} />
          <div style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "10px", paddingBottom: "10px" }}>
            {activitiesError && (
              <div style={{ marginBottom: "12px" }}>
                <ErrorNotification
                  title={activitiesError.title}
                  message={activitiesError.message}
                  onDismiss={() => setActivitiesError(null)}
                  onRetry={() => fetchTodayActivities()}
                  isDismissible
                />
              </div>
            )}
            {activitiesLoading ? (
              <SectionLoader />
            ) : todayActivities.length === 0 ? (
              <div style={{
                paddingTop: "20px",
                paddingBottom: "20px",
                textAlign: "center",
                color: C.textMuted,
                fontSize: "13px",
              }}>
                {activitiesError ? "Error loading activities" : "No scheduled groups today. Rest and recharge!"}
              </div>
            ) : todayActivities.map((a, i) => {
              const cs = CAT_COLORS[a.category] || CAT_FALLBACK;
              return (
                <div key={a.id || i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                  borderBottom: i < todayActivities.length - 1 ? `1px solid ${C.borderSoft}` : "none",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: C.textMuted,
                    width: "52px",
                    flexShrink: 0,
                  }}>{a.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: C.text }}>{a.name}</div>
                    <div style={{ fontSize: "11px", color: C.textMuted }}>{a.location}</div>
                  </div>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    paddingLeft: "7px",
                    paddingRight: "7px",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                    borderRadius: "4px",
                    border: `1px solid ${cs.border}`,
                    background: cs.bg,
                    color: cs.text,
                  }}>
                    {a.category}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardHead title="Upcoming Appointments" />
          <div style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "10px", paddingBottom: "10px" }}>
            {upcomingAppointments.length === 0 ? (
              <div style={{
                paddingTop: "20px",
                paddingBottom: "20px",
                textAlign: "center",
                color: C.textMuted,
                fontSize: "13px",
              }}>No upcoming appointments.</div>
            ) : upcomingAppointments.map((a, i) => (
              <div key={a.id || i} style={{
                paddingTop: "10px",
                paddingBottom: "10px",
                borderBottom: i < upcomingAppointments.length - 1 ? `1px solid ${C.borderSoft}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    background: "#CFFAFE",
                    color: "#0891b2",
                    border: "1px solid #06b6d4",
                    borderRadius: "4px",
                    paddingLeft: "7px",
                    paddingRight: "7px",
                    paddingTop: "1px",
                    paddingBottom: "1px",
                  }}>{a.type || a.appointment_type}</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: C.text, marginBottom: "2px" }}>{a.provider || a.provider_name}</div>
                <div style={{ fontSize: "11px", color: C.textMuted }}>{formatDate(a.date || a.appointment_date)} · {formatTime(a.time || a.appointment_time)}</div>
                {(a.transport || a.transport_notes) && (
                  <div style={{ fontSize: "11px", color: C.textMuted }}>{a.transport || a.transport_notes}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Wellness goals preview */}
      {goals.length > 0 && (
        <Card>
          <CardHead title="My Wellness Goals" sub="Your personal goals for this treatment period" />
          <div style={{
            paddingLeft: "18px",
            paddingRight: "18px",
            paddingTop: "14px",
            paddingBottom: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}>
            {goals.map((g, i) => {
              const progress = g.progress ?? g.progress_pct ?? 0;
              const area = g.area || g.goal_area || g.category || "";
              const text = g.text || g.goal_text || g.description || "";
              return (
                <div key={g.id || i}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}>
                    <div>
                      {area && <span style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: C.accent,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}>{area}</span>}
                      <div style={{ fontSize: "13px", color: C.text, marginTop: "4px" }}>{text}</div>
                    </div>
                    <span style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: C.accent,
                      flexShrink: 0,
                      marginLeft: "16px",
                    }}>{progress}%</span>
                  </div>
                  <ProgressBar value={progress} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function HealthView({ residentProfile, profileLoading, profileError }) {
  if (profileLoading) return <SectionLoader message="Loading health information..." />;
  if (profileError) return <SectionError message={profileError} />;
  if (!residentProfile) return <SectionLoader />;

  const wellnessSummary = residentProfile.wellness_summary || residentProfile.wellnessSummary || "";
  const goals = residentProfile.goals || [];
  const medications = residentProfile.medications || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>My Health</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Your health information, in plain language — just for you.</p>
      </div>

      {wellnessSummary && (
        <div
          style={{
            borderRadius: "10px",
            paddingLeft: "18px",
            paddingRight: "18px",
            paddingTop: "16px",
            paddingBottom: "16px",
            border: `1px solid ${C.border}`,
            background: `linear-gradient(135deg, ${C.accentSoft} 0%, ${C.accentSoft} 100%)`,
          }}
        >
          <div style={{
            fontSize: "11px",
            fontWeight: 700,
            color: C.accent,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "6px",
          }}>Your Care Team Says</div>
          <div style={{
            fontSize: "13px",
            color: C.text,
            lineHeight: "1.7",
          }}>{wellnessSummary}</div>
        </div>
      )}

      {goals.length > 0 && (
        <Card>
          <CardHead title="My Wellness Goals" sub="Progress toward goals set with your care team" />
          <div style={{
            paddingLeft: "18px",
            paddingRight: "18px",
            paddingTop: "14px",
            paddingBottom: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}>
            {goals.map((g, i) => {
              const progress = g.progress ?? g.progress_pct ?? 0;
              const area = g.area || g.goal_area || g.category || "";
              const text = g.text || g.goal_text || g.description || "";
              return (
                <div key={g.id || i}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "7px",
                  }}>
                    <div>
                      {area && <span style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: C.accent,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}>{area}</span>}
                      <div style={{
                        fontSize: "13px",
                        color: C.text,
                        marginTop: "4px",
                        lineHeight: "1.5",
                      }}>{text}</div>
                    </div>
                    <span style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: C.accent,
                      marginLeft: "20px",
                      flexShrink: 0,
                    }}>{progress}%</span>
                  </div>
                  <ProgressBar value={progress} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="My Medications" sub="Prescribed by your care team — ask if you have questions" />
        <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
          {medications.length === 0 ? (
            <div style={{
              paddingTop: "28px",
              paddingBottom: "28px",
              textAlign: "center",
              color: C.textMuted,
              fontSize: "13px",
            }}>No medications on record.</div>
          ) : medications.map((m, i) => {
            const name = m.name || m.medication_name || m.drug_name || "";
            const frequency = m.frequency || m.dosage_frequency || m.dosage || "";
            const purpose = m.purpose || m.indication || m.notes || "";
            return (
              <div key={m.id || i} style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                paddingLeft: "18px",
                paddingRight: "18px",
                paddingTop: "12px",
                paddingBottom: "12px",
                borderBottom: i < medications.length - 1 ? `1px solid ${C.borderSoft}` : "none",
              }}>
                <div style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  background: "#D1FAE5",
                  border: `1px solid ${C.success}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  flexShrink: 0,
                }}>
                  💊
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{name}</div>
                  {frequency && <div style={{ fontSize: "12px", color: C.textSoft, marginTop: "4px" }}>{frequency}</div>}
                  {purpose && <div style={{ fontSize: "11px", color: C.accent, marginTop: "4px", fontStyle: "italic" }}>{purpose}</div>}
                </div>
              </div>
            );
          })}
          <div style={{
            paddingLeft: "18px",
            paddingRight: "18px",
            paddingTop: "10px",
            paddingBottom: "10px",
            background: C.warningBg,
            borderTop: `1px solid ${C.warning}`,
          }}>
            <div style={{ fontSize: "11px", color: C.warning }}>
              Never stop or change your medication without talking to your care team first.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AppointmentsView({ residentProfile, profileLoading, profileError }) {
  if (profileLoading) return <SectionLoader message="Loading appointments..." />;
  if (profileError) return <SectionError message={profileError} />;
  if (!residentProfile) return <SectionLoader />;

  const upcomingAppointments = residentProfile.upcoming_appointments || residentProfile.upcomingAppointments || [];
  const pastAppointments = residentProfile.past_appointments || residentProfile.pastAppointments || [];

  const renderAppt = (a, i, arr) => (
    <div key={a.id || i} style={{
      paddingLeft: "18px",
      paddingRight: "18px",
      paddingTop: "14px",
      paddingBottom: "14px",
      borderBottom: i < arr.length - 1 ? `1px solid ${C.borderSoft}` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "9px",
          background: "#CFFAFE",
          border: "1px solid #06b6d4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          flexShrink: 0,
        }}>
          🏥
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{
              fontSize: "10px",
              fontWeight: 700,
              background: "#CFFAFE",
              color: "#0891b2",
              border: "1px solid #06b6d4",
              borderRadius: "4px",
              paddingLeft: "7px",
              paddingRight: "7px",
              paddingTop: "1px",
              paddingBottom: "1px",
            }}>{a.type || a.appointment_type}</span>
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{a.provider || a.provider_name}</div>
          {(a.facility || a.location) && <div style={{ fontSize: "12px", color: C.textSoft, marginTop: "4px" }}>{a.facility || a.location}</div>}
          <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
            <span style={{ fontSize: "12px", color: C.textMuted }}>📅 {formatDate(a.date || a.appointment_date)} at {formatTime(a.time || a.appointment_time)}</span>
            {(a.transport || a.transport_notes) && (
              <span style={{ fontSize: "12px", color: C.success }}>🚗 {a.transport || a.transport_notes}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>Appointments</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Your upcoming and past appointments.</p>
      </div>

      <Card>
        <CardHead title="Upcoming" />
        <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
          {upcomingAppointments.length === 0 ? (
            <div style={{
              paddingTop: "28px",
              paddingBottom: "28px",
              textAlign: "center",
              color: C.textMuted,
              fontSize: "13px",
            }}>No upcoming appointments scheduled.</div>
          ) : upcomingAppointments.map((a, i) => renderAppt(a, i, upcomingAppointments))}
        </div>
      </Card>

      {pastAppointments.length > 0 && (
        <Card>
          <CardHead title="Recent Appointments" />
          <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
            {pastAppointments.map((a, i) => (
              <div key={a.id || i} style={{
                paddingLeft: "18px",
                paddingRight: "18px",
                paddingTop: "12px",
                paddingBottom: "12px",
                borderBottom: i < pastAppointments.length - 1 ? `1px solid ${C.borderSoft}` : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{a.type || a.appointment_type} — {a.provider || a.provider_name}</div>
                    <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>{formatDate(a.date || a.appointment_date)} · {formatTime(a.time || a.appointment_time)}</div>
                    {(a.notes || a.outcome_notes) && <div style={{ fontSize: "12px", color: C.textSoft, marginTop: "4px", fontStyle: "italic" }}>{a.notes || a.outcome_notes}</div>}
                  </div>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    background: C.successBg,
                    color: C.success,
                    border: `1px solid ${C.success}`,
                    borderRadius: "4px",
                    paddingLeft: "8px",
                    paddingRight: "8px",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                  }}>Completed</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{
        background: C.successBg,
        border: `1px solid ${C.success}`,
        borderRadius: "10px",
        paddingLeft: "18px",
        paddingRight: "18px",
        paddingTop: "14px",
        paddingBottom: "14px",
      }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: C.success, marginBottom: "4px" }}>Need to schedule or change an appointment?</div>
        <div style={{ fontSize: "12px", color: C.success }}>Let any staff member know or submit a Request — we'll coordinate everything for you.</div>
      </div>
    </div>
  );
}

function ActivitiesView({ token }) {
  const [selectedDay, setSelectedDay] = useState("All");
  const [selectedCat, setSelectedCat] = useState("All");
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { auth } = useAuth();
  const api = useApi(auth);

  const fetchActivities = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/v1/activities?limit=200');
      setActivities((data.data || []).map(mapActivity));
    } catch (err) {
      const parsed = parseAPIError(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const categories = ["All", ...Array.from(new Set(activities.map(a => a.category)))];
  const filtered = activities.filter(a =>
    (selectedDay === "All" || a.day === selectedDay) &&
    (selectedCat === "All" || a.category === selectedCat)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>Activities</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Therapeutic groups, workshops, and community activities available to you each week.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["All", ...DAYS].map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              style={{
                paddingLeft: "12px",
                paddingRight: "12px",
                paddingTop: "6px",
                paddingBottom: "6px",
                borderRadius: "7px",
                border: selectedDay === d ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 130ms ease",
                background: selectedDay === d ? C.accentSoft : C.paper,
                color: selectedDay === d ? C.accent : C.textMuted,
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {categories.map(c => {
            const cs = CAT_COLORS[c] || CAT_FALLBACK;
            const isSelected = selectedCat === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCat(c)}
                style={{
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  borderRadius: "6px",
                  border: isSelected ? `1px solid ${cs.border}` : `1px solid ${C.border}`,
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 130ms ease",
                  background: isSelected ? cs.bg : C.paper,
                  color: isSelected ? cs.text : C.textMuted,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "16px" }}>
          <ErrorNotification
            title={error.title}
            message={error.message}
            onDismiss={() => setError(null)}
            onRetry={() => fetchActivities()}
            isDismissible
          />
        </div>
      )}

      {loading ? (
        <SectionLoader message="Loading activities..." />
      ) : filtered.length === 0 && !error ? (
        <div style={{
          paddingTop: "40px",
          paddingBottom: "40px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "13px",
        }}>
          No activities match your filter. Try selecting a different day or category.
        </div>
      ) : (
        <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {filtered.map((a, i) => {
            const cs = CAT_COLORS[a.category] || CAT_FALLBACK;
            return (
              <div
                key={a.id || i}
                style={{
                  background: C.paper,
                  borderRadius: "10px",
                  paddingLeft: "16px",
                  paddingRight: "16px",
                  paddingTop: "14px",
                  paddingBottom: "14px",
                  border: `1px solid ${cs.border}`,
                  borderTopWidth: "3px",
                  borderTopColor: cs.topHex,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: cs.topHex,
                  }}>{a.category}</span>
                  <span style={{ fontSize: "10px", color: C.textMuted }}>{a.day}</span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: C.text, marginBottom: "4px" }}>{a.name}</div>
                <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "6px" }}>📍 {a.location} · {a.time}</div>
                {a.desc && <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: "1.6" }}>{a.desc}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        background: "#CFFAFE",
        border: "1px solid #06b6d4",
        borderRadius: "10px",
        paddingLeft: "18px",
        paddingRight: "18px",
        paddingTop: "14px",
        paddingBottom: "14px",
      }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#0891b2", marginBottom: "4px" }}>Want to join a group or suggest a new activity?</div>
        <div style={{ fontSize: "12px", color: "#0891b2" }}>Talk to your counselor or use the Requests section — we love hearing from you.</div>
      </div>
    </div>
  );
}

function TeamView({ residentProfile, profileLoading, profileError }) {
  if (profileLoading) return <SectionLoader message="Loading care team..." />;
  if (profileError) return <SectionError message={profileError} />;
  if (!residentProfile) return <SectionLoader />;

  const team = residentProfile.team || residentProfile.care_team || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>My Care Team</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>The people dedicated to supporting your health and recovery journey.</p>
      </div>

      {team.length === 0 ? (
        <div style={{
          paddingTop: "40px",
          paddingBottom: "40px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "13px",
        }}>No care team members on record yet.</div>
      ) : (
        <div className="app-grid-collapse" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
          {team.map((m, i) => {
            const name = m.name || `${m.first_name || ""} ${m.last_name || ""}`.trim();
            const role = m.role || m.staff_role || m.title || "";
            const contact = m.contact || m.contact_info || m.email || "Contact via front desk";
            const emoji = m.emoji || "👤";
            return (
              <Card key={m.id || i}>
                <div style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "16px", paddingBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <div style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: C.accentSoft,
                      border: `1px solid ${C.accent}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "22px",
                      flexShrink: 0,
                    }}>
                      {emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{name}</div>
                      <div style={{ fontSize: "11px", color: C.accent, fontWeight: 600, marginTop: "4px" }}>{role}</div>
                    </div>
                  </div>
                  <div style={{
                    background: C.canvas,
                    borderRadius: "6px",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}>
                    <div style={{
                      fontSize: "10px",
                      color: C.textMuted,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "4px",
                    }}>How to reach</div>
                    <div style={{ fontSize: "12px", color: C.textSoft }}>{contact}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{
        background: C.successBg,
        border: `1px solid ${C.success}`,
        borderRadius: "10px",
        paddingLeft: "18px",
        paddingRight: "18px",
        paddingTop: "14px",
        paddingBottom: "14px",
      }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: C.success, marginBottom: "4px" }}>Your team is here for you</div>
        <div style={{
          fontSize: "12px",
          color: C.success,
          lineHeight: "1.65",
        }}>
          If you ever feel unsafe, need support, or just want to talk — please reach out to any staff member. We're available day and night. Your wellbeing is our priority.
        </div>
      </div>
    </div>
  );
}

function AnnouncementsView({ token }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { auth } = useAuth();
  const api = useApi(auth);

  const fetchAnnouncements = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/v1/announcements?limit=50');
      setAnnouncements((data.data || []).map(mapAnnouncement));
    } catch (err) {
      const parsed = parseAPIError(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>Announcements</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Updates, events, and information from the Dependable Care team.</p>
      </div>

      {error && (
        <div style={{ marginBottom: "16px" }}>
          <ErrorNotification
            title={error.title}
            message={error.message}
            onDismiss={() => setError(null)}
            onRetry={() => fetchAnnouncements()}
            isDismissible
          />
        </div>
      )}

      {loading ? (
        <SectionLoader message="Loading announcements..." />
      ) : announcements.length === 0 && !error ? (
        <div style={{
          paddingTop: "40px",
          paddingBottom: "40px",
          textAlign: "center",
          color: C.textMuted,
          fontSize: "13px",
        }}>No announcements at this time.</div>
      ) : (
        <Card>
          {announcements.map((a, i) => {
            const s = PRIO_STYLE[a.priority] || PRIO_STYLE.default;
            const urgent = a.priority === "urgent";
            const event = a.priority === "event";
            return (
              <div key={a.id} style={{
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
                paddingLeft: "18px",
                paddingRight: "18px",
                paddingTop: "14px",
                paddingBottom: "14px",
                borderLeft: `3px solid ${s.color}`,
                borderBottom: i < announcements.length - 1 ? `1px solid ${C.borderSoft}` : "none",
              }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: s.bg,
                  border: `1px solid ${s.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}>{s.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{a.title}</span>
                    {(urgent || event) && (
                      <span style={{ fontSize: "10px", fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}`, borderRadius: "9999px", padding: "1px 9px", letterSpacing: "0.04em" }}>
                        {urgent ? "URGENT" : "EVENT"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: C.textSoft, lineHeight: "1.6", marginBottom: "6px" }}>{a.message}</div>
                  <div style={{ fontSize: "11px", color: C.textMuted }}>Posted by {a.sender} · {a.date}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function RequestsView({ residentProfile, profileLoading, token }) {
  const [f, setF] = useState({ type: "", details: "", submitting: false, submitted: false, error: null });
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState(null);
  const { auth } = useAuth();
  const api = useApi(auth);

  const setField = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (residentProfile) {
      const profileRequests = residentProfile.requests || residentProfile.recent_requests || [];
      setRequests(profileRequests.map(mapRequest));
    }
  }, [residentProfile]);

  const refreshRequests = useCallback(async () => {
    if (!token) return;
    setReqLoading(true);
    setReqError(null);
    try {
      const data = await api('/api/v1/resident-requests?limit=25');
      setRequests((data.data || []).map(mapRequest));
    } catch (err) {
      const parsed = parseAPIError(err);
      setReqError(parsed);
    } finally {
      setReqLoading(false);
    }
  }, [token, api]);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  const handleSubmit = async () => {
    if (!f.type || f.details.trim().length < 5) return;
    setField("submitting", true);
    setField("error", null);
    try {
      const res = await fetch('/api/v1/resident-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request_type: f.type, details: f.details }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new APIError(data.error || `Request failed (${res.status})`, res.status);
      }
      setF({ type: "", details: "", submitting: false, submitted: true, error: null });
      refreshRequests();
    } catch (err) {
      const parsed = parseAPIError(err);
      setField("error", parsed.message || "Failed to submit request.");
      setField("submitting", false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: C.text, margin: 0, marginBottom: "4px" }}>Requests</h3>
        <p style={{ fontSize: "13px", color: C.textMuted, margin: 0 }}>Submit requests to your care team — we're here to help.</p>
      </div>

      {!profileLoading && (
        <Card>
          <CardHead title="Your Previous Requests" />
          <div style={{ paddingTop: "6px", paddingBottom: "6px" }}>
            {reqError && (
              <div style={{ paddingLeft: "18px", paddingRight: "18px", paddingTop: "12px", paddingBottom: "12px" }}>
                <ErrorNotification
                  title={reqError.title}
                  message={reqError.message}
                  onDismiss={() => setReqError(null)}
                  onRetry={() => refreshRequests()}
                  isDismissible
                />
              </div>
            )}
            {reqLoading ? (
              <SectionLoader />
            ) : requests.length === 0 && !reqError ? (
              <div style={{
                paddingTop: "28px",
                paddingBottom: "28px",
                textAlign: "center",
                color: C.textMuted,
                fontSize: "13px",
              }}>No requests submitted yet.</div>
            ) : requests.map((r, i) => {
              const s = REQUEST_STATUS_STYLE[r.status] || REQUEST_STATUS_STYLE.pending;
              return (
                <div key={r.id} style={{
                  paddingLeft: "18px",
                  paddingRight: "18px",
                  paddingTop: "11px",
                  paddingBottom: "11px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: i < requests.length - 1 ? `1px solid ${C.borderSoft}` : "none",
                }}>
                  <div>
                    <div style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: C.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "4px",
                    }}>{r.type}</div>
                    <div style={{ fontSize: "13px", color: C.text }}>{r.details}</div>
                    <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>{r.date}</div>
                  </div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    paddingLeft: "10px",
                    paddingRight: "10px",
                    paddingTop: "3px",
                    paddingBottom: "3px",
                    borderRadius: "12px",
                    border: `1px solid ${s.color}`,
                    background: s.bg,
                    color: s.color,
                    flexShrink: 0,
                  }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Submit a New Request" sub="We'll respond as soon as possible" />
        <div style={{ paddingLeft: "18px", paddingRight: "18px", paddingTop: "18px", paddingBottom: "18px" }}>
          {f.submitted ? (
            <div style={{
              background: C.successBg,
              border: `1px solid ${C.success}`,
              borderRadius: "8px",
              paddingLeft: "18px",
              paddingRight: "18px",
              paddingTop: "18px",
              paddingBottom: "18px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>✅</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: C.success, marginBottom: "4px" }}>Request Submitted!</div>
              <div style={{ fontSize: "13px", color: C.success }}>Your care team will follow up with you soon. Thank you!</div>
              <button
                onClick={() => setF({ type: "", details: "", submitting: false, submitted: false, error: null })}
                style={{
                  marginTop: "14px",
                  background: C.accent,
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  paddingLeft: "18px",
                  paddingRight: "18px",
                  paddingTop: "7px",
                  paddingBottom: "7px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Submit Another
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {f.error && (
                <div style={{
                  background: C.dangerBg,
                  border: `1px solid ${C.danger}`,
                  borderRadius: "8px",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                  fontSize: "12px",
                  color: C.danger,
                }}>
                  {f.error}
                </div>
              )}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: C.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "6px",
                }}>Type of Request *</label>
                <select
                  value={f.type}
                  onChange={e => setField("type", e.target.value)}
                  style={{
                    width: "100%",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    paddingTop: "9px",
                    paddingBottom: "9px",
                    border: `1px solid ${C.border}`,
                    borderRadius: "7px",
                    fontSize: "13px",
                    outline: "none",
                    background: C.paper,
                    color: C.text,
                  }}
                >
                  <option value="">— Choose one —</option>
                  {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: C.text,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "6px",
                }}>Details *</label>
                <textarea
                  value={f.details}
                  onChange={e => setField("details", e.target.value)}
                  placeholder="Describe your request here. Be as specific as you like — there are no wrong answers."
                  rows={4}
                  style={{
                    width: "100%",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    paddingTop: "9px",
                    paddingBottom: "9px",
                    border: `1px solid ${C.border}`,
                    borderRadius: "7px",
                    fontSize: "13px",
                    outline: "none",
                    resize: "vertical",
                    lineHeight: "1.65",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                disabled={!f.type || f.details.trim().length < 5 || f.submitting}
                onClick={handleSubmit}
                style={{
                  borderRadius: "7px",
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  transition: "all 150ms ease",
                  border: "none",
                  background: (f.type && f.details.trim().length >= 5 && !f.submitting) ? C.accent : C.borderSoft,
                  color: (f.type && f.details.trim().length >= 5 && !f.submitting) ? "white" : C.textMuted,
                  cursor: (f.type && f.details.trim().length >= 5 && !f.submitting) ? "pointer" : "not-allowed",
                }}
              >
                {f.submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN RESIDENT PORTAL ─────────────────────────────────────────────────────
export default function ResidentPortal() {
  const { auth } = useAuth();
  const isMobile = useIsMobile(768);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection,    setActiveSection]    = useState("home");
  const [activeResidentId, setActiveResidentId] = useState(null);
  const [residents,        setResidents]        = useState([]);
  const [residentsLoading, setResidentsLoading] = useState(true);

  const [residentProfile,  setResidentProfile]  = useState(null);
  const [profileLoading,   setProfileLoading]   = useState(false);
  const [profileError,     setProfileError]     = useState(null);

  const token = auth?.accessToken;

  useEffect(() => {
    if (!token) return;
    const fetchResidents = async () => {
      setResidentsLoading(true);
      try {
        if (auth?.user?.role === 'resident_care_of') {
          const myId = auth.user.residentId;
          if (myId) {
            setResidents([{ id: myId, name: `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim() }]);
            setActiveResidentId(myId);
          }
          return;
        }

        const res = await fetch('/api/v1/residents', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const residentList = data.data || data.residents || [];
          setResidents(residentList);
          if (residentList.length > 0 && !activeResidentId) {
            setActiveResidentId(residentList[0].id);
          }
        }
      } catch (err) {
      } finally {
        setResidentsLoading(false);
      }
    };
    fetchResidents();
  }, [token, auth?.user?.role, auth?.user?.residentId]);

  useEffect(() => {
    if (!token || !activeResidentId) return;
    const fetchProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`/api/v1/residents/${activeResidentId}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errText = await res.text();
          let msg = errText;
          try { msg = JSON.parse(errText).error || errText; } catch {}
          throw new Error(msg);
        }
        const { data } = await res.json();
        setResidentProfile(data);
      } catch (err) {
        setProfileError(err.message || "Failed to load resident profile.");
        setResidentProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [token, activeResidentId]);

  const residentBasic = residents.find(r => r.id === activeResidentId) || residents[0] || null;
  const residentForNav = residentProfile
    ? { ...residentBasic, ...residentProfile }
    : residentBasic;

  const renderSection = () => {
    const sharedProfileProps = { residentProfile, profileLoading, profileError };
    switch (activeSection) {
      case "home":          return <HomeView {...sharedProfileProps} />;
      case "health":        return <HealthView {...sharedProfileProps} />;
      case "appointments":  return <AppointmentsView {...sharedProfileProps} />;
      case "activities":    return <ActivitiesView token={token} />;
      case "team":          return <TeamView {...sharedProfileProps} />;
      case "announcements": return <AnnouncementsView token={token} />;
      case "requests":      return <RequestsView {...sharedProfileProps} token={token} />;
      default:              return <HomeView {...sharedProfileProps} />;
    }
  };

  if (residentsLoading) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        background: C.canvas,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Geist Sans','Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{ color: C.textMuted }}>Loading resident data...</div>
      </div>
    );
  }

  if (!residentForNav) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        background: C.canvas,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Geist Sans','Segoe UI',system-ui,sans-serif",
      }}>
        <div style={{ color: C.textMuted }}>No resident account found.</div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: C.canvas,
      overflow: "hidden",
      fontFamily: "'Geist Sans','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Sidebar: inline column on desktop, off-canvas drawer on mobile */}
      {isMobile ? (
        <>
          {mobileNavOpen && (
            <div
              onClick={() => setMobileNavOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(10,8,18,0.5)", zIndex: 40 }}
            />
          )}
          <div
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
              display: "flex",
              transform: mobileNavOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.25s ease",
            }}
          >
            <ResidentSideNav
              activeSection={activeSection}
              resident={residentForNav}
              onNavigate={id => { setActiveSection(id); setMobileNavOpen(false); }}
              activeResidentId={activeResidentId}
              residents={residents}
              onResidentChange={id => { setActiveResidentId(id); setActiveSection("home"); setMobileNavOpen(false); }}
            />
          </div>
        </>
      ) : (
        <ResidentSideNav
          activeSection={activeSection}
          resident={residentForNav}
          onNavigate={setActiveSection}
          activeResidentId={activeResidentId}
          residents={residents}
          onResidentChange={id => { setActiveResidentId(id); setActiveSection("home"); }}
        />
      )}
      <div className="app-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ResidentTopNav
          activeSection={activeSection}
          resident={residentForNav}
          notificationCount={0}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "16px" : "24px",
        }}>
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
