"use client";
import { useState } from "react";
import { Project, Task, dateLabel } from "@/lib/types";
import { Field } from "./WorkspaceUI";

export default function TaskQuickActions({
  project: p,
  task: t,
  command,
  askLead,
  viewRequests,
  archive,
}: {
  project: Project;
  task: Task;
  command: (type: string, payload: unknown) => Promise<void>;
  askLead: () => void;
  viewRequests: () => void;
  archive: () => void;
}) {
  const me = p.data.members.find((m) => m.id === p.myMemberId);
  const lead = me?.role === "lead",
    own = t.owner === p.myMemberId;
  const canEdit = lead || own,
    active = ["To do", "In progress"].includes(t.status);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dependencies = t.dependencies
    .map((id) => p.data.tasks.find((x) => x.id === id))
    .filter((x) => x && x.status !== "Done");
  const dependents = p.data.tasks.filter((x) => x.dependencies.includes(t.id));
  const openRequests = (p.data.requests || []).filter(
    (r) => r.taskId === t.id && r.status === "Open",
  );
  const canApprove =
    ["lead", "reviewer"].includes(me?.role || "") &&
    (p.data.members.length === 1 ||
      (t.owner !== p.myMemberId && t.submittedBy !== p.myMemberId));
  async function act(kind: string, payload: unknown) {
    setPending(true);
    setError("");
    try {
      await command(kind, payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="cg-task-workflow">
      <h2>{t.title}</h2>
      <p>
        {t.owner
          ? p.data.members.find((m) => m.id === t.owner)?.name
          : "No owner assigned"}
        {own ? " (you)" : ""} · {t.status} · Due {dateLabel(t.due)}
      </p>
      {t.description && <p className="cg-preserve-text">{t.description}</p>}
      {dependencies.length > 0 && (
        <p className="cg-alert">
          Waiting for: {dependencies.map((x) => x!.title).join(", ")}
        </p>
      )}
      {t.blocker && <p className="cg-alert">Blocker: {t.blocker}</p>}
      {error && (
        <p className="cg-alert" role="alert">
          {error}
        </p>
      )}
      {canEdit && active && (
        <form
          className="cg-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const status = String(f.get("status"));
            act(status === t.status ? "task.progress" : "task.status", {
              taskId: t.id,
              remaining: Number(f.get("remaining")),
              ...(status === t.status ? {} : { status }),
            });
          }}
        >
          <div className="cg-form-grid">
            <Field label="Remaining hours">
              <input
                name="remaining"
                type="number"
                required
                min={0}
                max={500}
                step={0.5}
                defaultValue={t.remaining}
              />
            </Field>
            <Field label="Next status">
              <select name="status" defaultValue={t.status}>
                <option>To do</option>
                <option
                  disabled={
                    t.status !== "In progress" &&
                    (!!t.blocker || dependencies.length > 0)
                  }
                >
                  In progress
                </option>
                <option
                  value="In review"
                  disabled={!!t.blocker || dependencies.length > 0}
                >
                  Submit for review
                </option>
              </select>
            </Field>
          </div>
          <button className="cg-primary" disabled={pending}>
            Save progress
          </button>
        </form>
      )}
      {t.status === "In review" && (
        <div className="cg-task-actions">
          {canApprove && (
            <button
              className="cg-primary"
              disabled={pending}
              onClick={() => act("task.approve", { taskId: t.id })}
            >
              Accept deliverable
            </button>
          )}
          {canEdit && (
            <button
              disabled={pending}
              onClick={() =>
                act("task.status", { taskId: t.id, status: "In progress" })
              }
            >
              Return to In progress
            </button>
          )}
          {!canApprove && (
            <p>A different lead or reviewer must accept this deliverable.</p>
          )}
        </div>
      )}
      {canEdit && active && (
        <details className="cg-task-detail">
          <summary>Report or clear a blocker</summary>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act("task.blocker", {
                taskId: t.id,
                blocker: f.get("blocker"),
                blockedUntil: f.get("blockedUntil") || null,
              });
            }}
          >
            <Field label="What is preventing progress?">
              <input
                name="blocker"
                maxLength={500}
                defaultValue={t.blocker}
                placeholder="Clear this field to remove the blocker"
              />
            </Field>
            <Field label="Expected resolution, if known">
              <input
                name="blockedUntil"
                type="date"
                defaultValue={t.blockedUntil || ""}
              />
            </Field>
            <button className="cg-btn" disabled={pending}>
              Save blocker
            </button>
          </form>
        </details>
      )}
      <div className="cg-task-actions">
        <button className="cg-btn" onClick={lead ? viewRequests : askLead}>
          {lead ? "View team requests" : "Ask the team lead"}
        </button>
        {lead && !["Done", "In review"].includes(t.status) && (
          <button
            className="cg-text"
            disabled={!!dependents.length || !!openRequests.length}
            onClick={archive}
          >
            Archive task
          </button>
        )}
      </div>
      {lead && dependents.length > 0 && (
        <small>
          To archive this task, first replan the tasks that depend on it.
        </small>
      )}
      {lead && openRequests.length > 0 && (
        <small>Respond to this task’s open requests before archiving it.</small>
      )}
      {!lead && (
        <p className="cg-muted">
          You can update your assigned work and comment on team tasks. Ask the
          lead to change owners, deadlines, scope, or archive a task.
        </p>
      )}
      {t.acceptance && <p>{t.acceptance}</p>}
    </section>
  );
}
