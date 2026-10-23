"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, GitBranch, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import SignalShader from "./SignalShader";

export default function AuthScreen(_props: { onAuth: (u: User) => void; sandbox: boolean }) {
  const [googleUrl, setGoogleUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function loadProvider(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ googleUrl: string }>("/auth/providers", { signal });
      if (!result.googleUrl) throw new Error("Google sign-in is temporarily unavailable. Please try again shortly.");
      const url = new URL(result.googleUrl);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/auth/v1/authorize') throw new Error('Google sign-in could not be started.');
      if (!signal?.aborted) setGoogleUrl(result.googleUrl);
    } catch (err) {
      if (!signal?.aborted) setError((err as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    loadProvider(controller.signal);
    return () => controller.abort();
  }, []);
  return <div className="auth-shell">
    <section className="auth-story">
      <Link href="/" className="auth-brand" style={{textDecoration:'none',display:'flex',alignItems:'center'}}><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>contrigraph.</Link>
      <div className="auth-copy"><h1>Great teams make<br/>room for everyone.</h1><p>See what needs doing, understand what’s holding it up, and find a plan your team can actually deliver.</p><div className="auth-diagram"><div><span>Plan the work</span><GitBranch size={24}/></div><span className="diagram-connector"/><div><span>Test the recovery</span><span className="auth-forecast">+3d <ArrowRight size={16}/> On time</span></div><span className="diagram-connector"/><div><span>Give fair credit</span><ShieldCheck size={24}/></div></div><p className="auth-footnote">Skill-aware planning. Explainable forecasts.<br/>Every decision stays with your team.</p></div>
      <SignalShader/><span className="auth-copyright">ContriGraph · Built for student teams</span>
    </section>
    <section className="auth-form-side"><div className="auth-form">
      <div className="auth-public-links"><Link href="/">← Product home</Link><Link href="/help">Help & guides</Link></div>
      <h2>Your team starts here.</h2><p>Continue with your Google account to create a workspace or return to your team.</p>
      {loading ? <div className="google-login-state" role="status">Preparing Google sign-in…</div> : googleUrl ? <a className="google-signin google-only" href={googleUrl}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.88 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>Continue with Google<ArrowRight size={17}/></a> : null}
      {error && <div className="form-error" role="alert">{error}<button className="cg-text" onClick={()=>loadProvider()}>Try again</button></div>}
      <p className="google-login-note">One account for signing up and signing in. No separate ContriGraph password needed.</p>
    </div></section>
  </div>;
}
