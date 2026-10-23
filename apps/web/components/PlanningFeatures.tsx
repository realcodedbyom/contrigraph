"use client";
import { useEffect, useState } from "react";
import { api, post, download } from "@/lib/api";
import { Project, dateLabel } from "@/lib/types";
import PortfolioRedistribution from "./PortfolioRedistribution";

export function ProgressUpdates({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) {
  const [version, setVersion] = useState(project.version);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lead =
    project.data.members.find((m) => m.id === project.myMemberId)?.role ===
    "lead";
  const updates = [...project.data.updates].reverse();
  const latest = updates[0];
  const stale = !latest || Date.now() - Date.parse(latest.time) >= 7 * 86400000;
  return (
    <section className="cg-panel">
      <h2>Project progress updates</h2>
      <p>
        Lead-reported health and next steps. The calculated forecast remains
        separate.
      </p>
      <p role="status">
        {stale
          ? latest
            ? "Update overdue: the latest report is at least seven days old."
            : "No progress update yet."
          : "The latest update is current."}
      </p>
      {lead && (
        <form
          className="cg-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError("");
            try {
              const result = await post<Project>(
                `/projects/${project.id}/commands`,
                {
                  version,
                  type: "progress.add",
                  payload: {
                    health: data.get("health"),
                    summary: data.get("summary"),
                    nextSteps: data.get("nextSteps"),
                  },
                },
              );
              onSaved(result);
              setVersion(result.version);
              form.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Reported health
            <select name="health">
              <option>On track</option>
              <option>At risk</option>
              <option>Off track</option>
            </select>
          </label>
          <label>
            Progress summary
            <textarea
              name="summary"
              required
              maxLength={3000}
              placeholder="What changed since the last update?"
            />
          </label>
          <label>
            Next steps
            <textarea
              name="nextSteps"
              required
              maxLength={3000}
              placeholder="What happens next, and who needs help?"
            />
          </label>
          <button className="cg-primary" disabled={busy}>
            Publish progress update
          </button>
          {version !== project.version && (
            <p>
              The project changed while this form was open. Review the latest
              project, then{" "}
              <button
                type="button"
                className="cg-text"
                onClick={() => {
                  setVersion(project.version);
                  setError("");
                }}
              >
                use revision {project.version}
              </button>
              .
            </p>
          )}
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {updates.map((update) => (
        <article className="cg-progress-entry" key={update.id}>
          <header>
            <strong>{update.health}</strong>
            <span>
              {project.data.members.find((m) => m.id === update.author)?.name ||
                "Former teammate"}{" "}
              · {new Date(update.time).toLocaleString()}
            </span>
          </header>
          <p style={{ whiteSpace: "pre-wrap" }}>{update.summary}</p>
          <h3>Next steps</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{update.nextSteps}</p>
        </article>
      ))}
    </section>
  );
}

export function WipSettings({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(project.version);
  const lead =
    project.data.members.find((m) => m.id === project.myMemberId)?.role ===
    "lead";
  return (
    <details className="cg-wip-settings">
      <summary>Work-in-progress limits</summary>
      <p>
        Advisory limits count every task in the column, including tasks hidden
        by filters. Work can still move forward when a limit is exceeded.
      </p>
      <form
        className="cg-task-filters"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const limits: Record<string, number> = {};
          for (const status of ["In progress", "In review"])
            if (form.get(status)) limits[status] = Number(form.get(status));
          setBusy(true);
          setError("");
          try {
            const result = await post<Project>(
              `/projects/${project.id}/commands`,
              {
                version,
                type: "project.update",
                payload: { wipLimits: limits },
              },
            );
            onSaved(result);
            setVersion(result.version);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {["In progress", "In review"].map((status) => (
          <label key={status}>
            {status} limit
            <input
              key={`${status}-${version}`}
              name={status}
              type="number"
              min={1}
              max={200}
              step={1}
              placeholder="No limit"
              defaultValue={
                project.data.wipLimits[status as "In progress" | "In review"] ??
                ""
              }
              disabled={!lead}
            />
          </label>
        ))}
        {lead && (
          <button className="cg-primary" disabled={busy}>
            Save WIP limits
          </button>
        )}
      </form>
      {lead && version !== project.version && (
        <button
          className="cg-text"
          onClick={() => {
            setVersion(project.version);
            setError("");
          }}
        >
          Reload latest WIP settings
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

type Portfolio = {
  timezone: string;
  scheduleError: string;
  forecasts: {
    projectId: string;
    projectName: string;
    deadline: string;
    finish: string | null;
  }[];
  unassigned: {
    projectId: string;
    projectName: string;
    id: string;
    title: string;
    remaining: number;
  }[];
  asOf: string;
  days: string[];
  projectCount: number;
  scope: string;
  capacityRule: string;
  people: {
    id: string;
    name: string;
    linked: boolean;
    calendarConflict: boolean;
    overloaded: boolean;
    available: number;
    dueEffort: number;
    remaining: number;
    unscheduled: number;
    projects: { id: string; name: string }[];
    days: {
      date: string;
      available: number;
      planned: number;
      overbooked: number;
    }[];
    tasks: {
      projectId: string;
      projectName: string;
      id: string;
      title: string;
      remaining: number;
      due: string;
      status: string;
      unscheduled: boolean;
      start: string | null;
      finish: string | null;
      reason: string;
      late: boolean;
    }[];
  }[];
};
export function CrossProjectWorkload() {
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlyOverloaded, setOnlyOverloaded] = useState(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await api<Portfolio>("/workload");
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [revision]);
  return (
    <section className="cg-panel">
      <h2>Cross-project workload</h2>
      <p>
        Seven-day reporting window · {data?.timezone ?? "project timezone"}.
        Refreshes every 15 seconds.
      </p>
      {error && (
        <p role="alert">
          {error} {data && "Displayed data may be out of date."}
        </p>
      )}
      {loading && <p role="status">Combining accessible project workloads…</p>}
      {data && (
        <>
          <PortfolioRedistribution
            onApproved={() => setRevision((value) => value + 1)}
          />
          <p>{data.scope}</p>
          <p>{data.capacityRule}</p>
          {data.scheduleError && <p role="alert">{data.scheduleError}</p>}
          <div className="cg-scroll">
            <table aria-label="Joint project forecasts">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Deadline</th>
                  <th>Joint finish</th>
                </tr>
              </thead>
              <tbody>
                {data.forecasts.map((p) => (
                  <tr key={p.projectId}>
                    <td>{p.projectName}</td>
                    <td>{dateLabel(p.deadline)}</td>
                    <td>{p.finish ? dateLabel(p.finish) : "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!data.unassigned?.length && (
            <details className="cg-wip-settings">
              <summary>
                {data.unassigned.length} unassigned tasks need an owner
              </summary>
              <p>This effort is not included in any person's load.</p>
              {data.unassigned.map((t) => (
                <p key={t.projectId + t.id}>
                  {t.projectName} · {t.id} · {t.title} · {t.remaining}h
                </p>
              ))}
            </details>
          )}
          <div className="cg-toolbar">
            <label className="cg-inline-check">
              <input
                type="checkbox"
                checked={onlyOverloaded}
                onChange={(e) => setOnlyOverloaded(e.target.checked)}
              />{" "}
              Only overloaded people
            </label>
            <button
              className="cg-text"
              onClick={() => download("cross-project-workload.json", data)}
            >
              Export workload
            </button>
          </div>
          <p>
            {data.projectCount} accessible projects · {data.people.length}{" "}
            people or unclaimed roster entries · from {dateLabel(data.asOf)}
          </p>
          {!data.people.filter((p) => !onlyOverloaded || p.overloaded)
            .length && <p>No people match this view.</p>}
          {data.people
            .filter((p) => !onlyOverloaded || p.overloaded)
            .map((person) => (
              <article className="cg-progress-entry" key={person.id}>
                <h3>
                  {person.name}{" "}
                  {person.overloaded && (
                    <span className="cg-pill amber">Overloaded</span>
                  )}
                </h3>
                <p>{person.projects.map((p) => p.name).join(" · ")}</p>
                {!person.linked && (
                  <p>
                    Unclaimed roster entry. Claim invitations to link the same
                    person across projects.
                  </p>
                )}
                {person.calendarConflict && (
                  <p className="cg-blocked">
                    Project calendars differ. Using the lowest daily
                    availability; reconcile calendars before committing dates.
                  </p>
                )}
                <p>
                  {person.dueEffort}h due by {dateLabel(data.days[6])},
                  including overdue work · {person.available}h capacity counted
                  once · {person.remaining}h total pending ·{" "}
                  {person.unscheduled} unscheduled tasks
                </p>
                <div className="cg-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        {person.days.map((d) => (
                          <th key={d.date}>{dateLabel(d.date)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>Joint scheduled / available</th>
                        {person.days.map((d) => (
                          <td key={d.date}>
                            {data.scheduleError ? "Unknown" : d.planned} /{" "}
                            {d.available}h
                            {d.overbooked > 0 && (
                              <strong className="cg-blocked">
                                {d.overbooked}h over
                              </strong>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <details>
                  <summary>Inspect {person.tasks.length} pending tasks</summary>
                  <div className="cg-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Project</th>
                          <th>Remaining</th>
                          <th>Due</th>
                          <th>Joint start / finish</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {person.tasks.map((t) => (
                          <tr key={t.projectId + t.id}>
                            <td>
                              {t.id} · {t.title}
                            </td>
                            <td>{t.projectName}</td>
                            <td>{t.remaining}h</td>
                            <td>{dateLabel(t.due)}</td>
                            <td>
                              {t.finish
                                ? `${dateLabel(t.start!)} / ${dateLabel(t.finish)}${t.late ? " · Late" : ""}`
                                : `Unknown · ${t.reason}`}
                            </td>
                            <td>
                              {t.status}
                              {t.unscheduled ? " · No feasible schedule" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </article>
            ))}
        </>
      )}
    </section>
  );
}
