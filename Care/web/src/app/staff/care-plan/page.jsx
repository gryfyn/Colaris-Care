"use client";

import { useMemo, useState } from "react";
import {
  Check, CheckCircle2, ClipboardList, ListTodo, ShieldCheck, Target,
} from "lucide-react";
import { Avatar, Badge, PageHeader, Panel, StatCard } from "@/components/ui/data";

const ORG = "org-maple-health-partners";
const FACILITY_ID = "facility-maple-grove-care";
const SCOPE = { organizationId: ORG, facilityId: FACILITY_ID };

const INITIAL_GOALS = [
  {
    id: 1, resident: "Eleanor Whitfield", room: "W-104",
    goal: "Maintain independence with daily routines",
    task: "Provide standby assist during morning routine", due: "By 9:00a", done: false, priority: "Routine",
  },
  {
    id: 2, resident: "Marcus Bell", room: "M-210",
    goal: "Support a consistent, familiar daily routine",
    task: "Accompany to music group and note participation", due: "By 11:00a", done: true, priority: "Routine",
  },
  {
    id: 3, resident: "Rosa Iniguez", room: "N-118",
    goal: "Support comfort and mobility",
    task: "Assist with scheduled afternoon mobility activity", due: "By 3:00p", done: false, priority: "Follow-up",
  },
  {
    id: 4, resident: "Grace Tan", room: "W-106",
    goal: "Encourage social connection and independent choices",
    task: "Invite to garden group; respect independent preferences", due: "By 2:00p", done: false, priority: "Routine",
  },
  {
    id: 5, resident: "Lillian Park", room: "N-120",
    goal: "Support participation in preferred routines",
    task: "Encourage attendance at reading group", due: "By 3:30p", done: false, priority: "Routine",
  },
  {
    id: 6, resident: "Albert Reyes", room: "M-205",
    goal: "Reduce confusion with familiar routines",
    task: "Provide short hallway walk with familiar staff", due: "By 4:00p", done: true, priority: "Routine",
  },
].map((record) => ({ ...SCOPE, ...record }));

const PRIORITY_TONE = { Routine: "green", "Follow-up": "amber" };

export default function StaffCarePlanPage() {
  const [goals, setGoals] = useState(INITIAL_GOALS);

  const summary = useMemo(() => {
    const done = goals.filter((goal) => goal.done).length;
    return { done, open: goals.length - done, progress: Math.round((done / goals.length) * 100) };
  }, [goals]);

  const toggle = (id) => setGoals((current) => current.map((goal) => goal.id === id ? { ...goal, done: !goal.done } : goal));

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Assigned care"
        title="My care plan tasks"
        lede="Care goals and tasks assigned to you this shift. High-level summaries only — full care plans are maintained by the care team."
      />

      <div className="cx-stats">
        <StatCard icon={Target} label="Assigned goals" value={goals.length} />
        <StatCard icon={CheckCircle2} label="Completed" value={summary.done} delta={`${summary.progress}% done`} deltaDir="up" />
        <StatCard icon={ListTodo} label="Open tasks" value={summary.open} delta="this shift" deltaDir="up" />
        <StatCard icon={ClipboardList} label="Follow-ups" value={goals.filter((goal) => goal.priority === "Follow-up").length} />
      </div>

      <Panel
        title="Care goals & tasks"
        action={<span style={{ fontSize: 12.5, color: "var(--cx-muted)" }}>{summary.done}/{goals.length} complete</span>}
      >
        <div style={{ padding: "12px 18px 4px" }}>
          <div
            role="progressbar"
            aria-label="Care tasks completed"
            aria-valuemin={0}
            aria-valuemax={goals.length}
            aria-valuenow={summary.done}
            style={{ height: 8, borderRadius: 6, background: "var(--cx-paper-2)", overflow: "hidden" }}
          >
            <div style={{ height: "100%", width: `${summary.progress}%`, background: "var(--cx-accent)", transition: "width .25s" }} />
          </div>
        </div>

        <div className="cx-feed" style={{ paddingTop: 6 }}>
          {goals.map((goal) => (
            <div className="cx-feed-item" key={goal.id} style={{ alignItems: "flex-start" }}>
              <button
                type="button"
                onClick={() => toggle(goal.id)}
                aria-pressed={goal.done}
                aria-label={`${goal.done ? "Reopen" : "Mark complete"}: ${goal.task} for ${goal.resident}`}
                style={{
                  width: 26, height: 26, borderRadius: 8, flex: "0 0 auto", cursor: "pointer",
                  display: "grid", placeItems: "center", marginTop: 2,
                  border: goal.done ? "none" : "1.5px solid var(--cx-border)",
                  background: goal.done ? "var(--cx-accent)" : "var(--cx-paper)", color: "#fff",
                }}
              >
                {goal.done && <Check size={15} strokeWidth={3} />}
              </button>

              <Avatar name={goal.resident} sm />
              <div className="cx-feed-main" style={{ flex: 1 }}>
                <div className="cx-feed-t" style={{ color: goal.done ? "var(--cx-faint)" : "var(--cx-ink)" }}>
                  {goal.task}
                </div>
                <div className="cx-feed-s">
                  {goal.resident} · Room {goal.room} · Goal: {goal.goal}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <Badge tone={PRIORITY_TONE[goal.priority]} dot>{goal.priority}</Badge>
                <span className="cx-feed-time">{goal.due}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="cx-mt" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cx-faint)", fontSize: 12 }}>
        <ShieldCheck size={14} color="var(--cx-accent)" />
        Sample assignments — high-level goals only, no detailed clinical care plan content.
      </div>
    </div>
  );
}
