"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Command, Compass,
  DollarSign, Download, Filter, Grid2X2, LayoutDashboard, Lightbulb,
  MapPin, Menu, MoreHorizontal, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, TrendingUp, Users,
  Bookmark, CheckCircle2, Zap,
} from "lucide-react"
import {
  Area, AreaChart, CartesianGrid, Tooltip, XAxis,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { TalentProfileEditor, type WorkerProfile } from "@/components/talent-profile-editor"

type LiveJobRow = {
  id: string
  title: string
  description: string
  required_skills: string[] | null
  extracted_skills: string[] | null
  experience_level: string
  budget_min: number
  budget_max: number
  estimated_hours: number
  work_type: string
  location: string
  created_at: string
  client?: {
    id: string
    full_name: string
    company_name: string | null
    location: string | null
  } | null
}

type Job = {
  id: string
  title: string
  description: string
  company: string
  initials: string
  color: string
  match?: number
  rate: string
  duration: string
  location: string
  posted: string
  skills: string[]
  extractedSkills: string[]
  category: string
  matchReason?: string
  breakdown?: {
    skillCompatibility: number
    budgetCompatibility: number
    availabilityMatch: number
    experienceRelevance: number
  }
}

type MatchResult = {
  matches: Array<{
    jobId: string
    score: number
    matchedSkills: string[]
    missingSkills: string[]
    explanation: string
    breakdown?: {
      skillCompatibility: number
      budgetCompatibility: number
      availabilityMatch: number
      experienceRelevance: number
    }
  }>
  marketInsight: string
  trendingSkill: string
  demandSignal: string
  learningSuggestion: string
}

type CandidateMatch = {
  workerId: string
  fullName: string
  headline: string | null
  hourlyRate: number
  availabilityHoursPerWeek: number
  experienceYears: number
  overallScore: number
  breakdown: {
    skillCompatibility: number
    budgetCompatibility: number
    availabilityMatch: number
    experienceRelevance: number
    rawCosineSimilarity: number
  }
  matchedSkills: string[]
  missingSkills: string[]
}

const badgeColors = ["mint", "lavender", "peach", "blue"]

function mapRowToJob(row: LiveJobRow, index: number): Job {
  const company = row.client?.company_name || row.client?.full_name || "Marketplace Client"
  const initials = company.trim().charAt(0).toUpperCase() || "M"
  const combinedSkills = Array.from(
    new Set([...(row.required_skills ?? []), ...(row.extracted_skills ?? [])])
  )
  const hours = row.estimated_hours || 20
  const duration = hours <= 20 ? "1–2 weeks" : hours <= 30 ? "2–3 weeks" : "1 month"

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    company,
    initials,
    color: badgeColors[index % badgeColors.length],
    rate: `$${row.budget_min}–${row.budget_max}`,
    duration,
    location: row.location || (row.work_type === "remote" ? "Remote" : row.work_type),
    posted: "Live",
    skills: combinedSkills.slice(0, 5),
    extractedSkills: row.extracted_skills ?? [],
    category: row.experience_level,
  }
}

const activityData = [
  { day: "Mon", earnings: 320 }, { day: "Tue", earnings: 460 }, { day: "Wed", earnings: 390 },
  { day: "Thu", earnings: 610 }, { day: "Fri", earnings: 520 }, { day: "Sat", earnings: 730 }, { day: "Sun", earnings: 680 },
]
const chartConfig = { earnings: { label: "Earnings", color: "var(--chart-1)" } } satisfies ChartConfig

const workerNav = [
  { name: "Overview", icon: LayoutDashboard }, { name: "My talent profile", icon: Users },
  { name: "Explore jobs", icon: Compass }, { name: "Skill intelligence", icon: Sparkles, isNew: true },
  { name: "My applications", icon: BriefcaseBusiness }, { name: "Projects & earnings", icon: DollarSign },
]
const clientNav = [
  { name: "Overview", icon: LayoutDashboard }, { name: "Post a job", icon: Plus },
  { name: "Discover talent", icon: Users }, { name: "Applications", icon: BriefcaseBusiness },
  { name: "Projects", icon: Grid2X2 }, { name: "Analytics", icon: Activity },
]

