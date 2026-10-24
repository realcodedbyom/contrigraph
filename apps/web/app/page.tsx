import PublicArrow from "@/components/PublicArrow";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import ProductExperience, {
  ProductMotion,
  ProductSignal,
} from "@/components/ProductExperience";
import SkiperLink from "@/components/SkiperLink";
import ProductWorkflow from "@/components/ProductWorkflow";
import ProductTour from "@/components/ProductTour";
export default function ProductPage() {
  return (
    <div className="public-site">
      <ProductMotion />
      <PublicNav />
      <main>
        <section className="public-hero">
          <div>
            <h1>
              Know what’s next.
              <br />
              Plan for <span>everyone.</span>
            </h1>
            <p className="public-lead">
              For small software teams with shared deadlines. Find your tasks,
              ask for help, and test workload changes before your lead approves
              them. Keep the plan realistic when only one person has the skill.
            </p>
            <div className="public-hero-actions">
              <Link className="public-button" href="/app?signup=1">
                Start your team workspace <PublicArrow />
              </Link>
              <a href="#watch">
                Watch the product tour <PublicArrow direction="right" />
              </a>
            </div>
            <p className="public-note">
              Skill-aware planning. Explainable forecasts. Decisions stay with
              your team.
            </p>
          </div>
          <ProductExperience />
        </section>
        <ProductTour />
        <ProductWorkflow />
        <section id="product" className="public-section">
          <p className="public-kicker">FROM ASSIGNMENT TO DELIVERY</p>
          <h2>Keep the whole team in view.</h2>
          <div className="product-features">
            <article>
              <span>01 / PLAN</span>
              <h3>Make the next step clear.</h3>
              <p>
                Assign owners, define milestones, and connect dependencies. See
                blocked work before it becomes a missed deadline. Personal
                inboxes bring assignments, requests and replies back to the
                work.
              </p>
              <Link href="/help#getting-started">
                Build your first plan <PublicArrow direction="right" />
              </Link>
            </article>
            <article>
              <span>02 / BALANCE</span>
              <h3>One person. One calendar.</h3>
              <p>
                Combine linked members’ workload across projects. Test
                redistribution against the same schedule shown in your
                dashboard.
              </p>
              <Link href="/help#workload">
                Understand capacity <PublicArrow direction="right" />
              </Link>
            </article>
            <article>
              <span>03 / RECOGNIZE</span>
              <h3>Credit beyond task counts.</h3>
              <p>
                Keep reviews, approvals, progress updates, and accepted effort
                visible alongside delivery.
              </p>
              <Link href="/help#contributions">
                Explore contribution evidence <PublicArrow direction="right" />
              </Link>
            </article>
            <article>
              <span>04 / RECOVER</span>
              <h3>Try the decision first.</h3>
              <p>
                Preview changes to scope, deadlines, and ownership. Review their
                effect before approving a new plan.
              </p>
              <Link href="/help#specialists">
                Handle a single specialist <PublicArrow direction="right" />
              </Link>
            </article>
          </div>
        </section>
        <ProductSignal />
        <section className="public-section public-principle">
          <p className="public-kicker">A PLAN YOU CAN EXPLAIN</p>
          <h2>
            Forecast hours.
            <br />
            Understand the assumptions.
          </h2>
          <p>
            ContriGraph schedules the remaining effort your team enters against
            declared availability. It does not measure time spent at a keyboard
            or automatically grade people.
          </p>
          <Link href="/help#workload">
            Read the workload guide <PublicArrow direction="right" />
          </Link>
        </section>
        <section className="public-section public-faq">
          <p className="public-kicker">QUESTIONS, ANSWERED</p>
          <h2>Before you get started.</h2>
          <details>
            <summary>How does ContriGraph calculate workload?</summary>
            <p>
              ContriGraph compares declared weekly availability with remaining
              task effort scheduled into working-day half-hour slots. Holidays,
              overrides, dependencies, and blockers affect the plan.
            </p>
          </details>
          <details>
            <summary>
              Can ContriGraph handle a task only one person can do?
            </summary>
            <p>
              Yes. ContriGraph identifies single-specialist tasks and recommends
              schedule, scope, or deadline changes instead of unsafe
              reassignment. It can help move other eligible work away from that
              specialist.
            </p>
          </details>
          <details>
            <summary>Can I use it across several projects?</summary>
            <p>
              Yes. Linked accounts share capacity across accessible projects.
              Unclaimed roster entries remain separate, and commitments in
              inaccessible projects are unknown.
            </p>
          </details>
          <Link href="/faq">
            Read all FAQs <PublicArrow direction="right" />
          </Link>
        </section>
        <section className="public-cta">
          <h2>
            Give your next project
            <br />a clearer start.
          </h2>
          <Link href="/app?signup=1" className="public-button">
            Get started <PublicArrow />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <span>ContriGraph · Built for student teams</span>
        <Link href="/help">Help & guides</Link>
        <Link href="/faq">FAQs</Link>
        <Link href="/login">Log in</Link>
        <Link href="/privacy">Privacy</Link>
        <SkiperLink href="https://github.com/realcodedbyom/contrigraph">
          View the source
        </SkiperLink>
      </footer>
    </div>
  );
}
