"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { usePrefs, NAV_GROUPS, THEMES } from "./prefs";

export default function Onboarding() {
  const { prefs, mounted, setTheme: applyTheme, finishOnboarding } = usePrefs();
  const [theme, setTheme] = useState("spruce");
  const [sidebar, setSidebar] = useState(() => {
    const s = {};
    NAV_GROUPS.flatMap((g) => g.items).forEach((i) => { s[i.id] = true; });
    return s;
  });

  if (!mounted || prefs.onboarded) return null;

  const toggle = (id) => setSidebar((s) => ({ ...s, [id]: !s[id] }));
  const selectTheme = (id) => {
    setTheme(id);
    applyTheme(id);
  };

  return (
    <div className="cx-ob-backdrop">
      <div className="cx-ob" role="dialog" aria-modal="true" aria-label="Set up your workspace">
        <div className="cx-ob-head">
          <div className="cx-brand-mark">C</div>
          <h2>Set up your workspace</h2>
          <p>Pick a look and choose which sections your team needs. You can change any of this
            later in Settings — nothing here is permanent.</p>
        </div>

        <div className="cx-ob-body">
          <div className="cx-ob-sec">Theme</div>
          {[{ label: "Light", dark: false }, { label: "Dark", dark: true }].map((group) => (
            <div className="cx-theme-group" key={group.label}>
              <div className="cx-theme-group-label">{group.label}</div>
              <div className="cx-swatches">
                {THEMES.filter((t) => Boolean(t.dark) === group.dark).map((t) => (
                  <button key={t.id} className="cx-swatch" data-on={theme === t.id ? "true" : "false"}
                    onClick={() => selectTheme(t.id)} aria-pressed={theme === t.id}>
                    <div className="cx-swatch-prev" style={{ background: t.swatch[0] }}>
                      <span className="cx-swatch-dot" style={{ background: t.swatch[1] }} />
                    </div>
                    <div className="cx-swatch-lbl">
                      {t.label}
                      {theme === t.id && <Check size={13} className="cx-swatch-check" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="cx-ob-sec">Sidebar sections</div>
          <div className="cx-picklist">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const on = sidebar[item.id];
              return (
                <div key={item.id} className="cx-pick" data-on={on ? "true" : "false"}>
                  <span className="cx-pick-ico"><Icon size={15} /></span>
                  <span className="cx-pick-lbl">{item.label}</span>
                  <button className="cx-switch" data-on={on ? "true" : "false"}
                    onClick={() => toggle(item.id)} aria-pressed={on} aria-label={`Toggle ${item.label}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="cx-ob-foot">
          <span className="cx-ob-step">Settings is always available.</span>
          <span style={{ marginLeft: "auto" }} />
          <button className="cx-btn cx-btn-primary" onClick={() => finishOnboarding({ theme, sidebar })}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