export function WorkspaceDashboard() {
  const [role, setRole] = useState<"worker" | "client">("worker")
  const [activeNav, setActiveNav] = useState("Overview")
  const [filter, setFilter] = useState("For you")
  const [search, setSearch] = useState("")
  const [saved, setSaved] = useState<string[]>([])
  const [applied, setApplied] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notice, setNotice] = useState("")

  // Live Supabase jobs & worker profile state
  const [jobs, setJobs] = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null)

  // Live AI matching state
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState("")

  async function fetchLiveJobs() {
    setLoadingJobs(true)
    try {
      const res = await fetch("/api/jobs")
      const data = await res.json()
      if (res.ok && Array.isArray(data.jobs)) {
        setJobs(data.jobs.map(mapRowToJob))
      }
    } catch {
      flash("Could not load live jobs from Supabase")
    } finally {
      setLoadingJobs(false)
    }
  }

  useEffect(() => {
    fetchLiveJobs()
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setWorkerProfile(d.profile)
      })
      .catch(() => {})
  }, [])

  // Derived worker display values (automatically update when profile is edited)
  const workerFullName = workerProfile?.full_name || "Aarav Mehta"
  const workerFirstName = workerFullName.split(" ")[0] || "Aarav"
  const workerInitials = workerFullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AM"
  const workerCompletion = workerProfile?.profile_completion ?? 92
  const workerSkills = workerProfile?.skills ?? [
    { name: "Social Media Marketing", level: 94, verified: true },
    { name: "Canva", level: 92, verified: true },
    { name: "Content Strategy", level: 88, verified: true },
    { name: "Marketing Analytics", level: 85, verified: false },
    { name: "Figma", level: 80, verified: true },
  ]
  const verifiedSkillsCount = workerSkills.filter((s) => s.verified).length

  const visibleJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const matchesSearch = `${job.title} ${job.company} ${job.skills.join(" ")}`.toLowerCase().includes(search.toLowerCase())
      const matchesFilter = filter !== "Remote only" || job.location.toLowerCase().includes("remote")
      return matchesSearch && matchesFilter
    })
    if (!matchResult) return filtered

    const matchesById = new Map(matchResult.matches.map((match) => [match.jobId, match]))
    return filtered
      .map((job) => {
        const match = matchesById.get(job.id)
        return match
          ? { ...job, match: match.score, matchReason: match.explanation, breakdown: match.breakdown }
          : job
      })
      .sort((first, second) => (second.match ?? -1) - (first.match ?? -1))
  }, [jobs, search, filter, matchResult])

  const navItems = role === "worker" ? workerNav : clientNav

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 2800)
  }

  async function runAiMatching() {
    setMatching(true)
    setMatchError("")
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: workerProfile?.id || "22222222-2222-2222-2222-222222222201",
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to generate matches.")
      setMatchResult(result as MatchResult)
      flash("Live pgvector + Multi-Objective scores updated")
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "Unable to generate matches. Please try again.")
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => { setActiveNav("Overview"); setMobileOpen(false) }}>
          <span className="brand-mark"><span /><span /><span /><span /></span><span>talent<span className="brand-dot">.</span>loop</span>
        </a>
        <button className="workspace-switcher" onClick={() => { const next = role === "worker" ? "client" : "worker"; setRole(next); setActiveNav("Overview"); flash(`Switched to ${next === "worker" ? "talent" : "client"} workspace`) }}>
          <span className="workspace-avatar">{role === "worker" ? workerFirstName.charAt(0).toUpperCase() : "E"}</span>
          <span className="workspace-copy"><strong>{role === "worker" ? workerFullName : "Lumina D2C"}</strong><small>{role === "worker" ? "Independent talent" : "Client workspace"}</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="main-nav">
          {navItems.map((item) => {
            const { name, icon: Icon } = item
            const count = name === "Explore jobs" ? String(jobs.length) : name === "My applications" ? String(applied.length) : ""
            const isNew = "isNew" in item && Boolean(item.isNew)
            return <button key={name} className={`nav-item ${activeNav === name ? "nav-active" : ""}`} onClick={() => { setActiveNav(name); setMobileOpen(false) }}>
              <Icon size={17} strokeWidth={1.8} /><span>{name}</span>{count && <span className="nav-count">{count}</span>}{isNew && <span className="new-dot" />}
            </button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><Lightbulb size={16} /></div><strong>Small steps, big growth</strong><p>Your profile is {workerCompletion}% complete. Add a work sample to stand out.</p><button onClick={() => { setActiveNav("My talent profile"); flash("Opening your talent profile") }}>Complete profile <ArrowRight size={13} /></button></div>
          <button className="nav-item"><Settings2 size={17} strokeWidth={1.8} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17} strokeWidth={1.8} /><span>Help & support</span></button>
          <div className="profile-mini"><div className="avatar-photo">{role === "worker" ? workerInitials : "ER"}</div><span><strong>{role === "worker" ? workerFullName : "Elena Rostova"}</strong><small>{role === "worker" ? "Verified talent" : "Head of Growth"}</small></span><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input aria-label="Search jobs, skills, or clients" placeholder="Search anything..." value={search} onChange={(e) => setSearch(e.target.value)} /><kbd><Command size={11} /> K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => flash("You’re all caught up!")}><Bell size={18} /><i /></button>
            <div className="top-divider" />
            <button className="role-switch" onClick={() => { const next = role === "worker" ? "client" : "worker"; setRole(next); setActiveNav("Overview"); flash(`Switched to ${next === "worker" ? "talent" : "client"} view`) }}><span className="switch-dot" />{role === "worker" ? "Talent view" : "Client view"}<ChevronDown size={14} /></button>
          </div>
        </header>

        {activeNav === "Overview" ? <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="live-indicator" /> LIVE SUPABASE + PGVECTOR ENGINE</div><h1>{role === "worker" ? `Good morning, ${workerFirstName}` : "Good morning, Elena"}<Sparkles className="wave" size={16} aria-hidden="true" /></h1><p>{role === "worker" ? "Here’s what’s happening with your freelance career today." : "Post briefs with AI skill extraction and rank talent using Multi-Objective Utility."}</p></div>
            <div className="welcome-actions"><span className="updated-label"><span className="live-indicator" /> Connected to Supabase</span><button className="primary-button" onClick={() => role === "worker" ? (setActiveNav("My talent profile"), flash("Your talent profile is ready to update")) : setActiveNav("Post a job")}><Plus size={16} />{role === "worker" ? "Update profile" : "Post a job"}</button></div>
          </section>

          <section className="stats-grid" aria-label="Your performance summary">
            <article className="stat-card"><div className="stat-top"><span>Profile strength</span><span className="stat-icon purple"><Sparkles size={16} /></span></div><div className="stat-value">{workerCompletion}<span className="stat-unit">/100</span><span className="trend-chip"><ArrowUpRight size={13} /> 8%</span></div><div className="stat-foot"><div className="progress-track"><span style={{ width: `${workerCompletion}%` }} /></div><span>Vector-indexed</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Live opportunities</span><span className="stat-icon green"><Zap size={16} /></span></div><div className="stat-value">{jobs.length}<span className="stat-inline-label">open in market</span></div><div className="stat-foot"><span className="positive-copy"><ArrowUpRight size={13} /> Synced from PostgreSQL</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Applications</span><span className="stat-icon blue"><BriefcaseBusiness size={16} /></span></div><div className="stat-value">{applied.length}<span className="stat-inline-label">submitted</span></div><div className="stat-foot"><span className="status-dot" />{saved.length} saved for later</div></article>
            <article className="stat-card"><div className="stat-top"><span>This month</span><span className="stat-icon peach"><DollarSign size={16} /></span></div><div className="stat-value">$4,280<span className="trend-chip"><ArrowUpRight size={13} /> 12%</span></div><div className="stat-foot"><span className="muted-copy">vs. $3,820 last month</span></div></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel opportunities-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-overline"><Sparkles size={13} /> LIVE AI MATCHING · PGVECTOR + GEMINI</div>
                  <h2>{role === "worker" ? "Made for your skills" : "Your open job postings"} <span className="heading-count">{visibleJobs.length}</span></h2>
                  <p>{role === "worker" ? "Vector-ranked opportunities with explainable multi-objective fit scores." : "Switch to Discover talent to rank candidates with live utility sliders."}</p>
                </div>
                <div className="match-heading-actions">
                  {role === "worker" ? (
                    <button className="ai-match-button" onClick={runAiMatching} disabled={matching}><Sparkles size={13} />{matching ? "Analyzing…" : matchResult ? "Refresh matches" : "Run AI match"}</button>
                  ) : (
                    <button className="ai-match-button" onClick={() => setActiveNav("Discover talent")}><Users size={13} />Rank talent</button>
                  )}
                  <button className="text-action" onClick={() => setActiveNav(role === "worker" ? "Explore jobs" : "Post a job")}>{role === "worker" ? "View all" : "Post new"} <ArrowRight size={14} /></button>
                </div>
              </div>
              <div className="filter-row"><div className="filter-tabs" role="group" aria-label="Filter opportunities">{["For you", "Remote only"].map((item) => <button key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="filter-button" aria-label="More filters" onClick={() => flash("Showing your best skill matches")}><SlidersHorizontal size={15} /></button></div>
              {matchError && <p className="ai-match-error" role="alert">{matchError}</p>}
              {matchResult && <p className="ai-match-note" role="status">{matchResult.marketInsight}</p>}
              <div className="job-list">
                {loadingJobs ? (
                  <div className="no-results">Loading live opportunities from Supabase…</div>
                ) : visibleJobs.length ? (
                  visibleJobs.slice(0, 3).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSaved={saved.includes(job.id)}
                      isApplied={applied.includes(job.id)}
                      onSave={() => setSaved((curr) => curr.includes(job.id) ? curr.filter((id) => id !== job.id) : [...curr, job.id])}
                      onApply={() => { setApplied((curr) => curr.includes(job.id) ? curr : [...curr, job.id]); flash("Application sent — good luck!") }}
                    />
                  ))
                ) : (
                  <div className="no-results">No opportunities found. Try a different search.</div>
                )}
              </div>
              <button className="all-opportunities" onClick={() => { setActiveNav(role === "worker" ? "Explore jobs" : "Discover talent"); setFilter("For you") }}>
                {role === "worker" ? "Explore all opportunities" : "Open AI Talent Ranking & Utility Sliders"} <ArrowRight size={15} />
              </button>
            </article>

            <div className="right-column">
              <article className="panel intelligence-panel"><div className="intelligence-top"><div className="section-overline"><span className="sparkle-mini"><Sparkles size={13} /></span> SKILL INTELLIGENCE</div><button className="icon-button tiny" aria-label="More skill intelligence options" onClick={runAiMatching}><MoreHorizontal size={18} /></button></div><h2>Your next skill to grow</h2><p className="intelligence-copy">{matchResult?.learningSuggestion || "Run the live AI match to compute real-time skill scarcity and upskilling ROI from open marketplace jobs."}</p><div className="demand-card"><div className="demand-title"><span className="demand-icon"><TrendingUp size={15} /></span><span><strong>{matchResult?.trendingSkill || "Run AI Match"}</strong><small>{matchResult ? "Computed from live job demand" : "Click Run AI match to analyze"}</small></span><span className="demand-growth">{matchResult?.demandSignal || "—"}</span></div><div className="demand-meta"><span>Addressable market lift</span><span>Live PostgreSQL signal</span></div></div><button className="insight-link" onClick={() => setActiveNav("Skill intelligence")}>Explore your skill path <ArrowRight size={14} /></button></article>
              <article className="panel earnings-panel"><div className="chart-header"><div><span className="chart-title">Earnings overview</span><span className="chart-period">This week <ChevronDown size={12} /></span></div><button className="icon-button tiny" aria-label="Download earnings report" onClick={() => flash("Your earnings summary is ready")}><Download size={16} /></button></div><div className="chart-total">$3,710 <span><ArrowUpRight size={13} /> 18.4%</span></div><div className="chart-area"><ChartContainer config={chartConfig} className="h-full w-full"><AreaChart accessibilityLayer data={activityData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}><defs><linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-earnings)" stopOpacity={0.2} /><stop offset="90%" stopColor="var(--color-earnings)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#efedf3" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9895a3", fontSize: 10 }} tickMargin={9} /><Tooltip cursor={false} contentStyle={{ borderRadius: 10, border: "1px solid #eeeaf3", fontSize: 12 }} formatter={(value) => [`$${value}`, "Earnings"]} /><Area type="monotone" dataKey="earnings" stroke="var(--color-earnings)" strokeWidth={2.5} fill="url(#earningsGradient)" /></AreaChart></ChartContainer></div></article>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel skills-panel">
              <div className="panel-heading compact-heading">
                <div><div className="section-overline">YOUR EDGE</div><h2>Skills that set you apart</h2></div>
                <button className="text-action" onClick={() => setActiveNav("My talent profile")}>Edit skills <ArrowRight size={14} /></button>
              </div>
              <div className="skill-chips">
                {workerSkills.map((skill) => (
                  <span key={skill.name} className={`skill-chip ${skill.verified ? "skill-highlight" : ""}`}>
                    {skill.verified && <CheckCircle2 size={13} />}
                    {skill.name} <span className="skill-level">{skill.level}%</span>
                  </span>
                ))}
              </div>
              <div className="skills-footer">
                <ShieldCheck size={14} />
                <span><strong>{verifiedSkillsCount} verified skills</strong> indexed in pgvector</span>
                <ArrowRight size={14} className="skills-arrow" />
              </div>
            </article>
            <article className="panel next-panel"><div className="next-icon"><CalendarDays size={18} /></div><div className="next-content"><span className="next-label">UP NEXT</span><strong>Q1 Instagram Growth Review</strong><span className="next-detail"><Clock3 size={13} />Tomorrow, 10:30 AM <span>·</span> Lumina D2C Wellness</span></div><button className="icon-button tiny" aria-label="View project" onClick={() => setActiveNav("Projects & earnings")}><ArrowRight size={16} /></button></article>
          </section>
          <footer className="page-footer"><span>© 2026 talent.loop</span><span>Built around what you do best <span className="footer-star">✳</span></span><button onClick={() => flash("You’re all caught up!")}>Feedback <ArrowRight size={12} /></button></footer>
        </div> : (
          <SectionView
            name={activeNav}
            role={role}
            jobs={visibleJobs}
            saved={saved}
            applied={applied}
            onSave={(id) => setSaved((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id])}
            onApply={(id) => { setApplied((curr) => curr.includes(id) ? curr : [...curr, id]); flash("Application sent — good luck!") }}
            onJobCreated={async () => { await fetchLiveJobs(); flash("Job posted, implicit skills extracted & embedded!") }}
            onProfileSaved={async (updated) => {
              setWorkerProfile(updated)
              flash("Profile saved & re-embedded! Recalculating AI matches…")
              await runAiMatching()
            }}
            onBack={() => setActiveNav("Overview")}
            onNotice={flash}
          />
        )}
        {notice && <div className="toast-message" role="status"><Check size={15} />{notice}</div>}
      </main>
    </div>
  )
}

