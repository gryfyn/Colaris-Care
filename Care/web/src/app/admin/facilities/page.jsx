"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Plus, ShieldCheck, UserPlus, UserX } from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Panel } from "@/components/ui/data";
import { addMember, fetchFacilities, fetchMembers, fetchOrgMembers, removeMember } from "@/lib/facilities-client";
import AddFacilityModal from "@/components/app/AddFacilityModal";

const ROLE_TONES = { admin: "green", manager: "amber", staff: "blue", resident_care_of: "gray" };

export default function FacilitiesAdminPage() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addUser, setAddUser] = useState("");
  const [addRole, setAddRole] = useState("manager");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [addingHome, setAddingHome] = useState(false);

  const loadHomes = useCallback(async () => {
    const d = await fetchFacilities().catch(() => null);
    setData(d);
    setSelected((cur) => cur || d?.currentFacilityId || d?.facilities?.[0]?.id || "");
  }, []);

  useEffect(() => { loadHomes(); }, [loadHomes]);

  const loadMembers = useCallback(async (facilityId) => {
    if (!facilityId) return;
    setLoading(true);
    const [m, o] = await Promise.all([fetchMembers(facilityId).catch(() => []), fetchOrgMembers().catch(() => [])]);
    setMembers(Array.isArray(m) ? m : []);
    setOrgUsers(Array.isArray(o) ? o : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (selected) loadMembers(selected); }, [selected, loadMembers]);

  const homes = data?.facilities || [];
  const selectedHome = homes.find((h) => h.id === selected);

  // Org users who aren't already active members of the selected home.
  const candidates = useMemo(() => {
    const activeIds = new Set(members.filter((m) => m.status === "active").map((m) => m.userId));
    return orgUsers.filter((u) => !activeIds.has(u.userId));
  }, [orgUsers, members]);

  async function onAdd() {
    if (!addUser) return setError("Select a person to add.");
    setBusy(true); setError(""); setNotice("");
    try {
      await addMember(selected, addUser, addRole);
      const u = orgUsers.find((x) => x.userId === addUser);
      setNotice(`${u?.name || "User"} added to ${selectedHome?.name || "home"} as ${addRole}.`);
      setAddUser("");
      await loadMembers(selected);
    } catch (err) {
      setError(err.message || "Could not add member.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(m) {
    setBusy(true); setError(""); setNotice("");
    try {
      await removeMember(selected, m.userId);
      setNotice(`${m.name} removed from ${selectedHome?.name || "home"}.`);
      await loadMembers(selected);
    } catch (err) {
      setError(err.message || "Could not remove member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cx-wide">
      <PageHeader
        eyebrow="Facilities"
        title="Homes & members"
        lede="Manage who has access to each home. Add an existing user (e.g. a manager) to another home, or remove access."
        action={data?.canAdd ? <button type="button" className="cx-btn cx-btn-primary" onClick={() => setAddingHome(true)}><Plus size={15} /> Add a home</button> : null}
      />

      <Panel title="Home" pad>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Building2 size={18} style={{ color: "var(--cx-faint)" }} />
          <select className="cx-select" value={selected} onChange={(e) => setSelected(e.target.value)} style={{ minWidth: 240 }}>
            {homes.map((h) => <option key={h.id} value={h.id}>{h.name}{h.current ? " (current)" : ""}</option>)}
          </select>
          {selectedHome && <Badge tone={ROLE_TONES[selectedHome.role]}>You are {selectedHome.role}</Badge>}
        </div>
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title="Add a member">
        <div style={{ padding: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px", minWidth: 220 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Person</label>
            <select className="cx-select" value={addUser} onChange={(e) => setAddUser(e.target.value)} style={{ width: "100%" }}>
              <option value="">Select a person…</option>
              {candidates.map((u) => <option key={u.userId} value={u.userId}>{u.name} — {u.email} ({u.homes} home{u.homes === 1 ? "" : "s"})</option>)}
            </select>
          </div>
          <div style={{ flex: "0 0 160px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--cx-ink)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</label>
            <select className="cx-select" value={addRole} onChange={(e) => setAddRole(e.target.value)} style={{ width: "100%" }}>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button type="button" className="cx-btn cx-btn-primary" disabled={busy || !addUser} onClick={onAdd}>
            {busy ? <><Loader2 size={15} className="cx-spin" /> Adding...</> : <><UserPlus size={15} /> Add to home</>}
          </button>
        </div>
        {candidates.length === 0 && !loading && <div className="cx-settings-help" style={{ padding: "0 18px 16px" }}>Everyone in your organization is already a member of this home. Create staff/logins first, or switch homes.</div>}
        {(notice || error) && <div style={{ margin: "0 18px 16px", padding: "10px 14px", borderRadius: 8, fontSize: 13, ...(error ? { color: "#b42318", background: "#fef2f2", border: "1px solid #fecaca" } : { color: "#047857", background: "#ecfdf5", border: "1px solid #6ee7b7" }) }}>{error || notice}</div>}
      </Panel>

      <div style={{ height: 16 }} />

      <Panel title={`Members${selectedHome ? " — " + selectedHome.name : ""}`}>
        <div className="cx-tablewrap" style={{ border: "none" }}>
          {loading ? (
            <EmptyState icon={ShieldCheck} title="Loading members..." />
          ) : members.length ? (
            <div className="cx-tblscroll">
              <table className="cx-tbl">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId}>
                      <td><div className="cx-cellname"><Avatar name={m.name} sm round /><b>{m.name}</b>{m.isSelf && <span className="cx-cellsub"> (you)</span>}</div></td>
                      <td className="cx-cellsub">{m.email}</td>
                      <td><Badge tone={ROLE_TONES[m.role]}>{m.role}</Badge></td>
                      <td><Badge tone={m.status === "active" ? "green" : "gray"} dot>{m.status}</Badge></td>
                      <td style={{ textAlign: "right" }}>
                        {m.status === "active" && !m.isSelf && (
                          <button type="button" className="cx-btn cx-btn-quiet cx-btn-compact" disabled={busy} onClick={() => onRemove(m)}><UserX size={13} /> Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} title="No members" note="Add a member above." />
          )}
        </div>
      </Panel>

      {addingHome && <AddFacilityModal onClose={() => setAddingHome(false)} onCreated={() => { setAddingHome(false); loadHomes(); }} />}
    </div>
  );
}
