"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { ArrowRight, FileText, ShieldCheck, Sparkles, Upload, UserRound } from "lucide-react";

export type OnboardingProfile = {
  name: string;
  title: string;
  location: string;
  email: string;
  skills: string[];
  education: string;
  summary: string;
  resumeText: string;
};

export default function Onboarding({ profile, setProfile, onUpload, fileName, message, onComplete }: {
  profile: OnboardingProfile;
  setProfile: (profile: OnboardingProfile) => void;
  onUpload: (file?: File) => void;
  fileName: string;
  message: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<"start" | "details">("start");
  const [skillText, setSkillText] = useState(profile.skills.join(", "));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the editable skills field in sync with fields parsed from a resume.
  useEffect(() => setSkillText(profile.skills.join(", ")), [profile.skills]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpload(file);
    setStep("details");
  }

  function update<K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) {
    setProfile({ ...profile, [key]: value });
  }

  return <main className="onboarding-page"><div className="onboarding-card">
    <div className="onboarding-brand"><span className="brand-mark"><Sparkles size={18} /></span><b>applypilot<span>.ai</span></b></div>
    <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
    {step === "start" ? <>
      <h1>Let’s build your profile</h1><p className="onboarding-lead">Add your resume and we’ll find profile details for you to review. Prefer to start from scratch? Enter your details yourself.</p>
      <label className="onboarding-upload"><Upload size={20} /><b>Upload your resume</b><span>PDF or DOCX, up to 8 MB. We’ll extract the text in your browser.</span><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseFile} /></label>
      <div className="onboarding-or">OR</div><button className="secondary-button onboarding-manual" onClick={() => setStep("details")}><UserRound size={16} /> Enter details manually</button>
    </> : <>
      <h1>Review your details</h1><p className="onboarding-lead">{fileName ? `We read ${fileName}. Check the extracted details and correct anything that’s off.` : "Fill in the details you want ApplyPilot to use for job matches and application drafts."}</p>
      {message && <p className="onboarding-message" role="status">{message}</p>}
      <div className="onboarding-fields">
        <label>Full name<input autoComplete="name" value={profile.name} onChange={e => update("name", e.target.value)} placeholder="Your name" /></label>
        <label>Email address<input type="email" autoComplete="email" value={profile.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" /></label>
        <label>Professional title<input value={profile.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Product designer" /></label>
        <label>Location<input autoComplete="address-level2" value={profile.location} onChange={e => update("location", e.target.value)} placeholder="City, region" /></label>
        <label className="onboarding-wide">Skills <span className="label-help">Comma separated; extracted skills are editable</span><textarea rows={3} value={skillText} onChange={e => { setSkillText(e.target.value); update("skills", e.target.value.split(",").map(skill => skill.trim()).filter(Boolean)); }} placeholder="Research, Figma, project management" /></label>
        <label className="onboarding-wide">Education <span className="label-help">Add your degree, school, and graduation year if you want</span><textarea rows={3} value={profile.education} onChange={e => update("education", e.target.value)} placeholder="Degree and school" /></label>
        <label className="onboarding-wide">Professional summary<textarea rows={3} value={profile.summary} onChange={e => update("summary", e.target.value)} placeholder="A short summary of your experience" /></label>
      </div>
      {profile.resumeText && <details className="onboarding-resume"><summary><FileText size={15} /> Review extracted resume text</summary><textarea rows={7} value={profile.resumeText} onChange={e => update("resumeText", e.target.value)} /></details>}
      <div className="onboarding-actions"><button className="secondary-button" onClick={() => setStep("start")}>Back</button><button className="primary-button" disabled={!profile.name.trim()} onClick={() => { update("skills", skillText.split(",").map(skill => skill.trim()).filter(Boolean)); onComplete(); }}>Open my workspace <ArrowRight size={15} /></button></div>
    </>}
    <div className="onboarding-privacy"><ShieldCheck size={14} /> Your resume is parsed locally in this browser. Review all extracted details before using them.</div>
  </div></main>;
}