function JobCard({ job, isSaved, isApplied, onSave, onApply }: { job: Job; isSaved: boolean; isApplied: boolean; onSave: () => void; onApply: () => void }) {
  return (
    <article className="job-card">
      <div className="job-card-top">
        <div className={`company-logo ${job.color}`}>{job.initials}</div>
        <div className="job-title-block">
          <h3>{job.title}</h3>
          <span>{job.company} <span className="verified-company"><Check size={10} /></span><span className="job-posted"> · {job.posted}</span></span>
        </div>
        <div className="match-badge">
          <span className="match-spark"><Sparkles size={12} /></span>
          <strong>{job.match == null ? "—" : `${job.match}%`}</strong>
          <small>{job.match == null ? "run AI" : "match"}</small>
        </div>
      </div>
      <div className="job-tags">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      {job.matchReason && <p className="match-reason">AI rationale: {job.matchReason}</p>}
      <div className="job-card-footer">
        <div className="job-meta">
          <span><DollarSign size={13} />{job.rate}<small>/ hr</small></span><i />
          <span><Clock3 size={13} />{job.duration}</span><i />
          <span><MapPin size={13} />{job.location}</span>
        </div>
        <div className="job-actions">
          <button className={`save-button ${isSaved ? "saved" : ""}`} aria-label={isSaved ? "Unsave job" : "Save job"} onClick={onSave}><Bookmark size={15} fill={isSaved ? "currentColor" : "none"} /></button>
          <button className={`apply-button ${isApplied ? "applied" : ""}`} onClick={onApply}>{isApplied ? <><Check size={13} /> Applied</> : <>Quick apply <ArrowRight size={13} /></>}</button>
        </div>
      </div>
    </article>
  )
}

