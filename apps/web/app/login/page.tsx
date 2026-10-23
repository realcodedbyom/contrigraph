import type { Metadata } from "next";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import PublicLogin from "@/components/PublicLogin";

const url = "https://dsvv.live/contrigraph/login/";
export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to ContriGraph with Google or email to open your team workspace, join a project, and manage your shared plan.",
  alternates: { canonical: url },
  openGraph: {
    title: "Log in to ContriGraph",
    description: "Return to your shared project plan with Google or email.",
    url,
  },
};
export default function LoginPage() {
  return (
    <div className="public-site">
      <PublicNav />
      <main className="public-login">
        <section>
          <h1>Log in to ContriGraph.</h1>
          <p>
            Return to your team’s projects, shared workload, and next steps. Use
            Google or the email you registered with.
          </p>
          <PublicLogin />
        </section>
        <aside>
          <h2>Joining a team?</h2>
          <p>
            Create an account first, then use your project invitation code in
            the workspace to claim your team member entry.
          </p>
          <h2>Need a hand signing in?</h2>
          <p>
            Email signup requires verification. Use the latest code from your
            inbox. Account recovery is available in the sign-in form.
          </p>
          <Link href="/faq#accounts">Account FAQs →</Link>
          <Link href="/help#account">Sign-in and verification guide →</Link>
          <Link href="/privacy">How we handle your information →</Link>
        </aside>
      </main>
      <footer className="public-footer">
        <Link href="/">Product</Link>
        <Link href="/faq">FAQs</Link>
        <Link href="/help">Help & guides</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
