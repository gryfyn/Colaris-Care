import Link from 'next/link';
import Image from 'next/image';
import {
  Activity, Bell, Building2, CalendarDays, ChevronDown, CircleAlert,
  ClipboardCheck, FileBarChart, HelpCircle, Search, Settings,
  ShieldCheck, Sparkles, Users, UserCog, ClipboardList, FileText, Scroll,
  Pill, NotebookPen, AlertTriangle, Trash2, DoorOpen, FolderKanban, Inbox,
  Megaphone, Calendar, KeyRound,
} from 'lucide-react';
import styles from './page.module.css';

export const metadata = {
  title: 'Dependable Care Dashboard',
  description: 'A mock-data preview of the next-generation Dependable Care administration dashboard.',
};

function FourWindows({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.4" fill="currentColor" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" fill="currentColor" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" fill="currentColor" />
      <rect x="14" y="14" width="7" height="7" rx="1.4" fill="currentColor" />
    </svg>
  );
}

const NAV_GROUPS = [
  { section: 'Facility', items: [
    { label: 'Dashboard', Icon: FourWindows, active: true },
    { label: 'Residents', Icon: Users },
    { label: 'Staff Directory', Icon: UserCog },
  ]},
  { section: 'Admissions', items: [
    { label: 'Pre-Screening', Icon: ClipboardCheck },
    { label: 'Pending Admissions', Icon: ClipboardList },
  ]},
  { section: 'Clinical', items: [
    { label: 'Face Sheets', Icon: FileText },
    { label: 'Care Plans', Icon: Scroll },
    { label: 'Appointments', Icon: CalendarDays },
    { label: 'Medications', Icon: Pill },
    { label: 'Progress Notes', Icon: NotebookPen },
    { label: 'Incident Reports', Icon: AlertTriangle },
    { label: 'Drug Disposal', Icon: Trash2 },
    { label: 'Evacuation Drills', Icon: DoorOpen },
    { label: 'Reports Hub', Icon: FolderKanban },
  ]},
  { section: 'Resident Engagement', items: [
    { label: 'Resident Requests', Icon: Inbox },
    { label: 'Weekly Activities', Icon: Sparkles },
  ]},
  { section: 'Communications', items: [
    { label: 'Announcements', Icon: Megaphone },
    { label: 'Calendar', Icon: Calendar },
    { label: 'Notifications', Icon: Bell },
  ]},
  { section: 'Administration', items: [
    { label: 'Account Management', Icon: KeyRound },
  ]},
];

const METRICS = [
  { label: 'Active residents', value: '128', detail: '5 new this month', trend: '+4.1%', Icon: Users },
  { label: 'Care tasks complete', value: '94.6%', detail: '684 tasks this month', trend: '+2.8%', Icon: ClipboardCheck },
  { label: 'Medication adherence', value: '98.2%', detail: '3 exceptions today', trend: '+0.7%', Icon: Activity },
  { label: 'Compliance readiness', value: '92%', detail: '8 items need review', trend: '+5.3%', Icon: ShieldCheck },
];

const ACTIVITY = [
  { title: 'Care plan approved', meta: 'Sarah M. · 8 min ago', tone: 'green' },
  { title: 'Medication variance reviewed', meta: 'Michael R. · 24 min ago', tone: 'amber' },
  { title: 'New resident admitted', meta: 'Admissions team · 41 min ago', tone: 'teal' },
  { title: 'Staff certification renewed', meta: 'Dana K. · 1 hr ago', tone: 'blue' },
];

const ALERTS = [
  { label: 'Care plans awaiting signature', count: 8, level: 'Due today' },
  { label: 'Credentials expiring soon', count: 6, level: 'Next 30 days' },
  { label: 'Incident reviews open', count: 4, level: 'Needs attention' },
];

