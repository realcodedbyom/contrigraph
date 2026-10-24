"use client";
import { useEffect, useState } from "react";
import { api, download } from "@/lib/api";
import { Project } from "@/lib/types";

type Report = Project & { generatedAt: string; limitations: string[] };
const timestamp = (value: string, timezone: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function ProjectReport({
  projectId,
  version,
}: {
  projectId: string;
  version: number;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Report>(`/projects/${projectId}/report`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setReport(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refresh]);

  if (loading)
    return (
      <section className="cg-panel" role="status">
        Preparing the saved project report…
      </section>
    );
  if (!report || error)
    return (
      <section className="cg-panel" role="alert">
        <p>{error || "Report unavailable."}</p>
        <button onClick={() => setRefresh((n) => n + 1)}>Try again</button>
      </section>
    );
  const { data: d, analysis: a } = report;
  const member = (id: string) =>
    d.members.find((m) => m.id === id)?.name || "Unassigned";
  const excluded = new Set(a.forecast.excluded);
  const activeScope = d.tasks.filter(
    (t) => t.status !== "Deferred" && !excluded.has(t.id),
  );
  const done = activeScope.filter((t) => t.status === "Done").length;
  const completion = activeScope.length
    ? Math.round((done / activeScope.length) * 100)
    : null;
  const openRequests = (d.requests || []).filter((r) => r.status === "Open");
  const latest = d.updates.at(-1);
  const stale = report.version !== version;
  return (
    <article className="cg-report" aria-label="Project performance report">
      <div className="cg-report-tools">
        <p>
          Choose <strong>Save as PDF</strong> in your browser’s print dialog.
          Review the preview before saving.
        </p>
        <div>
          <button
            className="cg-primary"
            disabled={stale}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
          <button
            disabled={stale}
            onClick={() => download("contrigraph-report.json", report)}
          >
            Download JSON
          </button>
          <button onClick={() => setRefresh((n) => n + 1)}>
            Refresh report
          </button>
        </div>
        {stale && (
          <p role="status">
            The project has changed since this report was generated. Refresh
            before printing or downloading.
          </p>
        )}
      </div>
      <header className="cg-report-header">
        <span>CONTRIGRAPH / PROJECT PERFORMANCE REPORT</span>
        <h1>{d.name}</h1>
        <p>
          {d.description || "Project delivery and team contribution report."}
        </p>
        <dl>
          <div>
            <dt>Generated</dt>
            <dd>
              {timestamp(report.generatedAt, d.timezone)} · {d.timezone}
            </dd>
          </div>
          <div>
            <dt>Saved revision</dt>
            <dd>{report.version}</dd>
          </div>
          <div>
            <dt>Planning date</dt>
            <dd>{a.forecast.asOf}</dd>
          </div>
          <div>
            <dt>Project deadline</dt>
            <dd>{d.deadline}</dd>
          </div>
        </dl>
      </header>
      <section aria-labelledby="report-summary">
        <h2 id="report-summary">Delivery summary</h2>
        <dl className="cg-report-summary">
          <div>
            <dt>Project health</dt>
            <dd>{a.health.label}</dd>
          </div>
          <div>
            <dt>Accepted active scope</dt>
            <dd>
              {completion === null
                ? "No active tasks"
                : `${completion}% · ${done}/${activeScope.length} tasks`}
            </dd>
          </div>
          <div>
            <dt>Remaining effort</dt>
            <dd>{a.summary.remaining}h</dd>
          </div>
          <div>
            <dt>Forecast finish</dt>
            <dd>
              {a.forecast.date || "Unknown"}
              {a.forecast.conditional ? " · conditional" : ""}
            </dd>
          </div>
          <div>
            <dt>Estimated delay</dt>
            <dd>
              {a.forecast.delay === null
                ? "Unknown"
                : `${a.forecast.delay} calendar days`}
            </dd>
          </div>
          <div>
            <dt>Unresolved blockers</dt>
            <dd>{a.summary.blockers}</dd>
          </div>
        </dl>
        <p className="cg-report-note">
          {d.tasks.length - activeScope.length} tasks excluded through scope
          deferral; excluded work is not counted as completed. Hours are team
          estimates, not measured time. This forecast covers this project; use
          Across projects for the shared schedule.
        </p>
      </section>
      <section>
        <h2>Milestone progress</h2>
        <div className="cg-report-table">
          <table>
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Due</th>
                <th>Accepted / active tasks</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {d.milestones.map((m) => {
                const tasks = activeScope.filter((t) => t.milestone === m.name);
                const accepted = tasks.filter(
                  (t) => t.status === "Done",
                ).length;
                return (
                  <tr key={m.id}>
                    <th scope="row">{m.name}</th>
                    <td>{m.due}</td>
                    <td>
                      {accepted}/{tasks.length}
                    </td>
                    <td>
                      {tasks.length
                        ? `${Math.round((accepted / tasks.length) * 100)}%`
                        : "No active tasks"}
                    </td>
                  </tr>
                );
              })}
              {!d.milestones.length && (
                <tr>
                  <td colSpan={4}>No milestones planned.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Workload and available capacity</h2>
        <p>
          Seven days from {a.forecast.asOf}, using declared calendars and
          remaining effort due in this window, including overdue work.
        </p>
        <div className="cg-report-table">
          <table>
            <thead>
              <tr>
                <th>Teammate</th>
                <th>Pending effort</th>
                <th>Due effort</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Capacity signal</th>
              </tr>
            </thead>
            <tbody>
              {a.workload.map((w) => (
                <tr key={w.id}>
                  <th scope="row">{w.name}</th>
                  <td>{w.assigned}h</td>
                  <td>{w.dueEffort}h</td>
                  <td>{w.available}h</td>
                  <td>
                    {w.utilization === null
                      ? "No capacity"
                      : `${w.utilization}%`}
                  </td>
                  <td>
                    {w.dueEffort > w.available
                      ? `${Math.round((w.dueEffort - w.available) * 100) / 100}h over capacity`
                      : w.available > w.dueEffort
                        ? `${Math.round((w.available - w.dueEffort) * 100) / 100}h capacity available`
                        : "At capacity"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cg-report-note">
          Available capacity alone does not establish skill eligibility or
          permission to reassign work.
        </p>
      </section>
      <section>
        <h2>Individual contribution evidence</h2>
        <div className="cg-report-table">
          <table>
            <thead>
              <tr>
                <th>Teammate</th>
                <th>Accepted tasks</th>
                <th>Accepted estimated effort</th>
                <th>Independent reviews</th>
                <th>Documentation records</th>
                <th>Blocker-resolution records</th>
              </tr>
            </thead>
            <tbody>
              {a.contributions.map((c) => (
                <tr key={c.memberId}>
                  <th scope="row">{member(c.memberId)}</th>
                  <td>{c.delivered}</td>
                  <td>{c.acceptedEffort}h</td>
                  <td>{c.reviews}</td>
                  <td>{c.documentation}</td>
                  <td>{c.blockerResolutions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cg-report-note">
          Evidence dimensions are shown separately. Documentation and blocker
          records are self-reported; accepted effort is an estimate. These are
          not grades, rankings or independently measured productivity.
        </p>
      </section>
      <section>
        <h2>Delivery risks and recommended next steps</h2>
        {a.health.reasons.length ? (
          <ul>
            {a.health.reasons.map((r, i) => (
              <li key={i}>
                <strong>
                  {r.severity === "red" ? "At risk" : "Needs attention"}
                  {r.taskId ? ` · ${r.taskId}` : ""}:
                </strong>{" "}
                {r.text}
              </li>
            ))}
          </ul>
        ) : (
          <p>No current delivery risks detected.</p>
        )}
        {a.recommendations.length ? (
          <ul>
            {a.recommendations.map((r) => (
              <li key={r.id}>
                <strong>{r.title}.</strong> {r.reason} Preview before approval.
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No automatic reassignment is currently recommended. If work remains
            blocked, review its prerequisite, scope, deadline or available
            qualified capacity in the What-if simulator.
          </p>
        )}
        {a.skillRisks.map((r) => (
          <p key={r.taskId}>
            <strong>
              {r.taskId} · {r.title}:
            </strong>{" "}
            {r.reason} Downstream tasks: {r.downstream.join(", ") || "none"}.
          </p>
        ))}
      </section>
      <section>
        <h2>Task delivery and approvals</h2>
        <div className="cg-report-table">
          <table>
            <thead>
              <tr>
                <th>Task / owner</th>
                <th>Status</th>
                <th>Due / forecast finish</th>
                <th>Remaining</th>
                <th>Review and evidence</th>
              </tr>
            </thead>
            <tbody>
              {d.tasks.map((t) => (
                <tr key={t.id}>
                  <th scope="row">
                    {t.id} · {t.title}
                    <small>{member(t.owner)}</small>
                  </th>
                  <td>
                    {excluded.has(t.id)
                      ? "Excluded by scope deferral"
                      : t.status}
                  </td>
                  <td>
                    {t.due}
                    <small>
                      {t.status === "Done"
                        ? "Already accepted"
                        : excluded.has(t.id)
                          ? "Outside active scope"
                          : a.forecast.tasks[t.id]?.finish || "Unknown"}
                    </small>
                  </td>
                  <td>{t.remaining}h</td>
                  <td>
                    {t.acceptedBy
                      ? `${t.acceptance || "Accepted"} · ${member(t.acceptedBy)}`
                      : t.submittedBy
                        ? `Submitted by ${member(t.submittedBy)}`
                        : "Not submitted"}
                    <small>
                      {t.comments.length} comments · {t.files.length}{" "}
                      attachments
                    </small>
                    {t.blocker && <small>Blocker: {t.blocker}</small>}
                  </td>
                </tr>
              ))}
              {!d.tasks.length && (
                <tr>
                  <td colSpan={5}>No tasks created.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>Team requests and decisions</h2>
        <p>{openRequests.length} open requests awaiting a lead decision.</p>
        {(d.requests || []).map((r) => (
          <div className="cg-report-record" key={r.id}>
            <h3>
              {r.category} · {r.status}
              {r.taskId ? ` · ${r.taskId}` : ""}
            </h3>
            <p>
              {member(r.author)} · {timestamp(r.createdAt, d.timezone)}
            </p>
            <p className="cg-preserve-text">{r.message}</p>
            {r.response && (
              <p className="cg-preserve-text">
                <strong>{member(r.respondedBy)} replied:</strong> {r.response}
              </p>
            )}
          </div>
        ))}
        {!d.requests?.length && <p>No team requests recorded.</p>}
      </section>
      <section>
        <h2>Latest project update</h2>
        {latest ? (
          <div>
            <p>
              <strong>{latest.health}</strong> · {member(latest.author)} ·{" "}
              {timestamp(latest.time, d.timezone)}
            </p>
            <p className="cg-preserve-text">{latest.summary}</p>
            <p className="cg-preserve-text">
              <strong>Next steps:</strong> {latest.nextSteps}
            </p>
          </div>
        ) : (
          <p>No lead-authored project update yet.</p>
        )}
      </section>
      <section>
        <h2>Recorded activity</h2>
        <p>
          Latest {report.activity.length} events available in this report;
          activity retrieval is capped at 1,000 events. Review counts use this
          available history.
        </p>
        <div className="cg-report-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {report.activity.map((e) => (
                <tr key={e.id}>
                  <td>{timestamp(e.time, d.timezone)}</td>
                  <td>{e.actor_name}</td>
                  <td>
                    {e.text}
                    {e.taskId ? ` · ${e.taskId}` : ""}
                  </td>
                </tr>
              ))}
              {!report.activity.length && (
                <tr>
                  <td colSpan={3}>No activity recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <footer>
        <h2>Report assumptions</h2>
        <ul>
          {[...a.forecast.assumptions, ...report.limitations].map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
        <p>
          Generated from saved project revision {report.version}. Refresh to
          include later changes. ContriGraph.
        </p>
      </footer>
    </article>
  );
}
