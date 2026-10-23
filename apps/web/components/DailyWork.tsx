"use client";
import { useState } from "react";
import { Project, Task, dateLabel } from "@/lib/types";
import { Field, Modal } from "./WorkspaceUI";

export function MyWork({
  project: p,
  openTask,
  requestHelp,
  showBoard,
  showRequests,
}: {
  project: Project;
  openTask: (t: Task) => void;
  requestHelp: (id?: string) => void;
  showBoard: () => void;
  showRequests: () => void;
}) {
  const [filter, setFilter] = useState("Active");
  const lead =
    p.data.members.find((m) => m.id === p.myMemberId)?.role === "lead";
  const mine = p.data.tasks.filter((t) => t.owner === p.myMemberId);
  const excluded = new Set(p.analysis.forecast.excluded);
  const isActive = (t: Task) => t.status !== "Done" && !excluded.has(t.id);
  const active = mine.filter(isActive);
  const replies = (p.data.requests || [])
    .filter((r) => r.author === p.myMemberId && r.response)
    .sort((a, b) => b.respondedAt.localeCompare(a.respondedAt))
    .slice(0, 3);
  const workload = p.analysis.workload.find((m) => m.id === p.myMemberId);
  const today = p.analysis.forecast.asOf;
  const isBlocked = (t: Task) =>
    !!t.blocker ||
    t.dependencies.some(
      (id) => p.data.tasks.find((d) => d.id === id)?.status !== "Done",
    );
  const shown = mine
    .filter((t) =>
      filter === "Completed"
        ? t.status === "Done"
        : filter === "All" || isActive(t),
    )
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  return (
    <>
      {!!replies.length && (
        <details className="cg-task-detail">
          <summary>Latest replies to your requests ({replies.length})</summary>
          {replies.map((r) => (
            <div className="cg-reply-summary" key={r.id}>
              <strong>
                {r.category} · {r.status}
              </strong>
              <p className="cg-preserve-text">{r.response}</p>
            </div>
          ))}
          <button className="cg-text" onClick={showRequests}>
            View your requests and responses →
          </button>
        </details>
      )}
      <section className="cg-daily-summary">
        <div>
          <span>Your active tasks</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <span>Overdue</span>
          <strong>{active.filter((t) => t.due < today).length}</strong>
        </div>
        <div>
          <span>Waiting for help or prerequisites</span>
          <strong>{active.filter(isBlocked).length}</strong>
        </div>
        <div>
          <span>Due in 7 days / available</span>
          <strong>
            {workload?.dueEffort || 0}h / {workload?.available || 0}h
          </strong>
        </div>
      </section>
      <p className="cg-muted">
        Hours are your team’s estimates, not tracked time. Open a task to update
        progress, report a blocker, or ask your lead for help.
      </p>
      <div className="cg-task-views" aria-label="My task filters">
        {["Active", "Completed", "All"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <button onClick={lead ? showRequests : () => requestHelp()}>
          {lead ? "Review team requests" : "Ask the team lead"}
        </button>
      </div>
      <section className="cg-personal-list" aria-label="Your assigned tasks">
        {!shown.length ? (
          <div className="cg-panel">
            <h2>
              {mine.length
                ? "Nothing in this view."
                : "No tasks assigned to you yet."}
            </h2>
            <p>
              {mine.length
                ? "Check completed work or view the whole team’s board."
                : lead
                  ? "Assign work from the task board and review requests from your team."
                  : "Ask your lead to assign work to your linked team profile. Your teammates’ tasks are on the task board."}
            </p>
            <button
              className="cg-btn"
              onClick={lead ? showRequests : () => requestHelp()}
            >
              {lead ? "Review team requests" : "Request work or help"}
            </button>
            <button className="cg-text" onClick={showBoard}>
              View team tasks
            </button>
          </div>
        ) : (
          shown.map((t) => (
            <article className="cg-personal-task" key={t.id}>
              <button className="cg-task-title" onClick={() => openTask(t)}>
                <small>
                  {t.id} · {t.priority} priority
                </small>
                <strong>{t.title}</strong>
                <span>
                  {t.status} · {t.remaining}h remaining ·{" "}
                  {t.due < today && !["Done", "Deferred"].includes(t.status)
                    ? "Overdue"
                    : "Due"}{" "}
                  {dateLabel(t.due)}
                </span>
                {isBlocked(t) && !["Done", "Deferred"].includes(t.status) && (
                  <span className="cg-blocked">
                    {t.blocker || "Waiting for prerequisite tasks"}
                  </span>
                )}
              </button>
              <div>
                <button className="cg-btn" onClick={() => openTask(t)}>
                  Open task
                </button>
                {!lead && !["Done", "Deferred"].includes(t.status) && (
                  <button className="cg-text" onClick={() => requestHelp(t.id)}>
                    Ask for help
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}

type Command = (type: string, payload: unknown) => Promise<void>;
export function RequestComposer({
  project,
  taskId,
  close,
  command,
}: {
  project: Project;
  taskId: string;
  close: () => void;
  command: Command;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Ask the team lead" close={close}>
      <p>
        Your request appears in Team requests. Your team can see the request and
        the lead’s response.
      </p>
      <form
        className="cg-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            await command("request.create", {
              taskId: f.get("taskId"),
              category: f.get("category"),
              message: f.get("message"),
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <Field label="What do you need?">
          <select name="category" defaultValue={taskId ? "Help" : "New task"}>
            {[
              "Help",
              "Deadline change",
              "Reassignment",
              "New task",
              "Archive task",
              "Other",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Related task">
          <select name="taskId" defaultValue={taskId}>
            <option value="">General project request</option>
            {project.data.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Explain what you need and why">
          <textarea
            name="message"
            required
            maxLength={2000}
            placeholder="I’m blocked by… I need… A workable next step would be…"
          />
        </Field>
        {error && (
          <p role="alert" className="cg-alert">
            {error}
          </p>
        )}
        <button className="cg-primary" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
    </Modal>
  );
}

export function TeamRequests({
  project: p,
  command,
  compose,
  openTask,
}: {
  project: Project;
  command: Command;
  compose: () => void;
  openTask: (t: Task) => void;
}) {
  const lead =
    p.data.members.find((m) => m.id === p.myMemberId)?.role === "lead";
  const [filter, setFilter] = useState(lead ? "Open" : "Mine"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const requests = p.data.requests || [];
  const shown = requests
    .filter((r) =>
      filter === "Open"
        ? r.status === "Open"
        : filter === "Mine"
          ? r.author === p.myMemberId
          : true,
    )
    .slice()
    .sort((a, b) =>
      (b.respondedAt || b.createdAt).localeCompare(
        a.respondedAt || a.createdAt,
      ),
    );
  const name = (id: string) =>
    p.data.members.find((m) => m.id === id)?.name || "Team member";
  async function act(type: string, payload: unknown) {
    setPending(true);
    setError("");
    try {
      await command(type, payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="cg-task-views" aria-label="Request filters">
        {["Open", "Mine", "All"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
            {f === "Open"
              ? ` (${requests.filter((r) => r.status === "Open").length})`
              : ""}
          </button>
        ))}
        {!lead && <button onClick={compose}>New request</button>}
      </div>
      <p className="cg-muted">
        Ask for help, more time, reassignment, or new work. Leads respond here;
        task assignments and deadlines change only through the task’s planning
        controls.
      </p>
      {error && (
        <p role="alert" className="cg-alert">
          {error}
        </p>
      )}
      {!shown.length && (
        <section className="cg-panel">
          <h2>No {filter === "Open" ? "open " : ""}requests.</h2>
          <p>
            Requests and responses stay here so decisions do not get lost in
            chat.
          </p>
        </section>
      )}
      {shown.map((r) => (
        <article className="cg-panel cg-request" key={r.id}>
          <header>
            <h2>{r.category}</h2>
            <span className="cg-pill neutral">{r.status}</span>
          </header>
          <small>
            {name(r.author)} · {new Date(r.createdAt).toLocaleString()}
          </small>
          <p className="cg-preserve-text">{r.message}</p>
          {r.taskId && (
            <button
              className="cg-text"
              disabled={!p.data.tasks.some((t) => t.id === r.taskId)}
              onClick={() => {
                const t = p.data.tasks.find((t) => t.id === r.taskId);
                if (t) openTask(t);
              }}
            >
              Open related task · {r.taskId}
            </button>
          )}
          {r.response && (
            <div className="cg-request-response">
              <strong>{name(r.respondedBy)} replied</strong>
              <p className="cg-preserve-text">{r.response}</p>
            </div>
          )}
          {r.status === "Open" && lead && (
            <form
              className="cg-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act("request.respond", {
                  requestId: r.id,
                  status: f.get("status"),
                  response: f.get("response"),
                });
              }}
            >
              <Field label="Your response">
                <textarea
                  name="response"
                  required
                  maxLength={2000}
                  placeholder="Explain the decision and next step."
                />
              </Field>
              <Field label="Decision">
                <select name="status">
                  <option>Resolved</option>
                  <option>Declined</option>
                </select>
              </Field>
              <button className="cg-primary" disabled={pending}>
                Send response
              </button>
            </form>
          )}
          {r.status === "Open" && r.author === p.myMemberId && (
            <button
              className="cg-text"
              disabled={pending}
              onClick={() => act("request.cancel", { requestId: r.id })}
            >
              Cancel my request
            </button>
          )}
        </article>
      ))}
    </>
  );
}

export function TaskArchive({
  project: p,
  command,
}: {
  project: Project;
  command: Command;
}) {
  const lead =
    p.data.members.find((m) => m.id === p.myMemberId)?.role === "lead";
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="cg-panel">
      <h2>Archived tasks</h2>
      <p>
        Archived work is removed from active planning. Leads can restore it with
        its comments and attachments. Accepted work stays in the project’s
        contribution history.
      </p>
      {error && (
        <p className="cg-alert" role="alert">
          {error}
        </p>
      )}
      {!(p.data.archivedTasks || []).length && <p>No archived tasks.</p>}
      {(p.data.archivedTasks || []).map((r) => (
        <article className="cg-personal-task" key={r.task.id}>
          <div>
            <strong>{r.task.title}</strong>
            <p>{r.reason}</p>
            <small>
              {r.task.id} · Archived{" "}
              {new Date(r.archivedAt).toLocaleDateString()}
            </small>
          </div>
          {lead && (
            <button
              className="cg-btn"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await command("task.restore", { taskId: r.task.id });
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              Restore task
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