export default function AdminV2Dashboard() {
  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin-v2" aria-label="Dependable Care dashboard">
          <span className={styles.brandMark}><Image src="/logo.png" alt="" width={42} height={42} priority /></span>
          <span className={styles.brandCopy}><strong>Dependable Care</strong><small>Colaris Care</small></span>
        </Link>

        <nav className={styles.navigation} aria-label="Administration">
          {NAV_GROUPS.map(({ section, items }) => (
            <div className={styles.navGroup} key={section}>
              <span className={styles.navLabel}>{section}</span>
              {items.map(({ label, Icon, active }) => (
                <button className={active ? styles.navItemActive : styles.navItem} key={label} type="button" aria-current={active ? 'page' : undefined}>
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          <button type="button"><HelpCircle size={18} /><span>Help center</span></button>
          <button type="button"><Settings size={18} /><span>Settings</span></button>
          <div className={styles.account}>
            <span className={styles.avatar}>SM</span>
            <span><strong>Sarah Mitchell</strong><small>Facility administrator</small></span>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Link className={styles.mobileBrand} href="/admin-v2"><Image src="/logo.png" alt="" width={30} height={30} /><strong>Dependable Care</strong></Link>
          <button className={styles.scope} type="button"><Building2 size={16} /><span>Dependable Care</span><ChevronDown size={14} /></button>
          <div className={styles.topActions}>
            <label className={styles.search}><Search size={17} /><input aria-label="Search dashboard" placeholder="Search residents, staff, reports…" /></label>
            <button className={styles.iconButton} type="button" aria-label="Notifications"><Bell size={18} /><i /></button>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHead}>
            <div>
              <div className={styles.kicker}><span>Mock data</span> Dependable Care overview</div>
              <h1>Good morning, Sarah.</h1>
              <p>Here is what is happening across your facility today.</p>
            </div>
            <button className={styles.dateButton} type="button"><CalendarDays size={16} /> June 20, 2026 <ChevronDown size={14} /></button>
          </section>

          <section className={styles.metricGrid} aria-label="Key performance indicators">
            {METRICS.map(({ label, value, detail, trend, Icon }) => (
              <article className={styles.metricCard} key={label}>
                <div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={18} /></span><span className={styles.trend}>{trend}</span></div>
                <p>{label}</p><strong>{value}</strong><small>{detail}</small>
              </article>
            ))}
          </section>

          <section className={styles.analyticsGrid}>
            <article className={`${styles.panel} ${styles.performancePanel}`}>
              <div className={styles.panelHead}>
                <div><span className={styles.panelEyebrow}>Care performance</span><h2>Quality trend</h2></div>
                <div className={styles.legend}><span><i className={styles.tealDot} />Care completion</span><span><i className={styles.grayDot} />Network target</span></div>
              </div>
              <div className={styles.chartSummary}><strong>94.6%</strong><span><b>+6.4%</b> over the last 6 months</span></div>
              <div className={styles.lineChart}>
                <div className={styles.yLabels}><span>100</span><span>90</span><span>80</span><span>70</span></div>
                <svg viewBox="0 0 720 210" role="img" aria-label="Care completion increased from 84 to 95 percent over six months">
                  <defs><linearGradient id="careArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity=".24" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
                  <g className={styles.gridLines}><line x1="0" y1="20" x2="720" y2="20" /><line x1="0" y1="75" x2="720" y2="75" /><line x1="0" y1="130" x2="720" y2="130" /><line x1="0" y1="185" x2="720" y2="185" /></g>
                  <path className={styles.targetLine} d="M0 84 L720 84" />
                  <path className={styles.area} d="M0 151 C70 147 100 134 144 129 S245 118 288 107 S390 112 432 90 S530 71 576 65 S670 47 720 42 L720 210 L0 210 Z" />
                  <path className={styles.chartLine} d="M0 151 C70 147 100 134 144 129 S245 118 288 107 S390 112 432 90 S530 71 576 65 S670 47 720 42" />
                  {[['0','151'],['144','129'],['288','107'],['432','90'],['576','65'],['720','42']].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="4.5" />)}
                </svg>
                <div className={styles.xLabels}><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div>
              </div>
            </article>

            <article className={`${styles.panel} ${styles.mixPanel}`}>
              <div className={styles.panelHead}><div><span className={styles.panelEyebrow}>Care mix</span><h2>Resident acuity</h2></div><button type="button" className={styles.moreButton}>•••</button></div>
              <div className={styles.donutWrap}>
                <div className={styles.donut}><span><strong>128</strong><small>Residents</small></span></div>
                <ul className={styles.mixLegend}>
                  <li><i className={styles.mixIndependent} /><span>Independent</span><strong>48%</strong></li>
                  <li><i className={styles.mixSupported} /><span>Supported</span><strong>34%</strong></li>
                  <li><i className={styles.mixComplex} /><span>Complex care</span><strong>18%</strong></li>
                </ul>
              </div>
              <div className={styles.insight}><Sparkles size={16} /><p><strong>Capacity insight</strong><span>Supported care demand is up 6% this quarter.</span></p></div>
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHead}><div><span className={styles.panelEyebrow}>Action center</span><h2>Needs attention</h2></div><button className={styles.textButton} type="button">View all</button></div>
              <div className={styles.alertList}>
                {ALERTS.map(({ label, count, level }, index) => (
                  <div className={styles.alertRow} key={label}><span className={index === 2 ? styles.alertIconRed : styles.alertIcon}><CircleAlert size={17} /></span><p><strong>{label}</strong><small>{level}</small></p><b>{count}</b></div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}><div><span className={styles.panelEyebrow}>Facility activity</span><h2>Recent activity</h2></div><button className={styles.textButton} type="button">Open feed</button></div>
              <div className={styles.activityList}>
                {ACTIVITY.map(({ title, meta, tone }) => <div className={styles.activityRow} key={title}><i data-tone={tone} /><p><strong>{title}</strong><small>{meta}</small></p></div>)}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
