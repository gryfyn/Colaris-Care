import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, BellRing, Building2, CalendarCheck, Check, CheckCircle2, ClipboardCheck, FileCheck2, LockKeyhole, Pill, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
import styles from "./page.module.css";

const capabilities = [
  { icon: Users, title: "Resident records", body: "Keep profiles, face sheets, care plans, and assigned teams connected in one reliable workspace." },
  { icon: Pill, title: "Medication workflows", body: "Manage prescriptions, administration queues, exceptions, and review history with clear accountability." },
  { icon: ClipboardCheck, title: "Clinical documentation", body: "Capture progress notes, incidents, drug disposal, and evacuation drills through structured workflows." },
  { icon: CalendarCheck, title: "Daily coordination", body: "Bring appointments, shifts, announcements, and facility calendars into the flow of care." },
  { icon: ShieldCheck, title: "Compliance review", body: "Give administrators a consistent review queue with status, notes, and operational oversight." },
  { icon: BellRing, title: "Actionable alerts", body: "Keep care teams current with assignments, incidents, facility updates, and schedule notifications." },
];

const adminLogin = "/login?next=/admin/dashboard&intent=admin";
const staffLogin = "/login?next=/staff/dashboard&intent=staff";

export default function RootPage() {
  return <main className={styles.site}>
    <nav className={styles.nav} aria-label="Main navigation">
      <Link href="/" className={styles.brand} aria-label="Colaris Care home"><Image src="/colarislogo.png" alt="" width={44} height={44} priority /><span><strong>Colaris Care</strong><small>Care, simplified.</small></span></Link>
      <div className={styles.navLinks}><a href="#platform">Platform</a><a href="#workspaces">Workspaces</a><a href="#security">Security</a></div>
      <div className={styles.navActions}><Link href={staffLogin} className={styles.textLink}>Staff portal</Link><Link href={adminLogin} className={styles.navButton}>Open admin <ArrowRight size={15} /></Link></div>
    </nav>

    <section className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <div className={styles.kicker}><Sparkles size={14} /> One connected care operations platform</div>
        <h1>Make every day of care <em>clearer.</em></h1>
        <p>Colaris gives residential care teams one calm, structured place to coordinate people, medication workflows, documentation, and compliance.</p>
        <div className={styles.heroActions}><Link href={adminLogin} className={styles.primaryButton}>Explore the admin workspace <ArrowRight size={17} /></Link><Link href={staffLogin} className={styles.secondaryButton}><UserRound size={16} /> Enter staff workspace</Link></div>
        <div className={styles.proofRow}>{["Role-based workflows", "Audit-ready records", "Built around care teams"].map((item) => <span key={item}><CheckCircle2 size={15} /> {item}</span>)}</div>
      </div>
      <div className={styles.productStage} aria-label="Colaris product preview">
        <div className={styles.stageTop}><div className={styles.stageBrand}><Image src="/colarislogo.png" alt="" width={30} height={30} /><span>Maple Grove Care</span></div><div className={styles.stageUser}>AK</div></div>
        <div className={styles.stageBody}>
          <div className={styles.previewHeading}><span>Today at a glance</span><small>Thursday, June 25</small></div>
          <div className={styles.metricGrid}><div><Activity size={16} /><strong>18</strong><span>Residents</span></div><div><CheckCircle2 size={16} /><strong>82%</strong><span>Rounds complete</span></div><div><FileCheck2 size={16} /><strong>4</strong><span>Pending review</span></div></div>
          <div className={styles.previewColumns}><div className={styles.previewPanel}><div className={styles.panelTitle}><span>Care operations</span><small>Live</small></div>{[["Morning medication round","West wing · Completed","done"],["Progress notes","4 awaiting review","review"],["Resident appointments","3 scheduled today","next"]].map(([title,meta,state]) => <div className={styles.activityRow} key={title}><span className={styles[state]}><Check size={12} /></span><div><strong>{title}</strong><small>{meta}</small></div></div>)}</div><div className={styles.previewPanel}><div className={styles.panelTitle}><span>Team coverage</span><small>12 on shift</small></div><div className={styles.coverage}><div className={styles.avatarStack}><i>PN</i><i>DO</i><i>TR</i><i>+9</i></div><p>All wings covered</p><span>Next handoff · 3:00 PM</span></div></div></div>
        </div>
        <div className={styles.floatingCard}><ShieldCheck size={17} /><span><strong>Compliance ready</strong><small>Required reviews are on track</small></span></div>
      </div>
    </section>

    <section className={styles.audienceStrip}><span>Purpose-built for</span><strong>Adult care homes</strong><i /><strong>Residential care</strong><i /><strong>Assisted living teams</strong><i /><strong>Multi-facility operators</strong></section>

    <section className={styles.section} id="platform">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>The platform</span><h2>One operating system for the work behind great care.</h2></div><p>Replace disconnected forms and scattered updates with workflows that give every role the right context and next action.</p></div>
      <div className={styles.capabilityGrid}>{capabilities.map(({icon:Icon,title,body},index) => <article className={styles.capabilityCard} key={title}><div className={styles.capabilityNumber}>0{index+1}</div><span className={styles.iconBox}><Icon size={20} /></span><h3>{title}</h3><p>{body}</p><span className={styles.cardLine} /></article>)}</div>
    </section>

    <section className={styles.workspaceSection} id="workspaces">
      <div className={styles.workspaceCopy}><span className={styles.eyebrow}>Built for every role</span><h2>Focused workspaces. Shared operational truth.</h2><p>Administrators get facility-wide oversight. Staff get a clear daily queue. Both work from the same connected operational context.</p><div className={styles.workspaceChecks}>{["Less time hunting for information","Clear ownership for every workflow","Consistent records across the facility"].map((item)=><span key={item}><Check size={15}/>{item}</span>)}</div></div>
      <div className={styles.portalGrid}><Link href={adminLogin} className={styles.portalCard}><span className={styles.portalIcon}><Building2 size={22}/></span><small>Facility leadership</small><h3>Admin workspace</h3><p>Residents, staff, clinical review, reports, compliance, and facility operations.</p><strong>Open admin <ArrowRight size={15}/></strong></Link><Link href={staffLogin} className={`${styles.portalCard} ${styles.portalCardDark}`}><span className={styles.portalIcon}><UserRound size={22}/></span><small>Care team</small><h3>Staff workspace</h3><p>Assigned residents, medication administration, documentation, schedules, and alerts.</p><strong>Open staff portal <ArrowRight size={15}/></strong></Link></div>
    </section>

    <section className={styles.securitySection} id="security"><div className={styles.securityMark}><LockKeyhole size={28}/></div><div className={styles.securityCopy}><span className={styles.eyebrow}>Trust by design</span><h2>Operational clarity without compromising control.</h2><p>Colaris structures access and review around real care-team responsibilities, helping facilities build consistent, accountable habits.</p></div><div className={styles.safeguards}>{["Role-specific admin and staff workspaces","Structured review and approval workflows","Facility and organization context throughout","Clear audit-ready operational history"].map(item=><span key={item}><CheckCircle2 size={16}/>{item}</span>)}</div></section>
    <section className={styles.finalCta}><div><span className={styles.eyebrow}>Start with clarity</span><h2>Bring your care operations into one calm workspace.</h2></div><div className={styles.finalActions}><Link href={adminLogin} className={styles.primaryButton}>Explore Colaris <ArrowRight size={17}/></Link><span>Use mock login credentials for this preview</span></div></section>
    <footer className={styles.footer}><div className={styles.brand}><Image src="/colarislogo.png" alt="" width={38} height={38}/><span><strong>Colaris Care</strong><small>Care, simplified.</small></span></div><p>Thoughtful software for the teams who make care happen.</p><div><Link href={adminLogin}>Admin</Link><Link href={staffLogin}>Staff</Link><a href="#security">Security</a></div></footer>
  </main>;
}
