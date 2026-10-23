"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, GitBranch, ShieldCheck } from "@phosphor-icons/react";
import { SignIn, SignUp } from "@clerk/react";
import SignalShader from "./SignalShader";

export default function AuthScreen() {
  const [signup, setSignup] = useState(false);
  useEffect(() => {
    setSignup(new URLSearchParams(window.location.search).has("signup"));
  }, []);
  const app = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/app/`;
  const appearance = {
    variables: {
      colorPrimary: "#285548",
      colorText: "#252b26",
      colorBackground: "#fffdf8",
      colorInputBackground: "#fffdf8",
      borderRadius: "10px",
      fontFamily: "inherit",
    },
    elements: {
      rootBox: { width: "100%" },
      cardBox: { width: "100%", boxShadow: "none" },
      card: {
        padding: "20px 0",
        boxShadow: "none",
        border: "none",
        background: "transparent",
      },
      header: { display: "none" },
      footer: { background: "transparent" },
    },
  };
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Link
          href="/"
          className="auth-brand"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          contrigraph.
        </Link>
        <div className="auth-copy">
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
          <div className="auth-public-links">
            <Link href="/">← Product home</Link>
            <Link href="/help">Help & guides</Link>
          </div>
          <h2>
            {signup ? "Bring your team together." : "Your team starts here."}
          </h2>
          <p>
            Use Google or your email to create an account or return to your
            team.
          </p>
          {signup ? (
            <SignUp
              routing="hash"
              forceRedirectUrl={app}
              appearance={appearance}
              signInUrl={app}
            />
          ) : (
            <SignIn
              routing="hash"
              forceRedirectUrl={app}
              appearance={appearance}
              signUpUrl={app + "?signup=1"}
            />
          )}
          <p className="google-login-note">
            <Link href="/privacy">How we handle your information</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
