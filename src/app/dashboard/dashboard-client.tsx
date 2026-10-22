"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownUp, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, FileText, Filter,
  Gauge, Heart, LayoutDashboard, Link2, ListChecks, LoaderCircle, MapPin,
  Menu, MoreHorizontal, Search, Send, Settings2, ShieldCheck, Sparkles,
  Target, Upload, UserRound, X, XCircle,
} from "lucide-react";
import { canOpenEmployer, contentSnapshot, skillMatchScore } from "@/lib/application-policy";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { extractResumeFields } from "@/lib/resume-parser";
import Onboarding from "./onboarding";

type Job = {
  id: string; title: string; company: string; location: string; remote: string;
  salary: string; type: string; posted: string; skills: string[]; description: string;
  match: number; source: string; url: string; active: boolean;
};
type Profile = { name: string; title: string; location: string; email: string; skills: string[]; education: string; summary: string; resumeText: string };
type SearchPreferences = { query: string; location: string; remote: string; sort: string; minimumSalary: number; employmentType: string };
type Application = { id: string; job: Job; status: "Pending Review" | "Approved" | "Rejected" | "Submitted"; summary: string; cover: string; answers: string; contentHash: string; approvalSnapshot?: string; employerOpened?: boolean; createdAt: string };
type Section = "Dashboard" | "Find Jobs" | "Application Queue" | "My Resume" | "Profile" | "Analytics" | "Settings";

const initialProfile: Profile = { name: "", title: "", location: "", email: "", skills: [], education: "", summary: "", resumeText: "" };
const initialSearchPreferences: SearchPreferences = { query: "", location: "", remote: "Any location type", sort: "Best match", minimumSalary: 0, employmentType: "Any type" };
const nav: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard }, { name: "Find Jobs", icon: Search }, { name: "Application Queue", icon: ListChecks },
  { name: "My Resume", icon: FileText }, { name: "Profile", icon: UserRound }, { name: "Analytics", icon: Activity }, { name: "Settings", icon: Settings2 },
];
const money = (v: string) => { const first = v.split(/[–-]/)[0]; const amount = Number(first.replace(/[^\d.]/g, "")) || 0; return /k/i.test(first) ? amount * 1000 : amount; };
function hash(value: string) { let h = 0; for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0; return String(h); }
function documentsHash(a: Pick<Application, "summary" | "cover" | "answers">) { return hash(`${a.summary}|${a.cover}|${a.answers}`); }

