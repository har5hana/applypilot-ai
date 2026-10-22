"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "reset" | "recovery";

export default function LoginPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the auth redirect mode after the browser URL is available.
    if (new URLSearchParams(window.location.search).get("mode") === "recovery") setMode("recovery");
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });
    return () => subscription.unsubscribe();
  }, [configured]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!configured) { setMessage("Add your Supabase URL and anon key to .env.local to use accounts."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "recovery") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated. Opening your workspace…"); window.location.assign("/dashboard");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/dashboard");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        setMessage(data.session ? "Account created. Opening your workspace…" : "Check your email to confirm your account, then sign in.");
        if (data.session) window.location.assign("/dashboard");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?mode=recovery` });
        if (error) throw error;
        setMessage("If an account exists for that email, a reset link is on its way.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not complete that request. Try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><div className="auth-art"><Link href="/" className="brand auth-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>applypilot<span className="brand-ai">.ai</span></span></Link><div className="auth-art-copy"><span className="section-kicker">YOUR SEARCH, YOUR CALL</span><h1>A thoughtful next step<br /><em>starts with you.</em></h1><p>Find aligned roles. Prepare honest materials. Review each application before you continue.</p></div><div className="auth-art-footer"><ShieldCheck size={14} /> Every application stays in your hands.</div><div className="auth-orb orb-one" /><div className="auth-orb orb-two" /></div><section className="auth-form-side"><div className="auth-form-box"><Link href="/" className="auth-back"><ArrowLeft size={14} /> Back to ApplyPilot</Link><div className="auth-mobile-logo"><span className="brand-mark"><Sparkles size={17} /></span> applypilot<span>.ai</span></div><div className="eyebrow">{configured ? "YOUR PERSONAL WORKSPACE" : "LOCAL PREVIEW"}</div><h2>{mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "recovery" ? "Choose a new password" : "Reset your password"}</h2><p className="auth-intro">{configured ? mode === "login" ? "Sign in to pick up where you left off." : mode === "signup" ? "One profile. A more focused search." : "We’ll email you a secure reset link." : "Personal accounts need Supabase Auth. Add your project URL and anon key in .env.local to enable sign-in and account creation."}</p>{configured ? <form className="auth-form" onSubmit={submit}>{mode === "signup" && <label>Full name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" /></label>}{mode !== "recovery" && <label>Email address<input autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></label>}{mode !== "reset" && <label>Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" /></label>}{mode === "login" && <button type="button" className="forgot-link" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot password?</button>}<button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "recovery" ? "Save new password" : "Send reset link"}<ArrowRight size={15} /></button></form> : <Link href="/dashboard" className="primary-button auth-submit">Open sample workspace <ArrowRight size={15} /></Link>}{message && <div className="auth-message" role="status">{message}</div>}{configured && <div className="auth-mode">{mode === "login" ? <>New to ApplyPilot? <button onClick={() => { setMode("signup"); setMessage(""); }}>Create an account</button></> : <>Already have an account? <button onClick={() => { setMode("login"); setMessage(""); }}>Sign in</button></>}</div>}<div className="auth-security"><ShieldCheck size={14} /><span>Credentials use Supabase Auth. API secrets stay server-side.</span></div></div></section></main>;
}
