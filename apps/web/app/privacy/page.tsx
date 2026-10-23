import type { Metadata } from "next";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How ContriGraph handles account details, project information, and sign-in data.",
  alternates: { canonical: "https://dsvv.live/contrigraph/privacy/" },
};

export default function PrivacyPage() {
  return (
    <div className="public-site">
      <PublicNav />
      <main className="help-main">
        <header className="help-intro">
          <p className="public-kicker">YOUR INFORMATION</p>
          <h1>Privacy, in plain language.</h1>
          <p>
            How this ContriGraph installation handles your information. Updated
            October 24, 2026.
          </p>
        </header>
        <div className="guide-articles">
          <article>
            <h2>Account and project information</h2>
            <p>
              ContriGraph stores your name, email address, and account
              identifier to connect you to your workspaces. It also stores the
              project information your team submits: tasks, estimates, skills,
              calendars, comments, progress updates, activity history, and
              attachments.
            </p>
            <p>
              Workload hours are estimates entered by your team. ContriGraph
              does not record your screen, keystrokes, or time spent using other
              applications.
            </p>
          </article>
          <article>
            <h2>Why the information is used</h2>
            <p>
              Your information supports sign-in, team membership, planning,
              workload forecasts, approvals, and contribution history. Project
              content is available to authorized members of that project. Team
              leads can manage their team’s project settings and assignments.
            </p>
            <p>
              Server and authentication logs may include technical information
              such as IP addresses, request times, and sign-in events for
              operation and security.
            </p>
          </article>
          <article>
            <h2>Sign-in and storage providers</h2>
            <p>
              Clerk handles Google and email authentication, verification, and
              account recovery. Google sign-in requests basic profile and email
              information. Project data is stored in Supabase PostgreSQL, with
              the application hosted on a separate server.
            </p>
            <p>
              For information about the providers and their privacy practices, see:{" "}
              <a href="https://clerk.com/legal/privacy">Clerk privacy policy</a>
              ,{" "}
              <a href="https://supabase.com/privacy">Supabase privacy policy</a>
              , and{" "}
              <a href="https://policies.google.com/privacy">
                Google privacy policy
              </a>
              .
            </p>
          </article>
          <article>
            <h2>Cookies and shared computers</h2>
            <p>
              Sign-in uses cookies and related browser storage to maintain and
              protect your session. Sign out when using a shared computer.
              Public product and help pages do not display your private project
              content.
            </p>
          </article>
          <article>
            <h2>Access, corrections, and deletion</h2>
            <p>
              To request access to, correction of, or deletion of your account
              or project information, contact{" "}
              <a href="mailto:realcodedbyom@gmail.com">
                realcodedbyom@gmail.com
              </a>
              . Identify the account and workspace concerned. Do not send
              passwords, verification codes, or API keys.
            </p>
            <p>
              Authentication records and project records are held separately. A
              deletion request may need action in both systems, and deleting
              your account can affect your team’s access to contribution
              records.
            </p>
          </article>
        </div>
      </main>
      <footer className="public-footer">
        <Link href="/">ContriGraph home</Link>
        <Link href="/help">Help & guides</Link>
        <a href="mailto:realcodedbyom@gmail.com">Contact</a>
      </footer>
    </div>
  );
}