export default function DashboardClient({ userId, userEmail, userName }: { userId?: string; userEmail?: string; userName?: string } = {}) {
  const [section, setSection] = useState<Section>("Dashboard");
  const [profile, setProfile] = useState<Profile>({ ...initialProfile, name: userName || "", email: userEmail || "" });
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [searchPreferences, setSearchPreferences] = useState<SearchPreferences>(initialSearchPreferences);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [liveJobs, setLiveJobs] = useState<Job[]>([]);
  const [jobSources, setJobSources] = useState<string[]>([]);
  const [unavailableJobSources, setUnavailableJobSources] = useState<string[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobLoadError, setJobLoadError] = useState("");
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [remoteProfileReady, setRemoteProfileReady] = useState(!userId);
  const [fileName, setFileName] = useState("");
  const storagePrefix = userId ? `applypilot-user-${userId}` : "applypilot-demo";
  const profileKey = `${storagePrefix}-profile`;
  const applicationsKey = `${storagePrefix}-applications`;
  const savedJobsKey = `${storagePrefix}-saved-jobs`;
  const onboardingKey = `${storagePrefix}-onboarding-complete`;
  const searchPreferencesKey = `${storagePrefix}-search-preferences`;

  useEffect(() => {
    async function hydrate() {
      let storedProfile: Profile | undefined;
      try {
        const p = localStorage.getItem(profileKey);
        if (p) storedProfile = { ...initialProfile, ...JSON.parse(p) };
        const a = localStorage.getItem(applicationsKey); if (a) setApplications(JSON.parse(a));
        const s = localStorage.getItem(savedJobsKey); if (s) setSavedJobs(JSON.parse(s));
        const preferences = localStorage.getItem(searchPreferencesKey); if (preferences) setSearchPreferences({ ...initialSearchPreferences, ...JSON.parse(preferences) });
        setOnboardingComplete(localStorage.getItem(onboardingKey) === "true");
      } catch { /* Keep the workspace usable if local storage is unavailable. */ }
      if (userId) {
        try {
          const { data } = await createSupabaseClient().from("profiles").select("full_name,email,location,professional_summary,desired_titles,onboarding_draft").eq("id", userId).maybeSingle();
          if (data) {
            const draft = data.onboarding_draft as Partial<Profile> & { onboardingComplete?: boolean; searchPreferences?: SearchPreferences };
            if (draft.searchPreferences) setSearchPreferences({ ...initialSearchPreferences, ...draft.searchPreferences });
            storedProfile = { ...initialProfile, ...storedProfile, name: data.full_name || storedProfile?.name || userName || "", email: data.email || userEmail || "", location: data.location || storedProfile?.location || "", summary: data.professional_summary || storedProfile?.summary || "", title: draft.title || data.desired_titles?.[0] || storedProfile?.title || "", skills: draft.skills || storedProfile?.skills || [], education: draft.education || storedProfile?.education || "", resumeText: draft.resumeText || storedProfile?.resumeText || "" };
            setOnboardingComplete(Boolean(draft.onboardingComplete));
          }
        } catch { /* Local per-user storage remains available if profile sync is unavailable. */ }
      }
      setProfile(storedProfile || { ...initialProfile, name: userName || "", email: userEmail || "" });
      setRemoteProfileReady(true);
      setAuthReady(true);
    }
    void hydrate();
  }, [profileKey, applicationsKey, savedJobsKey, onboardingKey, searchPreferencesKey, userEmail, userId, userName]);
  useEffect(() => {
    if (!authReady) return;
    localStorage.setItem(profileKey, JSON.stringify(profile));
    if (userId && remoteProfileReady) {
      const draft = { title: profile.title, skills: profile.skills, education: profile.education, resumeText: profile.resumeText, onboardingComplete, searchPreferences };
      const timer = window.setTimeout(() => {
        void createSupabaseClient().from("profiles").upsert({ id: userId, full_name: profile.name, email: profile.email, location: profile.location || null, professional_summary: profile.summary, desired_titles: profile.title ? [profile.title] : [], onboarding_draft: draft });
      }, 500);
      return () => window.clearTimeout(timer);
    }
  }, [profile, authReady, profileKey, userId, remoteProfileReady, onboardingComplete, searchPreferences]);
  useEffect(() => { if (authReady) localStorage.setItem(applicationsKey, JSON.stringify(applications)); }, [applications, authReady, applicationsKey]);
  useEffect(() => { if (authReady) localStorage.setItem(savedJobsKey, JSON.stringify(savedJobs)); }, [savedJobs, authReady, savedJobsKey]);
  useEffect(() => { if (authReady) localStorage.setItem(onboardingKey, String(onboardingComplete)); }, [onboardingComplete, authReady, onboardingKey]);
  useEffect(() => { if (authReady) localStorage.setItem(searchPreferencesKey, JSON.stringify(searchPreferences)); }, [searchPreferences, authReady, searchPreferencesKey]);

  useEffect(() => {
    if (jobsLoaded) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Show the feed's loading state while the request runs.
    setJobsLoading(true);
    setJobLoadError("");
    void fetch("/api/jobs").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load live job listings.");
      if (cancelled) return;
      setLiveJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setJobSources(Array.isArray(data.sources) ? data.sources : []);
      setUnavailableJobSources(Array.isArray(data.unavailableSources) ? data.unavailableSources : []);
      setJobsLoaded(true);
    }).catch(() => { if (!cancelled) { setJobLoadError("Live listings could not be reached. Check your connection and try again."); setJobsLoaded(true); } })
      .finally(() => { if (!cancelled) setJobsLoading(false); });
    return () => { cancelled = true; };
  }, [jobsLoaded]);

  const jobs = useMemo(() => {
    const q = searchPreferences.query.toLowerCase();
    const locationQuery = searchPreferences.location.toLowerCase();
    const scored = liveJobs.map(j => ({ ...j, match: skillMatchScore(profile.skills, j.skills) }));
    const filtered = scored.filter(j => (!q || `${j.title} ${j.company} ${j.location} ${j.skills.join(" ")} ${j.description}`.toLowerCase().includes(q)) && (!locationQuery || j.location.toLowerCase().includes(locationQuery)) && (searchPreferences.remote === "Any location type" || j.remote === searchPreferences.remote) && (!searchPreferences.minimumSalary || money(j.salary) >= searchPreferences.minimumSalary) && (searchPreferences.employmentType === "Any type" || j.type.toLowerCase().replace(/[^a-z]/g, "").includes(searchPreferences.employmentType.toLowerCase().replace(/[^a-z]/g, ""))));
    return [...filtered].sort((a, b) => searchPreferences.sort === "Newest" ? parseInt(b.posted) - parseInt(a.posted) : searchPreferences.sort === "Salary" ? money(b.salary) - money(a.salary) : b.match - a.match);
  }, [liveJobs, searchPreferences, profile.skills]);
  const pending = applications.filter(a => a.status === "Pending Review");
  const currentApp = applications.find(a => a.id === activeApp);
  const setMessage = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 3600); };
  const editApp = (id: string, key: "summary" | "cover" | "answers", value: string) => setApplications(prev => prev.map(a => a.id === id ? { ...a, [key]: value, contentHash: documentsHash({ ...a, [key]: value }) } : a));

  async function prepareApplication(job: Job) {
    setBusy(true);
    const payload = { profile, resumeText: profile.resumeText, job };
    let docs = { summary: `${profile.summary} Experienced in ${profile.skills.slice(0, 4).join(", ")}.`, cover: `Hello ${job.company} team,\n\nI’m interested in the ${job.title} role. My background as a ${profile.title} and experience with ${profile.skills.slice(0, 3).join(", ")} align with the work your team is doing.\n\nI’d welcome the opportunity to share more about my work and learn about the role.\n\nBest,\n${profile.name}`, answers: "No application questions were provided. Review each question and add your own answer before submitting." };
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json(); if (res.ok && data.documents) docs = data.documents;
      if (data.mode === "demo") setMessage("Materials drafted in demo mode. Add an OpenAI key for AI-generated drafts.");
      else if (!res.ok) setMessage(data.error || "AI drafting is unavailable; review this demo draft carefully.");
    } catch { setMessage("Drafted in demo mode. Configure OpenAI to generate AI materials."); }
    const app: Application = { id: `${job.id}-${Date.now()}`, job, status: "Pending Review", ...docs, contentHash: "", createdAt: new Date().toISOString() };
    app.contentHash = documentsHash(app);
    setApplications(prev => [app, ...prev]); setActiveApp(app.id); setActiveJob(null); setSection("Application Queue"); setBusy(false);
  }
  function approve(id: string) { setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Approved", approvalSnapshot: contentSnapshot(a) } : a)); setMessage("Approved. This version is now eligible for submission."); }
  function reject(id: string) { setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Rejected", approvalSnapshot: undefined } : a)); setMessage("Application rejected and blocked from submission."); }
  function submit(id: string) {
    setApplications(prev => prev.map(a => {
      if (a.id !== id) return a;
      if (!canOpenEmployer(a)) { setMessage("Approval is missing or out of date. Review and approve this version first."); return a; }
      window.open(a.job.url, "_blank", "noopener,noreferrer");
      setMessage("Job source opened. Continue on the source site, then confirm it here.");
      return { ...a, employerOpened: true };
    }));
  }
  function markSubmitted(id: string) { setApplications(prev => prev.map(a => a.id === id && canOpenEmployer(a) && a.employerOpened ? { ...a, status: "Submitted" } : a)); setMessage("Marked submitted based on your confirmation."); }
  async function uploadResume(file?: File) {
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) && (!file.type || file.type === "application/pdf");
    const isDocx = /\.docx$/i.test(file.name) && (!file.type || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    if ((!isPdf && !isDocx) || file.size < 8 || file.size > 8 * 1024 * 1024) { setMessage("Choose a PDF or DOCX file under 8 MB."); return; }
    const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (isPdf && new TextDecoder().decode(signature.slice(0, 4)) !== "%PDF") { setMessage("This file does not look like a valid PDF."); return; }
    if (isDocx && !(signature[0] === 0x50 && signature[1] === 0x4b)) { setMessage("This file does not look like a valid DOCX document."); return; }
    setFileName(file.name);
    try {
      let text = "";
      if (file.name.toLowerCase().endsWith(".docx")) {
        const { strFromU8, unzipSync } = await import("fflate");
        const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
        const documentXml = archive["word/document.xml"];
        if (!documentXml) throw new Error("Missing document content");
        const xml = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
        text = Array.from(xml.getElementsByTagName("w:p"), paragraph => Array.from(paragraph.getElementsByTagName("w:t"), node => node.textContent || "").join("")).join("\n");
      } else {
        const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => (await (await pdf.getPage(i + 1)).getTextContent()).items.map((x) => "str" in x ? `${x.str}${x.hasEOL ? "\n" : " "}` : "").join("")));
        text = pages.join("\n");
      }
      const resumeText = text.slice(0, 30000);
      if (!resumeText.trim()) throw new Error("This resume has no selectable text");
      const parsed = extractResumeFields(resumeText);
      setProfile(p => ({ ...p, name: p.name || parsed.name || "", email: userEmail || p.email || parsed.email || "", title: p.title || parsed.title || "", location: p.location || parsed.location || "", skills: p.skills.length ? p.skills : parsed.skills, education: p.education || parsed.education || "", summary: p.summary || parsed.summary || "", resumeText }));
      setMessage("Resume details extracted. Review and correct your name, skills, and education before continuing.");
    } catch { setMessage("Could not read this file. Try another PDF or DOCX document."); }
  }

  if (userId && !authReady) return <main className="onboarding-loading"><Sparkles size={21} /> Loading your personal workspace…</main>;
  if (userId && authReady && !onboardingComplete) return <Onboarding profile={profile} setProfile={setProfile} onUpload={uploadResume} fileName={fileName} message={notice} onComplete={() => { setOnboardingComplete(true); setMessage("Your profile is saved. Welcome to your workspace."); }} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={19} strokeWidth={2.3} /></span><span>applypilot<span className="brand-ai">.ai</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{nav.map(item => <button key={item.name} className={`nav-item ${section === item.name ? "active" : ""}`} onClick={() => { setSection(item.name); setMobileNav(false); setActiveApp(null); }}><item.icon size={18} strokeWidth={1.8} /><span>{item.name}</span>{item.name === "Application Queue" && pending.length > 0 && <b className="nav-count">{pending.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={16} /></div><strong>Your search, your call.</strong><p>Nothing gets sent without your approval.</p><button onClick={() => setSection("Settings")}>Privacy settings <ArrowRight size={13} /></button></div><button className="user-card" onClick={() => setSection("Profile")}><div className="avatar">{profile.name.split(" ").map(s => s[0]).join("").slice(0, 2)}</div><span className="user-meta"><b>{profile.name || "Your profile"}</b><small>Personal workspace</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumbs">Workspace <span>/</span> <b>{section}</b></div><div className="top-actions"><span className="demo-badge"><span /> {userId ? "Signed-in workspace" : "Sample workspace"}</span><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setMessage("You’re all caught up.")}><Bell size={18} /><i /></button></div></header>
      <div className="page-content">
        {section === "Dashboard" && <Dashboard profile={profile} pending={pending} applications={applications} setSection={setSection} jobs={jobs} startSearch={() => setSection("Find Jobs")} />}
        {section === "Find Jobs" && <><div className="page-heading"><div><div className="eyebrow">DISCOVERY</div><h1>Find your next role</h1><p>Live remote listings from free public job feeds. Check the source listing before applying.</p></div><span className="demo-tag"><Sparkles size={13} /> LIVE SOURCES</span></div><div className="search-panel"><div className="search-field"><Search size={18} /><input value={searchPreferences.query} onChange={e => setSearchPreferences({ ...searchPreferences, query: e.target.value })} placeholder="Role, company, or skill" aria-label="Search jobs" /></div><div className="divider" /><label className="filter-field"><MapPin size={17} /><select value={searchPreferences.remote} onChange={e => setSearchPreferences({ ...searchPreferences, remote: e.target.value })} aria-label="Work location type"><option>Any location type</option><option>Remote</option></select><ChevronDown size={14} /></label><div className="divider" /><label className="filter-field sort-field"><ArrowDownUp size={16} /><select value={searchPreferences.sort} onChange={e => setSearchPreferences({ ...searchPreferences, sort: e.target.value })} aria-label="Sort jobs"><option>Best match</option><option>Newest</option><option>Salary</option></select><ChevronDown size={14} /></label><button className="filter-button" onClick={() => setFiltersOpen(value => !value)}><Filter size={16} /> Filters</button></div>{filtersOpen && <div className="filter-drawer"><label>Location<input value={searchPreferences.location} onChange={e => setSearchPreferences({ ...searchPreferences, location: e.target.value })} placeholder="Country, city, or region" /></label><label>Minimum salary<select value={searchPreferences.minimumSalary} onChange={e => setSearchPreferences({ ...searchPreferences, minimumSalary: Number(e.target.value) })}><option value={0}>Any salary</option><option value={50000}>$50k+</option><option value={100000}>$100k+</option><option value={140000}>$140k+</option><option value={170000}>$170k+</option></select></label><label>Employment type<select value={searchPreferences.employmentType} onChange={e => setSearchPreferences({ ...searchPreferences, employmentType: e.target.value })}><option>Any type</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label><button onClick={() => setSearchPreferences(initialSearchPreferences)}>Clear filters</button></div>}<div className="results-row"><span><b>{jobs.length}</b> live roles{jobsLoading ? " · loading" : ""}</span><span>Ranked by profile fit <CircleHelp size={14} /></span></div>{jobLoadError && <div className="provider-note"><ShieldCheck size={17} /><span>{jobLoadError}</span><button onClick={() => { setJobsLoaded(false); setJobLoadError(""); }}>Retry <ArrowRight size={14} /></button></div>}{unavailableJobSources.length > 0 && <div className="provider-note"><ShieldCheck size={17} /><span>Temporarily unavailable: {unavailableJobSources.join(", ")}. Showing available feeds.</span></div>}<div className="job-list">{jobs.map(job => <JobCard key={job.id} job={job} saved={savedJobs.includes(job.id)} applied={applications.some(a => a.job.id === job.id)} onSave={() => setSavedJobs(s => s.includes(job.id) ? s.filter(x => x !== job.id) : [...s, job.id])} onOpen={() => setActiveJob(job)} />)}{jobsLoading && jobs.length === 0 && <div className="empty-state"><LoaderCircle className="spin" size={24} /><h3>Loading live listings</h3><p>Checking {jobSources.length ? jobSources.join(" and ") : "free job feeds"}…</p></div>}{!jobsLoading && jobs.length === 0 && <div className="empty-state"><Search size={24} /><h3>{jobLoadError ? "Live listings unavailable" : "No roles match those filters"}</h3><p>{jobLoadError ? "Try again shortly." : "Try another keyword, salary, or location."}</p></div>}</div><div className="provider-note"><ShieldCheck size={17} /><span><b>Sources: {jobSources.length ? jobSources.join(" and ") : "Remotive and Jobicy"}.</b> Public feeds are cached for up to six hours; Remotive listings can be delayed by 24 hours. Filters save automatically to this workspace.</span><button onClick={() => { setJobsLoaded(false); setJobLoadError(""); }}>Refresh <ArrowRight size={14} /></button></div></>}
        {section === "Application Queue" && <><div className="page-heading"><div><div className="eyebrow">YOUR REVIEW</div><h1>Application queue</h1><p>Review each detail. You stay in control before anything is submitted.</p></div><span className="queue-count"><span>{pending.length}</span> awaiting review</span></div><div className="queue-tabs"><button className="selected">All applications <span>{applications.length}</span></button><button onClick={() => setMessage("Showing applications awaiting your review.")}>Needs review <span>{pending.length}</span></button><button onClick={() => setMessage("Application history is saved on this device.")}>History</button></div>{applications.length ? <div className="queue-list">{applications.map(app => <ApplicationCard key={app.id} app={app} onReview={() => setActiveApp(app.id)} />)}</div> : <div className="empty-state large"><div className="empty-icon"><ListChecks size={23} /></div><h3>Your queue is clear</h3><p>When you find a good fit, prepare an application and it will show up here for your review.</p><button className="primary-button" onClick={() => setSection("Find Jobs")}>Find live jobs <ArrowRight size={15} /></button></div>}<div className="approval-note"><ShieldCheck size={17} /><span><b>Approval is required.</b> Drafts never get sent automatically. If you edit a document after approval, you’ll need to approve the updated version again.</span></div></>}
        {section === "My Resume" && <ResumeSection profile={profile} setProfile={setProfile} fileName={fileName} onUpload={uploadResume} setMessage={setMessage} />}
        {section === "Profile" && <ProfileSection profile={profile} setProfile={setProfile} setMessage={setMessage} />}
        {section === "Analytics" && <AnalyticsSection applications={applications} jobs={jobs} />}
        {section === "Settings" && <SettingsSection setMessage={setMessage} authenticated={Boolean(userId)} storagePrefix={storagePrefix} />}
      </div>
    </main>
    {activeJob && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setActiveJob(null); }}><div className="modal job-modal"><button className="modal-close" onClick={() => setActiveJob(null)} aria-label="Close"><X size={19} /></button><div className="modal-company"><div className="company-mark">{activeJob.company[0]}</div><span>{activeJob.company} <span className="verified-dot">·</span> <small>{activeJob.source}</small></span></div><h2>{activeJob.title}</h2><div className="job-meta"><span><MapPin size={14} />{activeJob.location}</span><span><BriefcaseBusiness size={14} />{activeJob.type}</span><span><Target size={14} />{activeJob.salary}</span></div><div className="match-banner"><div className="match-ring">{activeJob.match}</div><div><b>Strong profile alignment</b><p>Based on your listed skills and preferences. This is a fit indicator, not a hiring probability.</p></div></div><h3>About the role</h3><p className="description">{activeJob.description}</p><h3>Skills that match</h3><div className="skill-pills">{activeJob.skills.map(s => <span key={s} className={profile.skills.some(p => p.toLowerCase() === s.toLowerCase()) ? "matched" : ""}>{profile.skills.some(p => p.toLowerCase() === s.toLowerCase()) && <Check size={12} />}{s}</span>)}</div><div className="modal-actions"><a href={activeJob.url} target="_blank" rel="noreferrer" className="secondary-button">View on {activeJob.source} <ArrowUpRight size={15} /></a><button className="primary-button" disabled={busy} onClick={() => prepareApplication(activeJob)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={15} />} Prepare for review</button></div><p className="modal-disclaimer"><ShieldCheck size={13} /> No application is sent without your approval.</p></div></div>}
    {currentApp && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setActiveApp(null); }}><div className="modal review-modal"><button className="modal-close" onClick={() => setActiveApp(null)} aria-label="Close"><X size={19} /></button><div className="eyebrow">APPLICATION REVIEW</div><div className="review-title"><div><h2>{currentApp.job.title}</h2><p>{currentApp.job.company} · {currentApp.job.location}</p></div><StatusBadge status={currentApp.status} /></div><div className="review-info"><span><ShieldCheck size={15} /> Nothing is sent before you approve</span><a href={currentApp.job.url} target="_blank" rel="noreferrer">View role <ArrowUpRight size={13} /></a></div><label className="document-label">TAILORED SUMMARY <span>AI draft · editable</span></label><textarea value={currentApp.summary} onChange={e => editApp(currentApp.id, "summary", e.target.value)} rows={3} disabled={currentApp.status === "Rejected" || currentApp.status === "Submitted"} /><label className="document-label">COVER LETTER <span>AI draft · editable</span></label><textarea value={currentApp.cover} onChange={e => editApp(currentApp.id, "cover", e.target.value)} rows={7} disabled={currentApp.status === "Rejected" || currentApp.status === "Submitted"} /><label className="document-label">APPLICATION ANSWERS <span>Confirm unknown details yourself</span></label><textarea value={currentApp.answers} onChange={e => editApp(currentApp.id, "answers", e.target.value)} rows={2} disabled={currentApp.status === "Rejected" || currentApp.status === "Submitted"} /><div className="truth-note"><ShieldCheck size={15} /><span>Review every claim for accuracy. Generated text should be checked before use.</span></div>{currentApp.approvalSnapshot && currentApp.approvalSnapshot !== contentSnapshot(currentApp) && <div className="stale-note"><Clock3 size={15} /> You edited this version after approval. Approve again before continuing.</div>}{currentApp.status === "Pending Review" || (currentApp.status === "Approved" && currentApp.approvalSnapshot !== contentSnapshot(currentApp)) ? <div className="modal-actions spread"><button className="reject-button" onClick={() => { reject(currentApp.id); setActiveApp(null); }}><XCircle size={16} /> Reject</button><button className="primary-button" onClick={() => approve(currentApp.id)}><CheckCircle2 size={16} /> Approve this version</button></div> : currentApp.status === "Approved" && currentApp.employerOpened ? <div className="modal-actions spread"><span className="approved-msg"><CheckCircle2 size={15} /> Approved · employer site opened</span><button className="primary-button" onClick={() => markSubmitted(currentApp.id)}><CheckCircle2 size={15} /> I submitted manually</button></div> : currentApp.status === "Approved" ? <div className="modal-actions spread"><span className="approved-msg"><CheckCircle2 size={15} /> Version approved</span><button className="primary-button" onClick={() => submit(currentApp.id)}><Send size={15} /> Continue to employer</button></div> : currentApp.status === "Rejected" ? <div className="rejected-msg"><XCircle size={16} /> Rejected applications cannot be submitted.</div> : <div className="submitted-msg"><CheckCircle2 size={16} /> Marked as submitted in this demo workspace.</div>}</div></div>}
    {notice && <div className="toast"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>;
}

