"use client";
import {
  ClerkProvider,
  useAuth,
  useClerk,
  HandleSSOCallback,
  SignIn,
  SignUp,
  RedirectToTasks,
} from "@clerk/react";
import { useEffect, useState, type ReactNode } from "react";
import { setSessionToken } from "@/lib/api";
import AuthScreen from "./AuthScreen";
import Workspace from "./Workspace";

const app = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/app/`;
export function IdentityProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key)
    return (
      <div className="cg-loading" role="alert">
        Sign-in is not configured. Please contact the project owner.
      </div>
    );
  return (
    <ClerkProvider
      publishableKey={key}
      signInUrl={app}
      signUpUrl={app + "?signup=1"}
      afterSignOutUrl={app}
    >
      {children}
    </ClerkProvider>
  );
}

export function ClerkWorkspace() {
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth();
  const { signOut } = useClerk();
  const [bound, setBound] = useState<string | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    setSessionToken(isSignedIn ? () => getToken() : null);
    setBound(sessionId || "signed-out");
    return () => setSessionToken(null);
  }, [isLoaded, isSignedIn, getToken, sessionId]);
  if (!isLoaded || bound !== (sessionId || "signed-out"))
    return (
      <div className="cg-loading" role="status">
        Opening your workspace…
      </div>
    );
  if (!isSignedIn) return <AuthScreen />;
  return (
    <Workspace
      key={sessionId}
      onSignOut={async () => {
        await signOut({ redirectUrl: app });
      }}
    />
  );
}

export function OAuthCallback() {
  const [step, setStep] = useState("callback");
  if (step === "signup")
    return (
      <div className="cg-loading">
        <SignUp routing="hash" forceRedirectUrl={app} />
      </div>
    );
  if (step === "tasks") return <RedirectToTasks />;
  if (step === "signin")
    return (
      <div className="cg-loading">
        <SignIn routing="hash" forceRedirectUrl={app} />
      </div>
    );
  return (
    <div className="cg-loading">
      <HandleSSOCallback
        navigateToApp={({ session, decorateUrl }) => {
          if (session?.currentTask) {
            setStep("tasks");
            return;
          }
          window.location.assign(decorateUrl(app));
        }}
        navigateToSignIn={() => setStep("signin")}
        navigateToSignUp={() => setStep("signup")}
      />
    </div>
  );
}
