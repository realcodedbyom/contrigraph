"use client";
import { SignIn, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { IdentityProvider } from "./ClerkAccess";

function LoginForm() {
  const { isLoaded, isSignedIn } = useAuth();
  const app = `${process.env.NEXT_PUBLIC_APP_BASE_PATH || ""}/app/`;
  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(app);
  }, [isLoaded, isSignedIn, app]);
  if (isSignedIn) return <p role="status">Opening your workspace…</p>;
  return (
    <SignIn
      routing="hash"
      forceRedirectUrl={app}
      signUpUrl={app + "?signup=1"}
      appearance={{
        variables: {
          colorPrimary: "#285548",
          colorForeground: "#273323",
          colorBackground: "#fffdf8",
          fontFamily: "inherit",
          borderRadius: "10px",
        },
        elements: {
          rootBox: { width: "100%" },
          cardBox: { width: "100%", boxShadow: "none" },
          card: { boxShadow: "none", border: "none" },
        },
      }}
    />
  );
}
export default function PublicLogin() {
  return (
    <IdentityProvider>
      <LoginForm />
    </IdentityProvider>
  );
}