function Dashboard({ profile, pending, applications, setSection, jobs, startSearch }: { profile: Profile; pending: Application[]; applications: Application[]; setSection: (s: Section) => void; jobs: Job[]; startSearch: () => void }) {
  const name = profile.name.trim().split(/\s+/)[0];
  const profileStrength = Math.round(([profile.name, profile.title, profile.location, profile.email, profile.summary, profile.skills.length > 0, profile.resumeText.length > 0].filter(Boolean).length / 7) * 100);
  const latestActivity = applications.reduce((latest, app) => Math.max(latest, Date.parse(app.createdAt) || 0), 0);
  const activity = Array.from({ length: 6 }, (_, index) => {
    const start = latestActivity - (5 - index) * 7 * 24 * 60 * 60 * 1000;
    const end = start + 7 * 24 * 60 * 60 * 1000;
    const inWeek = applications.filter(app => { const date = Date.parse(app.createdAt) || 0; return date >= start && date < end; });
    return { label: index === 5 ? "Latest" : `-${5 - index}w`, applications: inWeek.length, reviews: inWeek.filter(app => app.status !== "Pending Review").length };
  });
  const activityPeak = Math.max(1, ...activity.flatMap(week => [week.applications, week.reviews]));
  return <><div className="welcome-row"><div><div className="eyebrow">YOUR SEARCH OVERVIEW</div><h1>{name ? `Welcome, ${name}` : "Your job search"} <span className="wave">✳</span></h1><p>Here’s where your job search stands today.</p></div><button className="primary-button" onClick={startSearch}><Search size={16} /> Find roles <ArrowRight size={15} /></button></div><div className="stats-grid"><div className="stat-card"><div className="stat-head"><span>PROFILE MATCHES</span><span className="stat-icon blue"><Target size={16} /></span></div><strong>{jobs.length}</strong><div className="stat-foot"><span className="positive"><ArrowUpRight size={13} /> {jobs.filter(j => j.match >= 85).length} strong fits</span><span>in current feed</span></div></div><div className="stat-card"><div className="stat-head"><span>NEEDS YOUR REVIEW</span><span className="stat-icon amber"><Clock3 size={16} /></span></div><strong>{pending.length.toString().padStart(2, "0")}</strong><div className="stat-foot"><span>{pending.length ? "Ready when you are" : "Queue is clear"}</span><button onClick={() => setSection("Application Queue")}>View queue <ArrowRight size={12} /></button></div></div><div className="stat-card"><div className="stat-head"><span>APPLICATIONS SENT</span><span className="stat-icon green"><Send size={16} /></span></div><strong>{applications.filter(a => a.status === "Submitted").length.toString().padStart(2, "0")}</strong><div className="stat-foot"><span>Recorded applications</span><span>this month</span></div></div><div className="stat-card"><div className="stat-head"><span>PROFILE STRENGTH</span><span className="stat-icon purple"><Sparkles size={16} /></span></div><strong>{profileStrength}<small className="unit">/100</small></strong><div className="stat-foot"><span>{profile.resumeText ? "Resume added" : "Add a resume to improve fit"}</span><button onClick={() => setSection("My Resume")}>Improve <ArrowRight size={12} /></button></div></div></div><div className="dashboard-grid"><section className="content-card recent-card"><div className="card-heading"><div><h2>Recommended for you</h2><p>Live roles matched to your profile</p></div><button className="text-link" onClick={startSearch}>View all <ArrowRight size={14} /></button></div>{jobs.slice(0, 3).map(job => <div className="mini-job" key={job.id}><div className="company-mark small-mark">{job.company[0]}</div><div className="mini-job-main"><b>{job.title}</b><span>{job.company} <i>·</i> {job.location.split("·")[0]}</span></div><div className="mini-match"><b>{job.match}%</b><span>match</span></div><button className="row-arrow" onClick={() => setSection("Find Jobs")} aria-label={`Explore ${job.title}`}><ArrowRight size={16} /></button></div>)}</section><section className="content-card progress-card"><div className="card-heading"><div><h2>Search momentum</h2><p>Your activity at a glance</p></div><span className="period-label">THIS MONTH <ChevronDown size={12} /></span></div><div className="chart-legend"><span><i className="legend-blue" /> Applications</span><span><i className="legend-gray" /> Reviews</span></div><div className="chart-placeholder"><div className="chart-y" /><div className="chart-area"><div className="chart-lines"><i /><i /><i /><i /><i /></div><div className="bars">{activity.map((week, i) => <div className="bar-group" key={i}><i className="bar-blue" style={{ height: `${week.applications / activityPeak * 100}%` }} /><i className="bar-gray" style={{ height: `${week.reviews / activityPeak * 100}%` }} /></div>)}</div><div className="chart-x">{activity.map(week => <span key={week.label}>{week.label}</span>)}</div></div></div><p className="chart-footnote">Activity appears here as you use ApplyPilot.</p></section></div><section className="checklist-card"><div className="checklist-head"><div className="checklist-symbol"><Check size={16} /></div><div><h2>A stronger profile, better matches</h2><p>Finish a few details to get more relevant recommendations.</p></div><div className="check-progress"><b>{profile.resumeText ? "3" : "2"}<span>/4</span></b><div className="progress-track"><i style={{ width: profile.resumeText ? "75%" : "50%" }} /></div></div></div><div className="checklist-items"><button onClick={() => setSection("Profile")}><span className="check-circle done"><Check size={12} /></span><span>Personal details</span><ArrowRight size={13} /></button><button onClick={() => setSection("My Resume")}><span className={`check-circle ${profile.resumeText ? "done" : ""}`}>{profile.resumeText ? <Check size={12} /> : "2"}</span><span>Add your resume</span><ArrowRight size={13} /></button><button onClick={() => setSection("Profile")}><span className="check-circle done"><Check size={12} /></span><span>Choose role preferences</span><ArrowRight size={13} /></button><button onClick={startSearch}><span className="check-circle">4</span><span>Set job filters</span><ArrowRight size={13} /></button></div></section><div className="dashboard-foot"><span><ShieldCheck size={14} /> You’re in control. Each application needs your approval.</span><button onClick={() => setSection("Settings")}>How your data is used <ArrowRight size={12} /></button></div></>;
}

