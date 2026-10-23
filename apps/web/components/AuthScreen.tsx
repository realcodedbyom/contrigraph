"use client";
import { useState } from "react";
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Flask,
} from "@phosphor-icons/react";
import { post } from "@/lib/api";
import { User } from "@/lib/types";
import SignalShader from "./SignalShader";
export default function AuthScreen({
  onAuth,
  sandbox,
}: {
  onAuth: (u: User) => void;
  sandbox: boolean;
}) {
  const [register, setRegister] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          contrigraph.
        </div>
        <div className="auth-copy">
          <div className="eyebrow">A SHARED PLAN. A FAIRER WAY TO BUILD.</div>
          <h1>
            Great teams make
            <br />
            room for everyone.
          </h1>
          <p>
            See what needs doing, understand what’s holding it up, and find a
            plan your team can actually deliver.
          </p>
          <div className="auth-diagram">
            <div>
              <span>Plan the work</span>
              <GitBranch size={24} />
            </div>
            <span className="diagram-connector" />
            <div>
              <span>Test the recovery</span>
              <span className="auth-forecast">
                +3d <ArrowRight size={16} /> On time
              </span>
            </div>
            <span className="diagram-connector" />
            <div>
              <span>Give fair credit</span>
              <ShieldCheck size={24} />
            </div>
          </div>
          <p className="auth-footnote">
            Skill-aware planning. Explainable forecasts.
            <br />
            Every decision stays with your team.
          </p>
        </div>
        <SignalShader />
        <span className="auth-copyright">
          ContriGraph · Built for student teams
        </span>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <div className="eyebrow">YOUR TEAM’S NEXT CHAPTER</div>
          <h2>{register ? "Start building together." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create your account and give your team a shared workspace."
              : "Sign in to pick up where your team left off."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setMessage("");
              const d = new FormData(e.currentTarget);
              try {
                const result = await post<
                  User & { confirmationRequired?: boolean; message?: string }
                >(
                  register ? "/auth/register" : "/auth/login",
                  Object.fromEntries(d),
                );
                if (result.confirmationRequired) {
                  setConfirmationSent(true);
                  setMessage(
                    result.message || "Confirm your email, then sign in.",
                  );
                  setRegister(false);
                } else onAuth(result);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="How should we call you?"
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="form-success" role="status">
                {message}
              </div>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy ? "Connecting…" : register ? "Create account" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          {!register && confirmationSent && (
            <button
              className="cg-text"
              disabled={busy}
              onClick={async () => {
                setError("");
                setMessage("");
                if (!email.trim()) {
                  setError("Enter your email address above first.");
                  return;
                }
                setBusy(true);
                try {
                  const result = await post<{ message: string }>(
                    "/auth/resend",
                    { email },
                  );
                  setMessage(result.message);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend verification email
            </button>
          )}
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to ContriGraph?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          {sandbox && (
            <>
              <div className="auth-divider">
                <span>EXPLORE BEFORE YOU SIGN UP</span>
              </div>
              <button
                className="button secondary full-width"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    onAuth(await post<User>("/auth/sandbox", {}));
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Flask size={17} />
                Open an isolated sandbox
              </button>
              <p className="form-note">
                A separate workspace with example tasks. It does not create a
                Supabase account.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
