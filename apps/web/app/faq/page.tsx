import type { Metadata } from "next";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";

const url = "https://dsvv.live/contrigraph/faq/";
export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Answers about ContriGraph accounts, project invitations, workload hours, task redistribution, specialist skills, and team contribution.",
  alternates: { canonical: url },
  openGraph: {
    title: "ContriGraph FAQs",
    description:
      "Practical answers about accounts, workload, invitations, and project planning.",
    url,
  },
};
const questions = [
  {
    id: "my-work",
    question: "Where do I find my tasks and ask for help?",
    answer:
      "Your workspace opens on My work, showing tasks assigned to your linked team profile. Open a task to update remaining hours, report a blocker, or submit work for review. Use Ask the team lead for help, a deadline change, reassignment, new work, or archiving. Responses stay in Team requests and appear in My work. Requests are visible to the project team.",
  },
  {
    id: "archive",
    question: "Can I remove a task from the plan?",
    answer:
      "Leads can archive an unfinished task with a reason and restore it later. Its comments and attachments are retained. Resolve open requests and replan dependent tasks first. Work submitted for review must be returned to In progress before archiving; accepted work remains in contribution history. Members can request archiving from their lead.",
  },
  {
    id: "accounts",
    question: "How do I log in or create an account?",
    answer:
      "Use Google or your email on the login page. New users can choose Create an account. Email registration requires verification; use the latest code sent to your inbox. Signing in does not automatically add you to a project.",
  },
  {
    id: "invitations",
    question: "How do project invitations work?",
    answer:
      "A project owner or lead can generate an invitation for a team member. Get invitation opens a dialog with a code you can copy and share. The recipient signs in and uses the code to claim their roster entry. Each code can be claimed once; generating a replacement invalidates the previous code.",
  },
  {
    id: "hours",
    question: "Does ContriGraph track actual hours worked?",
    answer:
      "No. Workload hours are planned effort, based on the remaining hours your team enters and each member’s declared availability. The scheduler uses half-hour slots and accounts for working days, holidays, overrides, dependencies, and blockers. An eight-hour estimate does not prove someone worked for eight hours.",
  },
  {
    id: "cross-project",
    question: "How does workload across projects stay consistent?",
    answer:
      "Linked accounts share one capacity calendar across accessible projects. The workload dashboard and redistribution previews use the same joint schedule. Unclaimed roster entries remain separate, and commitments in inaccessible projects are unknown.",
  },
  {
    id: "specialists",
    question: "What if only one team member has the required skill?",
    answer:
      "ContriGraph identifies single-specialist tasks and keeps qualified ownership. It can propose moving other eligible work away from the specialist. If capacity is still insufficient, your team can test sequencing, scope, or deadline changes in the What-if simulator rather than assigning the task to an unqualified person.",
  },
  {
    id: "approval",
    question: "Does a redistribution preview change assignments?",
    answer:
      "No. A preview shows proposed assignments and their effect on workload and delivery dates. An authorized approval applies the changes after the server checks permissions and the current project state. If the preview is stale, refresh it before approving.",
  },
  {
    id: "contribution",
    question: "How is contribution different from task counts?",
    answer:
      "Contribution views include accepted estimated effort, reviews, approvals, progress updates, and recorded activity. Comments and task history give context. These are evidence for a team discussion, not an automatic grade or a measure of private computer activity.",
  },
  {
    id: "privacy",
    question: "Are my project tasks visible in search results?",
    answer:
      "Public product, help, and FAQ pages explain the platform. Project data requires a signed-in session and the appropriate project access. Private workspace pages are marked noindex, and API responses require authorization.",
  },
];
export default function FAQPage() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return (
    <div className="public-site">
      <PublicNav />
      <main className="help-main">
        <header className="help-intro">
          <h1>Frequently asked questions.</h1>
          <p>
            Accounts, planning, and the numbers behind your team’s workload.
          </p>
        </header>
        <nav className="guide-index" aria-label="FAQ topics">
          {questions.map((q) => (
            <a key={q.id} href={`#${q.id}`}>
              {q.question}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
        <div className="guide-articles">
          {questions.map((q) => (
            <article key={q.id} id={q.id}>
              <h2>{q.question}</h2>
              <p>{q.answer}</p>
              {q.id === "accounts" && (
                <Link className="public-button" href="/login">
                  Log in to ContriGraph ↗
                </Link>
              )}
              {q.id === "hours" && (
                <Link href="/help#workload">Read the workload guide →</Link>
              )}
            </article>
          ))}
        </div>
        <section className="public-cta">
          <h2>Ready to make a shared plan?</h2>
          <Link className="public-button" href="/app?signup=1">
            Create your account ↗
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <Link href="/">Product</Link>
        <Link href="/login">Log in</Link>
        <Link href="/help">Help & guides</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    </div>
  );
}