function SectionView({
  name, role, jobs, saved, applied, onSave, onApply, onJobCreated, onProfileSaved, onBack, onNotice,
}: {
  name: string
  role: "worker" | "client"
  jobs: Job[]
  saved: string[]
  applied: string[]
  onSave: (id: string) => void
  onApply: (id: string) => void
  onJobCreated: () => Promise<void>
  onProfileSaved: (profile: WorkerProfile) => Promise<void>
  onBack: () => void
  onNotice: (message: string) => void
}) {
  const [query, setQuery] = useState("")

  // Client: Post a Job form state
  const [jobTitle, setJobTitle] = useState("")
  const [jobDesc, setJobDesc] = useState("")
  const [budgetMin, setBudgetMin] = useState("40")
  const [budgetMax, setBudgetMax] = useState("65")
  const [hours, setHours] = useState("25")
  const [posting, setPosting] = useState(false)
  const [createdSkills, setCreatedSkills] = useState<string[]>([])

  // Client: Discover Talent + MTEC Multi-Objective Utility Sliders
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? "")
  const [wSkill, setWSkill] = useState(45)
  const [wBudget, setWBudget] = useState(25)
  const [wAvail, setWAvail] = useState(15)
  const [wExp, setWExp] = useState(15)
  const [candidates, setCandidates] = useState<CandidateMatch[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  useEffect(() => {
    if (!selectedJobId && jobs[0]?.id) setSelectedJobId(jobs[0].id)
  }, [jobs, selectedJobId])

  useEffect(() => {
    if (name !== "Discover talent" || !selectedJobId) return
    let active = true
    setLoadingCandidates(true)
    const params = new URLSearchParams({
      jobId: selectedJobId,
      wSkill: String(wSkill / 100),
      wBudget: String(wBudget / 100),
      wAvailability: String(wAvail / 100),
      wExperience: String(wExp / 100),
    })
    fetch(`/api/matches?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.matches)) setCandidates(data.matches)
      })
      .finally(() => {
        if (active) setLoadingCandidates(false)
      })
    return () => { active = false }
  }, [name, selectedJobId, wSkill, wBudget, wAvail, wExp])

  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault()
    if (!jobTitle.trim() || !jobDesc.trim()) return
    setPosting(true)
    setCreatedSkills([])
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitle,
          description: jobDesc,
          budget_min: Number(budgetMin),
          budget_max: Number(budgetMax),
          estimated_hours: Number(hours),
          work_type: "remote",
          location: "Remote",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to post job")
      setCreatedSkills(data.job?.extracted_skills ?? [])
      setJobTitle("")
      setJobDesc("")
      await onJobCreated()
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Could not post job")
    } finally {
      setPosting(false)
    }
  }

  if (name === "My talent profile") {
    return <TalentProfileEditor onBack={onBack} onSaved={onProfileSaved} />
  }

  if (name === "Explore jobs") {
    const filtered = jobs.filter((job) => `${job.title} ${job.company} ${job.skills.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    return (
      <div className="section-content">
        <button className="back-link" onClick={onBack}>← Back to overview</button>
        <div className="section-page-heading">
          <div className="section-overline"><Sparkles size={13} /> LIVE SUPABASE DISCOVERY</div>
          <h1>Explore opportunities</h1>
          <p>Real-time jobs with Gemini-extracted implicit skills and vector match scores.</p>
        </div>
        <div className="section-search"><Search size={17} /><input placeholder="Search roles, skills, or companies" value={query} onChange={(event) => setQuery(event.target.value)} /><button><Filter size={15} /> Filters</button></div>
        <div className="explore-results">
          <span className="results-count">{filtered.length} live opportunities</span>
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} isSaved={saved.includes(job.id)} isApplied={applied.includes(job.id)} onSave={() => onSave(job.id)} onApply={() => onApply(job.id)} />
          ))}
        </div>
      </div>
    )
  }

  if (name === "Post a job") {
    return (
      <div className="section-content">
        <button className="back-link" onClick={onBack}>← Back to overview</button>
        <div className="section-page-heading">
          <div className="section-overline"><Sparkles size={13} /> GEMINI IMPLICIT SKILL EXTRACTION</div>
          <h1>Post a new opportunity</h1>
          <p>Describe what you need in plain English—Gemini infers implicit skills and indexes your brief in pgvector automatically.</p>
        </div>
        <form onSubmit={handlePostJob} className="panel" style={{ display: "grid", gap: "1rem", maxWidth: 680 }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Job Title
            <input required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Q2 Instagram Growth & Analytics Lead" style={{ padding: "0.65rem 0.85rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }} />
          </label>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Project Description (AI extracts implicit skills from this)
            <textarea required rows={4} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="e.g. Looking for someone who can create social media campaigns, design Instagram creatives, and analyse engagement metrics..." style={{ padding: "0.65rem 0.85rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
              Min Budget ($/hr)
              <input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
              Max Budget ($/hr)
              <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
              Est. Hours
              <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: 10, border: "1px solid #e4e2ec", fontWeight: 400 }} />
            </label>
          </div>
          <button type="submit" className="primary-button" disabled={posting} style={{ width: "fit-content" }}>
            <Sparkles size={15} /> {posting ? "Extracting skills & embedding…" : "Publish with AI Skill Extraction"}
          </button>
          {createdSkills.length > 0 && (
            <div style={{ padding: "0.85rem", borderRadius: 12, background: "#f5f3ff", border: "1px solid #e0e7ff" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#4f46e5", marginBottom: 6 }}>Gemini Extracted Implicit Skills & Indexed in pgvector:</div>
              <div className="job-tags">{createdSkills.map((s) => <span key={s}>{s}</span>)}</div>
            </div>
          )}
        </form>
      </div>
    )
  }

  if (name === "Discover talent") {
    return (
      <div className="section-content">
        <button className="back-link" onClick={onBack}>← Back to overview</button>
        <div className="section-page-heading">
          <div className="section-overline"><Sparkles size={13} /> MULTI-OBJECTIVE UTILITY ENGINE · SENSITIVITY ANALYSIS</div>
          <h1>Discover & rank talent</h1>
          <p>Adjust utility weights (α, β, γ, δ) to shift hiring priority between Skill Depth, Cost Efficiency, Availability, and Experience in real time.</p>
        </div>

        <div className="panel" style={{ display: "grid", gap: "1rem", marginBottom: "1.25rem" }}>
          <label style={{ display: "grid", gap: "0.35rem", fontSize: 13, fontWeight: 600 }}>
            Target Job Posting
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} style={{ padding: "0.65rem 0.85rem", borderRadius: 10, border: "1px solid #e4e2ec", background: "#fff", fontWeight: 500 }}>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.rate}/hr)</option>)}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span><strong>α Skill Compatibility:</strong> {wSkill}%</span>
              <input type="range" min={0} max={100} value={wSkill} onChange={(e) => setWSkill(Number(e.target.value))} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span><strong>β Budget Fit:</strong> {wBudget}%</span>
              <input type="range" min={0} max={100} value={wBudget} onChange={(e) => setWBudget(Number(e.target.value))} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span><strong>γ Availability:</strong> {wAvail}%</span>
              <input type="range" min={0} max={100} value={wAvail} onChange={(e) => setWAvail(Number(e.target.value))} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <span><strong>δ Experience & Verified:</strong> {wExp}%</span>
              <input type="range" min={0} max={100} value={wExp} onChange={(e) => setWExp(Number(e.target.value))} />
            </label>
          </div>
        </div>

        <div className="explore-results">
          <span className="results-count">{loadingCandidates ? "Recalculating utility rankings…" : `${candidates.length} candidates ranked by pgvector + Multi-Objective Utility`}</span>
          {candidates.map((c, idx) => (
            <article key={c.workerId} className="job-card">
              <div className="job-card-top">
                <div className={`company-logo ${badgeColors[idx % badgeColors.length]}`}>{c.fullName.charAt(0)}</div>
                <div className="job-title-block">
                  <h3>#{idx + 1} · {c.fullName}</h3>
                  <span>{c.headline} · ${c.hourlyRate}/hr · {c.availabilityHoursPerWeek}h/wk · {c.experienceYears} yrs exp</span>
                </div>
                <div className="match-badge">
                  <span className="match-spark"><Sparkles size={12} /></span>
                  <strong>{c.overallScore}%</strong>
                  <small>utility</small>
                </div>
              </div>
              <p className="match-reason">
                Skill: <strong>{c.breakdown.skillCompatibility}%</strong> · Budget: <strong>{c.breakdown.budgetCompatibility}%</strong> · Availability: <strong>{c.breakdown.availabilityMatch}%</strong> · Experience: <strong>{c.breakdown.experienceRelevance}%</strong> (Cosine: {c.breakdown.rawCosineSimilarity})
              </p>
              <div className="job-tags">
                {c.matchedSkills.map((s) => <span key={s}>✓ {s}</span>)}
                {c.missingSkills.slice(0, 2).map((s) => <span key={s} style={{ opacity: 0.55 }}>Gap: {s}</span>)}
              </div>
              <div className="job-card-footer">
                <div className="job-meta"><span>Verified talent profile</span></div>
                <div className="job-actions">
                  <button className="apply-button" onClick={() => onNotice(`Direct project invitation sent to ${c.fullName}`)}>Invite candidate <ArrowRight size={13} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  if (name === "Skill intelligence") return <div className="section-content"><button className="back-link" onClick={onBack}>← Back to overview</button><div className="section-page-heading"><div className="section-overline"><Sparkles size={13} /> YOUR NEXT ADVANTAGE</div><h1>Skill intelligence</h1><p>Turn live marketplace demand signals into your next career move.</p></div><div className="intelligence-feature"><div className="feature-graphic"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Sparkles size={27} /></div><span className="orbit-chip chip-a">Canva</span><span className="orbit-chip chip-b">Motion</span><span className="orbit-chip chip-c">Analytics</span></div><div className="feature-copy"><span className="section-overline">A GROWING OPPORTUNITY</span><h2>Meet the moment with motion design.</h2><p>Short-form video and animated brand assets are appearing in more creative briefs. Your existing social media and Canva skills put you in a strong position to add this high-scarcity capability.</p><div className="feature-stats"><span><strong>+34%</strong><small>Demand growth</small></span><span><strong>$55/hr</strong><small>Avg. project rate</small></span><span><strong>High</strong><small>Scarcity index</small></span></div><button className="primary-button" onClick={() => onNotice("Learning path added to your plan")}>Explore learning path <ArrowRight size={15} /></button></div></div></div>

  const title = name === "My applications" ? "My applications" : name === "Projects & earnings" ? "Projects & earnings" : name
  return <div className="section-content"><button className="back-link" onClick={onBack}>← Back to overview</button><div className="section-page-heading"><div className="section-overline"><span className="live-indicator" /> {role === "worker" ? "YOUR WORKSPACE" : "CLIENT WORKSPACE"}</div><h1>{title}</h1><p>Connected to your live Supabase marketplace.</p></div><div className="placeholder-panel panel"><div className="placeholder-symbol"><Star size={22} /></div><h2>{name === "My applications" ? `${applied.length} active application(s)` : "Your workspace is live"}</h2><p>{name === "My applications" ? "Jobs you quick-apply to are tracked here in real time." : "All core marketplace data is now synced with PostgreSQL + pgvector."}</p><button className="primary-button" onClick={onBack}>Back to overview <ArrowRight size={15} /></button></div></div>
}