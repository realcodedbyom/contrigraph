"use client";
import { useEffect, useRef, useState } from "react";
import { api, post } from "@/lib/api";
import { dateLabel } from "@/lib/types";
type Move = { projectId: string; taskId: string; memberId: string };
type Preview = {
  proposal: Move;
  taskTitle: string;
  from: string;
  to: string;
  hours: number;
  protectedTasks: string[];
  impacts: {
    projectId: string;
    projectName: string;
    deadline: string;
    before: string;
    after: string;
  }[];
  improvedTasks: { projectId: string; taskId: string; hoursEarlier: number }[];
  explanation: string;
  assumptions: string[];
  token: string;
  expiresAt: number;
  versions: Record<string, number>;
};
type Search = { suggestions: Preview[]; notes: string[]; truncated: boolean };
export default function PortfolioRedistribution({
  onApproved,
}: {
  onApproved: () => void;
}) {
  const [search, setSearch] = useState<Search | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  useEffect(() => {
    if (preview) previewRef.current?.scrollIntoView({ block: "start" });
  }, [preview]);
  return (
    <section className="cg-redistribution">
      <h3>Redistribute work safely</h3>
      <p>
        Reassign work within its existing project after checking the shared
        schedule across projects. Only the source project’s lead can approve.
      </p>
      <p>
        A sole specialist keeps their specialist task. We try moving their
        qualified side work instead. If no safe move exists, review priorities,
        scope, deadlines or additional qualified help.
      </p>
      <button
        className="cg-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setNotice("");
          setPreview(null);
          try {
            setSearch(await api<Search>("/workload/recommendations"));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking shared schedules…" : "Find safe redistributions"}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="status">
          {notice}
        </p>
      )}
      {search && (
        <>
          <p>
            {search.suggestions.length} verified suggestions.{" "}
            {search.truncated &&
              "Search was bounded; additional moves may exist."}
          </p>
          {!search.suggestions.length && (
            <p>
              No safe redistribution was verified. Claim member invitations and
              resolve incomplete forecasts before trying again. A missing
              suggestion is not proof that no plan exists.
            </p>
          )}
          {search.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {search.suggestions.map((s) => (
            <article
              className="cg-progress-entry"
              key={JSON.stringify(s.proposal)}
            >
              <h4>{s.taskTitle}</h4>
              <p>
                {s.from} → {s.to} · {s.hours}h remaining ·{" "}
                {
                  s.impacts.find((p) => p.projectId === s.proposal.projectId)
                    ?.projectName
                }
              </p>
              {!!s.protectedTasks.length && (
                <p>
                  Specialist work stays assigned: {s.protectedTasks.join(", ")}
                </p>
              )}
              <button
                className="cg-text"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setPreview(null);
                  try {
                    setPreview(
                      await post<Preview>(
                        "/workload/redistribution/preview",
                        s.proposal,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Preview redistribution
              </button>
            </article>
          ))}
        </>
      )}
      {preview && (
        <section
          ref={previewRef}
          className="cg-redistribution-preview"
          aria-label="Redistribution preview"
        >
          <h3>Review before approval</h3>
          <p>
            {preview.taskTitle}: {preview.from} → {preview.to}
          </p>
          <p>{preview.explanation}</p>
          <p>
            These dates and the workload grid use the same joint schedule. After
            approval, the grid refreshes with the new assignments. Due-effort
            and late-task warnings can remain after a safe move.
          </p>
          {!!preview.protectedTasks.length && (
            <p>
              Protected specialist tasks: {preview.protectedTasks.join(", ")}
            </p>
          )}
          <div className="cg-scroll">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Deadline</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {preview.impacts.map((p) => (
                  <tr key={p.projectId}>
                    <td>{p.projectName}</td>
                    <td>{dateLabel(p.deadline)}</td>
                    <td>{dateLabel(p.before)}</td>
                    <td>
                      {dateLabel(p.after)}
                      {p.after > p.deadline ? " · Still past deadline" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>
              {preview.improvedTasks.length} tasks finish earlier
            </summary>
            {preview.improvedTasks.map((t) => (
              <p key={t.projectId + t.taskId}>
                {
                  preview.impacts.find((p) => p.projectId === t.projectId)
                    ?.projectName
                }{" "}
                · {t.taskId} · {t.hoursEarlier} elapsed hours earlier
              </p>
            ))}
          </details>
          <ul>
            {preview.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p>
            Valid until{" "}
            {new Date(preview.expiresAt * 1000).toLocaleTimeString()}. Any
            portfolio change requires a fresh preview.
          </p>
          <form
            className="cg-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason") || "",
              ).trim();
              if (!reason) {
                setError("Record a reason for this decision.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await post("/workload/redistribution/approve", {
                  ...preview.proposal,
                  token: preview.token,
                  expiresAt: preview.expiresAt,
                  reason,
                });
                setPreview(null);
                setSearch(null);
                setNotice(
                  "Redistribution approved and recorded in the source project's activity history.",
                );
                onApproved();
              } catch (e) {
                setError((e as Error).message);
                setPreview(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Decision reason
              <textarea
                name="reason"
                required
                maxLength={500}
                placeholder="Explain why this reassignment helps the team."
              />
            </label>
            <div className="cg-toolbar">
              <button className="cg-primary" disabled={busy}>
                Approve redistribution
              </button>
              <button
                type="button"
                className="cg-text"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancel preview
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}