function JobCard({ job, saved, applied, onSave, onOpen }: { job: Job; saved: boolean; applied: boolean; onSave: () => void; onOpen: () => void }) {
  return <article className="job-card"><div className="company-mark">{job.company[0]}</div><div className="job-main"><div className="job-top"><div><div className="job-title-row"><h2>{job.title}</h2><span className="posted">{job.posted}</span></div><div className="company-line">{job.company} <i>·</i> {job.location}</div></div><button className={`save-button ${saved ? "saved" : ""}`} onClick={onSave} aria-label={saved ? "Unsave job" : "Save job"}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button></div><div className="job-tags"><span><BriefcaseBusiness size={13} />{job.type}</span><span><Target size={13} />{job.salary}</span><span><MapPin size={13} />{job.remote}</span></div><div className="job-card-bottom"><div className="skill-pills compact">{job.skills.slice(0, 3).map(s => <span key={s}>{s}</span>)}{job.skills.length > 3 && <span>+{job.skills.length - 3}</span>}</div><div className="job-cta"><div className="match-score"><strong>{job.match}</strong><span>% fit</span></div>{applied ? <span className="already-added"><Check size={14} /> In queue</span> : <button className="secondary-button" onClick={onOpen}>View match <ArrowRight size={14} /></button>}</div></div><div className="source-label">Source: <a href={job.url} target="_blank" rel="noreferrer">{job.source}</a></div></div></article>;
}
function StatusBadge({ status }: { status: Application["status"] }) { const cls = status.toLowerCase().replaceAll(" ", "-"); return <span className={`status-badge ${cls}`}><i />{status}</span>; }
function ApplicationCard({ app, onReview }: { app: Application; onReview: () => void }) { return <div className="application-card"><div className="company-mark">{app.job.company[0]}</div><div className="application-main"><div className="application-top"><div><h3>{app.job.title}</h3><span>{app.job.company} <i>·</i> {app.job.location}</span></div><StatusBadge status={app.status} /></div><div className="application-bottom"><span><Clock3 size={13} /> Prepared {new Date(app.createdAt).toLocaleDateString()}</span><span><FileText size={13} /> Summary and cover letter ready</span><button onClick={onReview}>Review application <ArrowRight size={14} /></button></div></div></div>; }

function ResumeSection({ profile, setProfile, fileName, onUpload, setMessage }: { profile: Profile; setProfile: (p: Profile) => void; fileName: string; onUpload: (file?: File) => void; setMessage: (msg: string) => void }) {
  return <><div className="page-heading"><div><div className="eyebrow">YOUR MATERIALS</div><h1>My resume</h1><p>Keep your source resume private. Review parsed text before it’s used in a draft.</p></div></div><div className="resume-layout"><section className="content-card upload-card"><div className="upload-icon"><FileText size={22} /></div><h2>{fileName || "Upload your resume"}</h2><p>PDF or DOCX, up to 8 MB. Text is extracted in this browser and saved in your account profile.</p><label className="primary-button upload-button"><Upload size={15} /> Choose a file<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => onUpload(e.target.files?.[0])} /></label><span className="supported-note"><ShieldCheck size={13} /> Your document isn’t uploaded in demo mode</span></section><section className="content-card resume-details"><div className="card-heading"><div><h2>Resume content</h2><p>{profile.resumeText ? `${profile.resumeText.length.toLocaleString()} characters extracted` : "No resume text added yet"}</p></div><span className="source-chip">{profile.resumeText ? "Extracted text" : "Empty"}</span></div>{profile.resumeText ? <><textarea className="resume-textarea" value={profile.resumeText} onChange={e => setProfile({ ...profile, resumeText: e.target.value })} /><div className="resume-empty-tip">Review and correct extracted content before using it. Original uploaded file is not stored in this demo.</div></> : <div className="resume-placeholder"><FileText size={22} /><p>Upload a resume to review extracted text.</p><small>Nothing is sent to an external service in demo mode.</small></div>}</section></div><div className="provider-note"><ShieldCheck size={17} /><span><b>Resume tailoring stays factual.</b> Generated drafts may reorganize and rephrase verified information. Always review for accuracy.</span><button onClick={() => setMessage("Original resume remains unchanged in the production design.")}>How it works <ArrowRight size={14} /></button></div></>;
}
function ProfileSection({ profile, setProfile, setMessage }: { profile: Profile; setProfile: (p: Profile) => void; setMessage: (msg: string) => void }) {
  const [skills, setSkills] = useState(profile.skills.join(", "));
  return <><div className="page-heading"><div><div className="eyebrow">YOUR INFORMATION</div><h1>Profile</h1><p>Keep your details up to date so recommendations stay relevant.</p></div><button className="primary-button" onClick={() => { setProfile({ ...profile, skills: skills.split(",").map(s => s.trim()).filter(Boolean) }); setMessage("Profile saved."); }}><Check size={15} /> Save changes</button></div><div className="content-card profile-form"><div className="profile-section-title"><div className="avatar large-avatar">{profile.name.split(" ").map(s => s[0]).join("").slice(0, 2)}</div><div><h2>Personal details</h2><p>Used to personalize your workspace and documents.</p></div></div><div className="form-grid"><label>Full name<input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label><label>Professional title<input value={profile.title} onChange={e => setProfile({ ...profile, title: e.target.value })} /></label><label>Email address<input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} /></label><label>Current location<input value={profile.location} onChange={e => setProfile({ ...profile, location: e.target.value })} /></label><label className="full-field">Professional summary<textarea rows={3} value={profile.summary} onChange={e => setProfile({ ...profile, summary: e.target.value })} /></label><label className="full-field">Education <span className="label-help">Degree, school, and graduation year</span><textarea rows={3} value={profile.education} onChange={e => setProfile({ ...profile, education: e.target.value })} /></label><label className="full-field">Skills <span className="label-help">Separate each skill with a comma</span><input value={skills} onChange={e => setSkills(e.target.value)} /></label><label className="full-field">Resume text <span className="label-help">Used as the source for truthful tailored drafts</span><textarea rows={5} value={profile.resumeText} onChange={e => setProfile({ ...profile, resumeText: e.target.value })} placeholder="Add or paste verified experience, dates, and accomplishments…" /></label></div><div className="form-footer"><ShieldCheck size={15} /><span>Keep personal and eligibility details accurate. Unknown answers are left for you to complete.</span></div></div></>;
}
function AnalyticsSection({ applications, jobs }: { applications: Application[]; jobs: Job[] }) { const sent = applications.filter(a => a.status === "Submitted").length; const pending = applications.filter(a => a.status === "Pending Review").length; return <><div className="page-heading"><div><div className="eyebrow">YOUR PROGRESS</div><h1>Analytics</h1><p>Only records in this workspace are counted. Feed listings are excluded from activity totals.</p></div><span className="demo-tag">LOCAL WORKSPACE</span></div><div className="stats-grid"><div className="stat-card"><div className="stat-head"><span>APPLICATIONS</span><span className="stat-icon blue"><Send size={16} /></span></div><strong>{sent}</strong><div className="stat-foot"><span>Marked submitted</span></div></div><div className="stat-card"><div className="stat-head"><span>AWAITING REVIEW</span><span className="stat-icon amber"><Clock3 size={16} /></span></div><strong>{pending}</strong><div className="stat-foot"><span>Pending your decision</span></div></div><div className="stat-card"><div className="stat-head"><span>IN YOUR QUEUE</span><span className="stat-icon green"><ListChecks size={16} /></span></div><strong>{applications.length}</strong><div className="stat-foot"><span>All statuses</span></div></div><div className="stat-card"><div className="stat-head"><span>LIVE ROLES</span><span className="stat-icon purple"><Heart size={16} /></span></div><strong>{jobs.length}</strong><div className="stat-foot"><span>Matching current filters</span></div></div></div><div className="content-card analytics-explainer"><div className="empty-icon"><Gauge size={22} /></div><div><h2>Meaningful metrics, as you go</h2><p>Response rates and skill trends will appear after verified submissions and outcomes are recorded. There are no fabricated performance statistics here.</p></div></div></>; }
function SettingsSection({ setMessage, authenticated, storagePrefix }: { setMessage: (msg: string) => void; authenticated: boolean; storagePrefix: string }) { return <><div className="page-heading"><div><div className="eyebrow">PREFERENCES & CONNECTIONS</div><h1>Settings</h1><p>Job filters save automatically. Feed providers are public and need no API keys.</p></div></div><div className="settings-list"><div className="settings-row"><div className="settings-icon"><Link2 size={18} /></div><div className="settings-main"><h3>Supabase database</h3><p>Save profile and search preferences to your account when Supabase is connected.</p></div><span className="connection-state">{authenticated ? "Account sync on" : "Browser storage"}</span><button className="secondary-button" onClick={() => setMessage("Add Supabase URL and anon key to .env.local to sync preferences across devices.")}>Setup guide <ArrowRight size={14} /></button></div><div className="settings-row"><div className="settings-icon violet"><Sparkles size={18} /></div><div className="settings-main"><h3>AI document generation</h3><p>Generate structured, editable drafts using your verified profile and job information.</p></div><span className="connection-state">Optional</span><button className="secondary-button" onClick={() => setMessage("Add OPENAI_API_KEY to .env.local. Draft fallback remains available without it.")}>Setup guide <ArrowRight size={14} /></button></div><div className="settings-row"><div className="settings-icon green-icon"><BriefcaseBusiness size={18} /></div><div className="settings-main"><h3>Live job sources</h3><p>Remotive and Jobicy public APIs provide current remote roles, source links, and attribution.</p></div><span className="connection-state demo-state">Free feeds</span><button className="secondary-button" onClick={() => setMessage("Feeds are cached for up to six hours. Remotive listings may be delayed by 24 hours.")}>Source details <ArrowRight size={14} /></button></div><div className="settings-row"><div className="settings-icon"><ShieldCheck size={18} /></div><div className="settings-main"><h3>Application approvals</h3><p>Automatic submissions are disabled. Every version requires your explicit review.</p></div><span className="connection-state demo-state">Always on</span><button className="secondary-button" onClick={() => setMessage("Approval is bound to the exact text version. Edits clear the approval.")}>Learn more <ArrowRight size={14} /></button></div></div><div className="settings-bottom"><div><h3>Data controls</h3><p>{authenticated ? "Your profile and search preferences sync to your account. Applications remain on this browser." : "Profile, filters, and queue data are stored only in this browser."}</p></div><div className="settings-bottom-actions"><button className="danger-button" onClick={() => { localStorage.removeItem(`${storagePrefix}-profile`); localStorage.removeItem(`${storagePrefix}-applications`); localStorage.removeItem(`${storagePrefix}-saved-jobs`); localStorage.removeItem(`${storagePrefix}-search-preferences`); window.location.reload(); }}>Clear local profile</button>{authenticated && <button className="secondary-button" onClick={async () => { const { error } = await createSupabaseClient().auth.signOut(); if (error) setMessage("Could not sign out. Try again."); else window.location.assign("/login"); }}>Sign out</button>}</div></div></>; }
