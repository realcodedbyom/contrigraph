"use client";
import { useEffect, useState, useRef } from "react";
import {
  SquaresFour,
  Kanban,
  GitBranch,
  Users,
  ShieldCheck,
  ChartBar,
  ClockCounterClockwise,
  Flask,
  Plus,
  ArrowRight,
  SignOut,
  DownloadSimple,
} from "@phosphor-icons/react";
import { Modal, Field, LoadTable } from "@/components/WorkspaceUI";
import { dependencyPositions } from "@/lib/graph";
import TaskBoard from "@/components/TaskBoard";
import TaskQuickActions from "@/components/TaskQuickActions";
import {
  MyWork,
  RequestComposer,
  TeamRequests,
  TaskArchive,
} from "@/components/DailyWork";
import {
  CrossProjectWorkload,
  ProgressUpdates,
  WipSettings,
} from "@/components/PlanningFeatures";
import WorkspaceMotion from "@/components/WorkspaceMotion";
import InvitationDialog from "@/components/InvitationDialog";
import CountUp from "@/components/CountUp";
import SkiperLink from "@/components/SkiperLink";
import { api, post, download, ApiError } from "@/lib/api";
import {
  User,
  Project,
  Task,
  Member,
  Scenario,
  Simulation,
  dateLabel,
  splitSkills,
} from "@/lib/types";
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
const sections = [
  ["My work", Kanban],
  ["Overview", SquaresFour],
  ["Task board", Kanban],
  ["Team requests", ClockCounterClockwise],
  ["Dependencies", GitBranch],
  ["Team & workload", Users],
  ["Across projects", ChartBar],
  ["Progress updates", ClockCounterClockwise],
  ["Skill coverage", ShieldCheck],
  ["Contributions", ChartBar],
  ["Activity", ClockCounterClockwise],
  ["What-if simulator", Flask],
  ["Archived tasks", ClockCounterClockwise],
] as const;
const statuses = [
  "To do",
  "In progress",
  "In review",
  "Done",
  "Deferred",
] as const;
const uid = () => crypto.randomUUID();
export default function Home({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  const authStarted = useRef(false);
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [projectLoading, setProjectLoading] = useState(true),
    [projects, setProjects] = useState<{ id: string; name: string }[]>([]),
    [p, setP] = useState<Project | null>(null),
    [section, setSection] = useState("My work"),
    [mobileNavOpen, setMobileNavOpen] = useState(false),
    [boardView, setBoardView] = useState("All tasks"),
    [requestTask, setRequestTask] = useState(""),
    [archiveReason, setArchiveReason] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(""),
    [task, setTask] = useState<Task | null>(null),
    [member, setMember] = useState<Member | null>(null),
    [invitationCode, setInvitationCode] = useState(""),
    [modalVersion, setModalVersion] = useState(0),
    [scenario, setScenario] = useState<Scenario>({
      version: 1,
      kind: "reassign",
      taskId: "",
      memberId: "",
      value: "",
      reason: "",
    }),
    [simulation, setSimulation] = useState<Simulation | null>(null);
  useEffect(() => {
    if (modal) setModalVersion(p?.version || 0);
  }, [modal]);
  async function refresh(id?: string) {
    setProjectLoading(true);
    try {
      if (id && id !== p?.id) setSimulation(null);
      const list = await api<{ id: string; name: string }[]>("/projects");
      setProjects(list);
      const target = id || p?.id || list[0]?.id;
      if (target) setP(await api<Project>("/projects/" + target));
      else setP(null);
    } finally {
      setProjectLoading(false);
    }
  }
  useEffect(() => {
    // Strict Mode replays effects in development. Load the application identity once.
    if (authStarted.current) return;
    authStarted.current = true;
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!p) return;
    const id = p.id,
      version = p.version;
    const timer = setInterval(() => {
      if (document.hidden) return;
      api<{ version: number }>("/projects/" + id + "/revision")
        .then(async (r) => {
          if (r.version !== version) {
            setP(await api<Project>("/projects/" + id));
            setNotice("Updated with your team’s latest changes.");
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [p?.id, p?.version]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) await refresh();
      if (e instanceof ApiError && e.status === 401) setUser(null);
    } finally {
      setBusy(false);
    }
  }
  async function command(type: string, payload: unknown) {
    if (!p) return;
    const updated = await post<Project>("/projects/" + p.id + "/commands", {
      version:
        modal &&
        (type.startsWith("task.") ||
          ["member.save", "project.update"].includes(type))
          ? modalVersion
          : p.version,
      type,
      payload,
    }).catch(async (e) => {
      if (e instanceof ApiError && e.status === 409) await refresh();
      throw e;
    });
    setP(updated);
    if (modal) setModalVersion(updated.version);
    setNotice("Saved to the project.");
  }
  function getInvitation(target: Member) {
    if (!p || busy) return;
    setMember(target);
    setInvitationCode("");
    setModal("invite");
    run(async () => {
      const result = await post<{ code: string }>(
        "/projects/" + p.id + "/invites",
        {
          version: p.version,
          memberId: target.id,
        },
      );
      setInvitationCode(result.code);
    });
  }
  const me = p?.data.members.find((m) => m.id === p.myMemberId),
    lead = me?.role === "lead";
  const name = (id: string) =>
    p?.data.members.find((m) => m.id === id)?.name || "Unassigned";
  const openTask = (t: Task) => {
    setTask(t);
    setModal("task");
  };
  const newTask = () => {
    if (!p) return;
    setTask({
      id: "CG-" + uid().slice(0, 6),
      title: "",
      description: "",
      owner: "",
      effort: 4,
      remaining: 4,
      status: "To do",
      priority: "Medium",
      due: p.data.deadline,
      dependencies: [],
      requiredSkills: [],
      milestone: p.data.milestones[0]?.name || "",
      blocker: "",
      blockedUntil: null,
      earliestStart: null,
      locked: false,
      rank: 100,
      submittedBy: null,
      acceptedBy: null,
      acceptance: null,
      comments: [],
      files: [],
    });
    setModal("task");
  };
  const openScenario = (taskId = "", memberId = "") => {
    setScenario({
      version: p?.version || 1,
      kind: "reassign",
      taskId,
      memberId,
      value: "",
      reason: "",
    });
    setSimulation(null);
    setSection("What-if simulator");
  };
  const askLead = (id = "") => {
    setRequestTask(id);
    setModal("request");
  };
  const goBoard = (view = "All tasks") => {
    setBoardView(view);
    setSection("Task board");
  };
  const primarySections = [
    "My work",
    "Overview",
    "Task board",
    "Team requests",
    "Team & workload",
    "Across projects",
    "What-if simulator",
  ];
  const navButton = ([title, Icon]: (typeof sections)[number]) => (
    <button
      key={title}
      className={section === title ? "active" : ""}
      aria-current={section === title ? "page" : undefined}
      onClick={() => {
        if (title === "Task board") setBoardView("All tasks");
        setSection(title);
        setMobileNavOpen(false);
      }}
    >
      <Icon size={19} />
      {title}
      {title === "Team requests" &&
        !!p?.data.requests?.filter(
          (r) => r.status === "Open" && (lead || r.author === p.myMemberId),
        ).length && (
          <small>
            {
              p.data.requests.filter(
                (r) =>
                  r.status === "Open" && (lead || r.author === p.myMemberId),
              ).length
            }
          </small>
        )}
      {title === "My work" && !!p && (
        <small>
          {
            p.data.tasks.filter(
              (t) =>
                t.owner === p.myMemberId &&
                t.status !== "Done" &&
                !p.analysis.forecast.excluded.includes(t.id),
            ).length
          }
        </small>
      )}
    </button>
  );
  if (!ready) return <div className="cg-loading">Opening your workspace…</div>;
  if (!user)
    return (
      <div className="cg-loading">
        <div role="alert">
          <h2>We couldn’t open your workspace.</h2>
          <p>
            {error ||
              "Your session could not be verified. Please sign in again."}
          </p>
          <button className="cg-btn" onClick={() => window.location.reload()}>
            Try again
          </button>
          <button className="cg-text" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>
    );

  const a = p?.analysis,
    d = p?.data;
  return (
    <div className="cg-app">
      <WorkspaceMotion section={section} />
      {error && modal && modal !== "invite" && (
        <div className="cg-toast" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss">
            {" "}
            ×
          </button>
        </div>
      )}
      <aside
        className={"cg-sidebar" + (mobileNavOpen ? " cg-nav-open" : "")}
        aria-label="Workspace navigation"
        data-lenis-prevent
      >
        <a
          className="cg-brand"
          href={process.env.NEXT_PUBLIC_APP_BASE_PATH || "/"}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>contrigraph.</strong>
        </a>
        <span className="cg-caption">TEAM WORKSPACE</span>
        <a
          className="workspace-help"
          href={(process.env.NEXT_PUBLIC_APP_BASE_PATH || "") + "/help/"}
        >
          Help & guides ↗
        </a>
        <select
          aria-label="Select project"
          value={p?.id || ""}
          onChange={(e) => run(() => refresh(e.target.value))}
        >
          <option value="" disabled>
            Select project
          </option>
          {projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button
          className="cg-mobile-menu"
          aria-expanded={mobileNavOpen}
          aria-controls="project-navigation project-account"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? "Close menu" : "Project menu"}
          <span>{section}</span>
        </button>
        <nav
          id="project-navigation"
          aria-label="Project sections"
          data-lenis-prevent
        >
          {sections
            .filter(([title]) => primarySections.includes(title))
            .map(navButton)}
          <details className="cg-more-nav">
            <summary>More project views</summary>
            {sections
              .filter(([title]) => !primarySections.includes(title))
              .map(navButton)}
          </details>
        </nav>
        <div className="cg-sidebar-bottom" id="project-account">
          <button onClick={() => setModal("project")}>
            <Plus size={16} />
            Create project
          </button>
          <button onClick={() => setModal("join")}>Join with invitation</button>
          <div className="cg-profile">
            <span>{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {me?.role || "Team member"}
                {user.provider === "sandbox" ? " · Sandbox" : ""}
              </small>
            </div>
            <button
              aria-label="Sign out"
              onClick={() =>
                run(async () => {
                  await onSignOut();
                  setP(null);
                  setUser(null);
                })
              }
            >
              <SignOut size={19} />
            </button>
          </div>
        </div>
      </aside>
      <div className="cg-main">
        <header className="cg-topbar">
          <span>
            Workspace <span className="cg-muted">/ {section}</span>
          </span>
          <div>
            <span className="cg-live">
              ●{" "}
              {busy
                ? "Saving…"
                : p
                  ? "Server saved · v" + p.version
                  : "Connected"}
            </span>
            <button
              onClick={() =>
                run(async () => {
                  if (p)
                    download(
                      "contrigraph-report.json",
                      await api("/projects/" + p.id + "/report"),
                    );
                })
              }
              disabled={!p}
            >
              <DownloadSimple size={16} />
              Export report
            </button>
          </div>
        </header>
        <main className="cg-content">
          {error && (
            <div className="cg-alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="cg-notice" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {projectLoading ? (
            <section className="cg-empty" role="status">
              <h1>Loading your project…</h1>
              <p>Fetching saved tasks, team availability and forecasts.</p>
            </section>
          ) : !p || !a || !d ? (
            <section className="cg-empty">
              <h1>A good project starts with a shared plan.</h1>
              <p>
                Create your team’s workspace, or join with the invitation your
                lead shared.
              </p>
              <button
                className="cg-primary"
                onClick={() => setModal("project")}
              >
                Create your first project <ArrowRight />
              </button>
            </section>
          ) : (
            <>
              <div className="cg-heading">
                <div>
                  <span className="cg-caption">{d.name.toUpperCase()}</span>
                  <h1>
                    {section === "Overview"
                      ? "Your project at a glance."
                      : section}
                  </h1>
                  <p>
                    {section === "Overview"
                      ? d.description
                      : section === "My work"
                        ? "Your assigned work, deadlines, and next steps."
                        : section === "Team requests"
                          ? "Ask for a decision. Keep the response with the work."
                          : section === "What-if simulator"
                            ? "Try changes to assignments, capacity, scope, or dates before approving a new plan."
                            : "Plan, update, and review your team’s work."}
                  </p>
                </div>
                {lead ? (
                  <button className="cg-primary" onClick={newTask}>
                    <Plus size={17} />
                    New task
                  </button>
                ) : (
                  <button className="cg-primary" onClick={() => askLead()}>
                    Ask the team lead
                  </button>
                )}
              </div>
              <div className="cg-projectline">
                <span className={"cg-pill " + a.health.tone}>
                  {a.health.label}
                </span>
                <span>
                  Deadline <b>{dateLabel(d.deadline)}</b>
                </span>
                <span>{d.members.length} teammates</span>
                <span>{d.timezone}</span>
                {lead && (
                  <button onClick={() => setModal("settings")}>
                    Project settings
                  </button>
                )}
              </div>
              {section === "My work" && (
                <MyWork
                  key={p.id}
                  project={p}
                  openTask={openTask}
                  requestHelp={askLead}
                  showBoard={() => goBoard()}
                  showRequests={() => setSection("Team requests")}
                />
              )}
              {section === "Team requests" && (
                <TeamRequests
                  key={p.id}
                  project={p}
                  command={command}
                  compose={() => askLead()}
                  openTask={openTask}
                />
              )}
              {section === "Archived tasks" && (
                <TaskArchive key={p.id} project={p} command={command} />
              )}
              {section === "Overview" && (
                <>
                  <div className="cg-metrics">
                    {[
                      [
                        "Accepted tasks",
                        a.summary.done + "/" + a.summary.total,
                        "Accepted or explicitly self-attested",
                      ],
                      [
                        "Remaining effort",
                        a.summary.remaining + "h",
                        "Across active project scope",
                      ],
                      [
                        "Delivery forecast",
                        dateLabel(a.forecast.date),
                        a.forecast.delay === null
                          ? "Unresolved scheduling constraints"
                          : a.forecast.delay + " calendar days late",
                      ],
                      [
                        "Skill risks",
                        a.skillRisks.length,
                        "Protect your specialists",
                      ],
                    ].map(([l, v, n]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <strong>
                          {l === "Remaining effort" ? (
                            <CountUp
                              to={a.summary.remaining}
                              suffix="h"
                              duration={0.6}
                              trigger="load"
                            />
                          ) : l === "Skill risks" ? (
                            <CountUp
                              to={a.skillRisks.length}
                              duration={0.6}
                              trigger="load"
                            />
                          ) : (
                            v
                          )}
                        </strong>
                        <small>{n}</small>
                      </div>
                    ))}
                  </div>
                  <section className="cg-panel cg-overview-actions">
                    <h2>Move the work forward</h2>
                    <button onClick={() => setSection("My work")}>
                      <strong>Your tasks</strong>
                      <span>
                        {
                          d.tasks.filter(
                            (t) =>
                              t.owner === p.myMemberId &&
                              t.status !== "Done" &&
                              !a.forecast.excluded.includes(t.id),
                          ).length
                        }{" "}
                        active · Open your work →
                      </span>
                    </button>
                    <button onClick={() => setSection("Team requests")}>
                      <strong>
                        {lead
                          ? "Requests awaiting your response"
                          : "Requests to your lead"}
                      </strong>
                      <span>
                        {
                          (d.requests || []).filter(
                            (r) =>
                              r.status === "Open" &&
                              (lead || r.author === p.myMemberId),
                          ).length
                        }{" "}
                        open · View requests →
                      </span>
                    </button>
                    <button onClick={() => goBoard("Review queue")}>
                      <strong>Work awaiting review</strong>
                      <span>
                        {d.tasks.filter((t) => t.status === "In review").length}{" "}
                        tasks · Review queue →
                      </span>
                    </button>
                    <button onClick={() => goBoard("Blocked")}>
                      <strong>Work that cannot move forward</strong>
                      <span>See blockers and unfinished prerequisites →</span>
                    </button>
                    {lead && (
                      <button onClick={() => goBoard("Unassigned")}>
                        <strong>Tasks without an owner</strong>
                        <span>
                          {
                            d.tasks.filter(
                              (t) =>
                                !t.owner &&
                                !["Done", "Deferred"].includes(t.status),
                            ).length
                          }{" "}
                          tasks · Assign qualified owners →
                        </span>
                      </button>
                    )}
                  </section>
                  <div className="cg-two">
                    <section className="cg-panel">
                      <h2>Milestones</h2>
                      {d.milestones.length === 0 && (
                        <p>No milestones planned yet.</p>
                      )}
                      {d.milestones.map((m) => {
                        const tasks = d.tasks.filter(
                          (t) => t.milestone === m.name,
                        );
                        const done = tasks.filter(
                          (t) => t.status === "Done",
                        ).length;
                        return (
                          <div className="cg-milestone" key={m.id}>
                            <div>
                              <strong>{m.name}</strong>
                              <span>
                                {dateLabel(m.due)} · {done}/{tasks.length}{" "}
                                accepted
                              </span>
                            </div>
                            <progress value={done} max={tasks.length || 1} />
                          </div>
                        );
                      })}
                      {lead && (
                        <button
                          className="cg-text"
                          onClick={() => setModal("milestone")}
                        >
                          + Plan a milestone
                        </button>
                      )}
                    </section>
                    <section className="cg-panel">
                      <h2>Needs your attention</h2>
                      {a.health.reasons.length === 0 ? (
                        <p>No current risks detected.</p>
                      ) : (
                        a.health.reasons.slice(0, 6).map((r, i) => (
                          <button
                            className="cg-risk"
                            key={i}
                            onClick={() => {
                              const t = d.tasks.find((t) => t.id === r.taskId);
                              if (t) openTask(t);
                              else setSection("Team & workload");
                            }}
                          >
                            <span className={"cg-dot " + r.severity} />
                            <span>{r.text}</span>
                          </button>
                        ))
                      )}
                    </section>
                  </div>
                  <section className="cg-panel">
                    <h2>Workload · next seven days</h2>
                    <LoadTable project={p} />
                  </section>
                </>
              )}
              {section === "Across projects" && <CrossProjectWorkload />}
              {section === "Progress updates" && (
                <ProgressUpdates
                  key={`updates-${p.id}`}
                  project={p}
                  onSaved={setP}
                />
              )}
              {section === "Task board" && (
                <WipSettings key={`wip-${p.id}`} project={p} onSaved={setP} />
              )}
              {section === "Task board" && (
                <TaskBoard
                  key={`board-${p.id}-${boardView}`}
                  project={p}
                  openTask={openTask}
                  initialView={boardView}
                />
              )}
              {section === "Dependencies" && (
                <section className="cg-panel">
                  <h2>Dependencies & delivery</h2>
                  <p>
                    Click a task to inspect prerequisites and forecast. Arrows
                    run from prerequisite to dependent task.
                  </p>
                  <div className="cg-graph">
                    <ReactFlow
                      fitView
                      nodes={d.tasks.map((t, i) => ({
                        id: t.id,
                        position: dependencyPositions(d.tasks)[t.id],
                        sourcePosition: Position.Bottom,
                        targetPosition: Position.Top,
                        data: {
                          label: (
                            <div>
                              <small>
                                {t.id} · {t.status}
                              </small>
                              <strong
                                style={{ display: "block", margin: "8px 0" }}
                              >
                                {t.title}
                              </strong>
                              <span>
                                {dateLabel(a.forecast.tasks[t.id]?.finish)} ·{" "}
                                {t.remaining}h
                              </span>
                            </div>
                          ),
                        },
                        style: {
                          width: 235,
                          border: "1px solid #d8ddcf",
                          borderRadius: 10,
                          padding: 12,
                          background: t.status === "Done" ? "#edf2e7" : "#fff",
                        },
                      }))}
                      edges={d.tasks.flatMap((t) =>
                        t.dependencies.map((id) => ({
                          id: id + "-" + t.id,
                          source: id,
                          target: t.id,
                          type: "smoothstep",
                          markerEnd: {
                            type: MarkerType.ArrowClosed,
                            color: "#7d8b6d",
                          },
                          style: { stroke: "#7d8b6d", strokeWidth: 2 },
                        })),
                      )}
                      onNodeClick={(_, n) =>
                        openTask(d.tasks.find((t) => t.id === n.id)!)
                      }
                      nodesDraggable
                      nodesConnectable={false}
                    >
                      <Background gap={24} />
                      <Controls />
                    </ReactFlow>
                  </div>
                  <details>
                    <summary>Forecast assumptions</summary>
                    {a.forecast.assumptions.map((x) => (
                      <p key={x}>{x}</p>
                    ))}
                  </details>
                </section>
              )}
              {section === "Team & workload" && (
                <>
                  <section className="cg-panel">
                    <div className="cg-row">
                      <h2>Capacity is a calendar, not a task count.</h2>
                      {lead && (
                        <button
                          className="cg-primary"
                          onClick={() => {
                            setMember({
                              id: uid(),
                              userId: null,
                              name: "",
                              initials: "",
                              role: "member",
                              capacity: 20,
                              skills: [],
                              weekdays: [0, 1, 2, 3, 4],
                              overrides: {},
                              color: "#dbe5cf",
                            });
                            setModal("member");
                          }}
                        >
                          Add teammate
                        </button>
                      )}
                    </div>
                    <LoadTable project={p} />
                  </section>
                  <div className="cg-team-grid">
                    {d.members.map((m) => (
                      <section className="cg-panel" key={m.id}>
                        <span
                          className="cg-avatar"
                          style={{ background: m.color }}
                        >
                          {m.initials || m.name.slice(0, 2)}
                        </span>
                        <h2>{m.name}</h2>
                        <p>
                          {m.role} ·{" "}
                          {m.userId ? "Joined" : "Awaiting invitation"}
                        </p>
                        <div className="cg-tags">
                          {m.skills.map((s) => (
                            <span key={s}>{s}</span>
                          ))}
                        </div>
                        <p>
                          {m.capacity}h / week · {m.weekdays.length} working
                          days
                        </p>
                        {lead && (
                          <div className="cg-actions">
                            <button
                              onClick={() => {
                                setMember(m);
                                setModal("member");
                              }}
                            >
                              Edit skills & calendar
                            </button>
                            {!m.userId && (
                              <button
                                disabled={busy}
                                onClick={() => getInvitation(m)}
                              >
                                Get invitation
                              </button>
                            )}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              )}
              {section === "Skill coverage" && (
                <>
                  <section className="cg-feature">
                    <div>
                      <span className="cg-caption">
                        THE SINGLE-SPECIALIST CASE
                      </span>
                      <h2>Keep the specialist. Give them room.</h2>
                      <p>
                        Matching requires every declared task skill. When only
                        one teammate qualifies, transfer their compatible side
                        work first. If no safe move exists, test prioritization,
                        reduced scope, or a new deadline. Pairing can build
                        future coverage; it does not instantly qualify a
                        replacement.
                      </p>
                    </div>
                    <button onClick={() => openScenario()}>
                      Open recovery lab <ArrowRight size={18} />
                    </button>
                  </section>
                  <section className="cg-panel cg-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Task & requirements</th>
                          {d.members.map((m) => (
                            <th key={m.id}>{m.name}</th>
                          ))}
                          <th>Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.tasks
                          .filter(
                            (t) => !["Done", "Deferred"].includes(t.status),
                          )
                          .map((t) => {
                            const eligible = d.members.filter((m) =>
                              t.requiredSkills.every((s) =>
                                m.skills.includes(s),
                              ),
                            );
                            return (
                              <tr key={t.id}>
                                <td>
                                  <button onClick={() => openTask(t)}>
                                    <b>{t.title}</b>
                                  </button>
                                  <small>
                                    {t.requiredSkills.join(", ") ||
                                      "General work"}
                                  </small>
                                </td>
                                {d.members.map((m) => (
                                  <td key={m.id}>
                                    {eligible.includes(m) ? "Qualified" : "—"}
                                  </td>
                                ))}
                                <td>
                                  <span
                                    className={
                                      "cg-pill " +
                                      (eligible.length < 2 ? "amber" : "green")
                                    }
                                  >
                                    {eligible.length === 1
                                      ? "Single specialist"
                                      : eligible.length === 0
                                        ? "Missing skill"
                                        : eligible.length + " matches"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </section>
                  {a.skillRisks.map((r) => (
                    <section className="cg-panel" key={r.taskId}>
                      <h2>{r.title}</h2>
                      <p>{r.reason}</p>
                      <small>
                        {r.downstream.length} dependent tasks exposed:{" "}
                        {r.downstream.join(", ") || "none"}
                      </small>
                    </section>
                  ))}
                </>
              )}
              {section === "Contributions" && (
                <section className="cg-panel cg-scroll">
                  <h2>Credit that keeps its context.</h2>
                  <p>
                    Accepted estimated effort, independent reviews, and
                    documented support stay separate. Documentation and blocker
                    evidence are self-reported; these are not grades or
                    productivity rankings.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Teammate</th>
                        <th>Accepted effort</th>
                        <th>Deliverables</th>
                        <th>Independent reviews</th>
                        <th>Documentation</th>
                        <th>Blocker evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.contributions.map((c) => (
                        <tr key={c.memberId}>
                          <td>{name(c.memberId)}</td>
                          <td>{c.acceptedEffort}h</td>
                          <td>{c.delivered}</td>
                          <td>{c.reviews}</td>
                          <td>{c.documentation}</td>
                          <td>{c.blockerResolutions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h2>Evidence trail</h2>
                  {d.tasks
                    .filter((t) => t.comments.length || t.acceptance)
                    .map((t) => (
                      <button
                        className="cg-risk"
                        key={t.id}
                        onClick={() => openTask(t)}
                      >
                        {t.id} · {t.title}{" "}
                        <span>
                          {t.acceptance || t.comments.length + " comments"}
                        </span>
                      </button>
                    ))}
                </section>
              )}
              {section === "Activity" && (
                <section className="cg-panel">
                  <h2>The shared record</h2>
                  {p.activity.map((e) => (
                    <div className="cg-event" key={e.id}>
                      <span className="cg-avatar">
                        {e.actor_name.slice(0, 1)}
                      </span>
                      <div>
                        <p>
                          <b>{e.actor_name}</b> {e.text}
                        </p>
                        <small>
                          {new Date(e.time).toLocaleString()} · {e.kind}
                        </small>
                        {e.taskId && (
                          <button
                            className="cg-text"
                            onClick={() => {
                              const t = d.tasks.find((t) => t.id === e.taskId);
                              if (t) openTask(t);
                            }}
                          >
                            {e.taskId}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
              )}
              {section === "What-if simulator" && (
                <div className="cg-two">
                  <section className="cg-panel">
                    <span className="cg-caption">
                      SIMULATE BEFORE YOU COMMIT
                    </span>
                    <h2>A plan your team can stand behind.</h2>
                    <p>
                      Test one change against the whole dependency graph and
                      each member’s calendar.
                    </p>
                    <form
                      className="cg-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () =>
                          setSimulation(
                            await post<Simulation>(
                              "/projects/" + p.id + "/simulate",
                              { ...scenario, version: p.version },
                            ),
                          ),
                        );
                      }}
                    >
                      <Field label="Planning change">
                        <select
                          value={scenario.kind}
                          onChange={(e) => {
                            setScenario({
                              ...scenario,
                              kind: e.target.value as Scenario["kind"],
                              value: "",
                            });
                            setSimulation(null);
                          }}
                        >
                          {[
                            "reassign",
                            "prioritize",
                            "defer",
                            "deadline",
                            "availability",
                          ].map((k) => (
                            <option key={k} value={k}>
                              {
                                (
                                  {
                                    reassign: "Reassign a task",
                                    prioritize: "Change task priority",
                                    defer: "Defer a task",
                                    deadline: "Change project deadline",
                                    availability: "Change member availability",
                                  } as Record<string, string>
                                )[k]
                              }
                            </option>
                          ))}
                        </select>
                      </Field>
                      {["reassign", "prioritize", "defer"].includes(
                        scenario.kind,
                      ) && (
                        <Field label="Task">
                          <select
                            required
                            value={scenario.taskId}
                            onChange={(e) => {
                              setScenario({
                                ...scenario,
                                taskId: e.target.value,
                              });
                              setSimulation(null);
                            }}
                          >
                            <option value="">Choose a task</option>
                            {d.tasks
                              .filter((t) => t.status === "To do")
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}
                      {["reassign", "availability"].includes(scenario.kind) && (
                        <Field label="Team member">
                          <select
                            required
                            value={scenario.memberId}
                            onChange={(e) => {
                              setScenario({
                                ...scenario,
                                memberId: e.target.value,
                              });
                              setSimulation(null);
                            }}
                          >
                            <option value="">Choose a member</option>
                            {d.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {["deadline", "availability"].includes(scenario.kind) && (
                        <Field
                          label={
                            scenario.kind === "deadline"
                              ? "New deadline"
                              : "Weekly capacity (hours)"
                          }
                        >
                          <input
                            required
                            type={
                              scenario.kind === "deadline" ? "date" : "number"
                            }
                            min={0}
                            max={84}
                            step={0.5}
                            value={scenario.value}
                            onChange={(e) => {
                              setScenario({
                                ...scenario,
                                value: e.target.value,
                              });
                              setSimulation(null);
                            }}
                          />
                        </Field>
                      )}
                      <Field label="Decision reason">
                        <textarea
                          required
                          value={scenario.reason}
                          placeholder="Why is this change appropriate for your team?"
                          onChange={(e) => {
                            setScenario({
                              ...scenario,
                              reason: e.target.value,
                            });
                            setSimulation(null);
                          }}
                        />
                      </Field>
                      {scenario.kind === "defer" && (
                        <p className="cg-alert">
                          Deferral removes the task and its dependent scope from
                          this delivery. It does not count as completed work.
                        </p>
                      )}
                      <button className="cg-primary" disabled={busy}>
                        Run simulation
                      </button>
                    </form>
                  </section>
                  <section className="cg-panel">
                    {simulation ? (
                      <>
                        <h2>Preview · project version {simulation.version}</h2>
                        <div className="cg-compare">
                          <div>
                            <small>Current forecast</small>
                            <strong>
                              {dateLabel(simulation.before.forecast.date)}
                            </strong>
                            <p>
                              {simulation.before.forecast.delay ?? "Unknown"}{" "}
                              days late
                            </p>
                          </div>
                          <ArrowRight size={24} />
                          <div>
                            <small>Proposed forecast</small>
                            <strong>
                              {dateLabel(simulation.after.forecast.date)}
                            </strong>
                            <p>
                              {simulation.after.forecast.delay ?? "Unknown"}{" "}
                              days late
                            </p>
                          </div>
                        </div>
                        <p>
                          {simulation.after.forecast.conditional
                            ? "Conditional on blocker resolution dates."
                            : "Based on the entered calendars and estimates."}
                        </p>
                        <p>
                          Affected scope:{" "}
                          {simulation.affected.join(", ") ||
                            "Project calendar or deadline"}
                        </p>
                        {simulation.after.health.reasons.map((r, i) => (
                          <p className="cg-risk" key={i}>
                            {r.text}
                          </p>
                        ))}
                        <button
                          className="cg-primary"
                          disabled={
                            busy || !lead || simulation.version !== p.version
                          }
                          onClick={() =>
                            run(async () => {
                              await command(
                                "scenario.apply",
                                simulation.scenario,
                              );
                              setSimulation(null);
                            })
                          }
                        >
                          Approve & record decision
                        </button>
                        {simulation.version !== p.version && (
                          <p>Project changed. Run the simulation again.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2>Suggested starting points</h2>
                        {a.recommendations.length ? (
                          a.recommendations.map((r) => (
                            <button
                              className="cg-recommend"
                              key={r.id}
                              onClick={() => {
                                setScenario({
                                  version: p.version,
                                  kind: "reassign",
                                  taskId: r.taskId,
                                  memberId: r.memberId,
                                  value: "",
                                  reason:
                                    "Protect specialist time by transferring qualified side work.",
                                });
                                setSimulation(null);
                              }}
                            >
                              <strong>{r.title}</strong>
                              <p>{r.reason}</p>
                              <small>
                                {r.hours}h transferred ·{" "}
                                {r.recoveredDays ?? "Unknown"} days recovered
                              </small>
                            </button>
                          ))
                        ) : (
                          <p>
                            No safe redistribution was found. Try
                            prioritization, explicit scope reduction, or a
                            realistic deadline.
                          </p>
                        )}
                        <details>
                          <summary>How the forecast works</summary>
                          <SkiperLink href="https://developers.google.com/optimization/scheduling/job_shop">
                            Scheduling constraints reference
                          </SkiperLink>
                          {a.forecast.assumptions.map((s) => (
                            <p key={s}>{s}</p>
                          ))}
                        </details>
                      </>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {modal === "project" && (
        <Modal title="Create a project" close={() => setModal("")}>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                const r = await post<{ id: string }>("/projects", {
                  name: f.get("name"),
                  description: f.get("description"),
                  deadline: f.get("deadline"),
                  sample: f.get("sample") === "on",
                });
                await refresh(r.id);
                setModal("");
              });
            }}
          >
            <Field label="Project name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field label="What are you building?">
              <textarea name="description" maxLength={500} />
            </Field>
            <Field label="Delivery deadline">
              <input type="date" name="deadline" required />
            </Field>
            <label>
              <input type="checkbox" name="sample" /> Include clearly labelled
              example tasks and team profiles
            </label>
            <button className="cg-primary" disabled={busy}>
              Create project
            </button>
          </form>
        </Modal>
      )}
      {modal === "request" && p && (
        <RequestComposer
          project={p}
          taskId={requestTask}
          close={() => setModal("")}
          command={command}
        />
      )}
      {modal === "archive" && task && p && (
        <Modal title="Archive this task?" close={() => setModal("")}>
          <p>
            <strong>{task.title}</strong> will leave the active board and
            workload forecast. Its comments and attachments are kept. A lead can
            restore it from Archived tasks.
          </p>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await command("task.archive", {
                  taskId: task.id,
                  reason: archiveReason,
                });
                setModal("");
              });
            }}
          >
            <Field label="Reason for archiving">
              <textarea
                required
                maxLength={500}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
              />
            </Field>
            <button className="cg-primary" disabled={busy}>
              Archive task
            </button>
            <button
              type="button"
              className="cg-text"
              onClick={() => setModal("task")}
            >
              Keep task
            </button>
          </form>
        </Modal>
      )}
      {modal === "invite" && member && (
        <InvitationDialog
          memberName={member.name}
          code={invitationCode}
          busy={busy}
          error={error}
          close={() => {
            setModal("");
            setInvitationCode("");
          }}
          retry={() => getInvitation(member)}
        />
      )}
      {modal === "join" && (
        <Modal title="Join your team" close={() => setModal("")}>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                const r = await post<{ id: string }>("/join", {
                  code: f.get("code"),
                });
                await refresh(r.id);
                setModal("");
              });
            }}
          >
            <Field label="Single-use invitation code">
              <input name="code" required />
            </Field>
            <button className="cg-primary" disabled={busy}>
              Join project
            </button>
          </form>
        </Modal>
      )}
      {modal === "settings" && d && (
        <Modal title="Project settings" close={() => setModal("")}>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                await command("project.update", {
                  name: f.get("name"),
                  description: f.get("description"),
                  deadline: f.get("deadline"),
                  timezone: f.get("timezone"),
                  holidays: String(f.get("holidays"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                setModal("");
              });
            }}
          >
            <Field label="Name">
              <input required name="name" defaultValue={d.name} />
            </Field>
            <Field label="Description">
              <textarea name="description" defaultValue={d.description} />
            </Field>
            <Field label="Deadline">
              <input
                required
                type="date"
                name="deadline"
                defaultValue={d.deadline}
              />
            </Field>
            <Field label="IANA timezone">
              <input required name="timezone" defaultValue={d.timezone} />
            </Field>
            <Field label="Holidays (YYYY-MM-DD, comma separated)">
              <input name="holidays" defaultValue={d.holidays.join(", ")} />
            </Field>
            <button className="cg-primary" disabled={busy}>
              Save settings
            </button>
          </form>
        </Modal>
      )}
      {modal === "milestone" && d && (
        <Modal title="Plan milestone" close={() => setModal("")}>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                await command("milestone.save", {
                  id: uid(),
                  name: f.get("name"),
                  due: f.get("due"),
                });
                setModal("");
              });
            }}
          >
            <Field label="Milestone name">
              <input name="name" required />
            </Field>
            <Field label="Due date">
              <input
                name="due"
                type="date"
                required
                defaultValue={d.deadline}
              />
            </Field>
            <button className="cg-primary" disabled={busy}>
              Save milestone
            </button>
          </form>
        </Modal>
      )}
      {modal === "member" && member && (
        <Modal title="Skills & availability" close={() => setModal("")}>
          <form
            className="cg-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                await command("member.save", {
                  ...member,
                  name: f.get("name"),
                  initials: String(f.get("name"))
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2),
                  role: f.get("role"),
                  capacity: Number(f.get("capacity")),
                  skills: splitSkills(String(f.get("skills"))),
                  weekdays: f.getAll("weekday").map(Number),
                  overrides: JSON.parse(String(f.get("overrides") || "{}")),
                });
                setModal("");
              });
            }}
          >
            <Field label="Name">
              <input name="name" required defaultValue={member.name} />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue={member.role}>
                <option>member</option>
                <option>reviewer</option>
                <option>lead</option>
              </select>
            </Field>
            <Field label="Skills (comma separated)">
              <input name="skills" defaultValue={member.skills.join(", ")} />
            </Field>
            <Field label="Weekly availability (hours)">
              <input
                name="capacity"
                type="number"
                required
                min={0}
                max={84}
                step={0.5}
                defaultValue={member.capacity}
              />
            </Field>
            <fieldset>
              <legend>Working days</legend>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((s, i) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    name="weekday"
                    value={i}
                    defaultChecked={member.weekdays.includes(i)}
                  />
                  {s}{" "}
                </label>
              ))}
            </fieldset>
            <Field label={'Date overrides: {"2026-10-30": 0} for time off'}>
              <textarea
                name="overrides"
                defaultValue={JSON.stringify(member.overrides)}
              />
            </Field>
            <button className="cg-primary" disabled={busy}>
              Save teammate
            </button>
          </form>
        </Modal>
      )}
      {modal === "task" && task && d && p && (
        <Modal title={task.id + " · Task details"} close={() => setModal("")}>
          {d.tasks.some((t) => t.id === task.id) && (
            <TaskQuickActions
              key={task.id + ":" + modalVersion}
              project={p}
              task={task}
              command={async (type, payload) => {
                await command(type, payload);
                setModal("");
              }}
              askLead={() => askLead(task.id)}
              viewRequests={() => {
                setModal("");
                setSection("Team requests");
              }}
              archive={() => {
                setArchiveReason("");
                setModal("archive");
              }}
            />
          )}
          <details
            className="cg-task-detail"
            open={!d.tasks.some((t) => t.id === task.id)}
          >
            <summary>
              {lead
                ? "Planning details: assignment, dates, and dependencies"
                : "View planning details"}
            </summary>
            <form
              className="cg-form"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await command("task.save", task);
                  setModal("");
                });
              }}
            >
              <Field label="Task title">
                <input
                  required
                  value={task.title}
                  disabled={!lead || task.status === "Done"}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={task.description}
                  disabled={!lead || task.status === "Done"}
                  onChange={(e) =>
                    setTask({ ...task, description: e.target.value })
                  }
                />
              </Field>
              <div className="cg-form-grid">
                <Field label="Required skills">
                  <input
                    value={task.requiredSkills.join(", ")}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({
                        ...task,
                        requiredSkills: e.target.value
                          .split(",")
                          .map((s) => s.trim().toLowerCase()),
                      })
                    }
                    onBlur={() =>
                      setTask({
                        ...task,
                        requiredSkills: task.requiredSkills.filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Owner">
                  <select
                    value={task.owner}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({ ...task, owner: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {d.members.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={
                          !task.requiredSkills
                            .filter(Boolean)
                            .every((s) => m.skills.includes(s))
                        }
                      >
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estimated hours">
                  <input
                    type="number"
                    min={0.5}
                    max={500}
                    step={0.5}
                    value={task.effort}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({ ...task, effort: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Remaining hours">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={0.5}
                    value={task.remaining}
                    disabled={!lead && task.owner !== me?.id}
                    onChange={(e) =>
                      setTask({ ...task, remaining: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={task.priority}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({
                        ...task,
                        priority: e.target.value as Task["priority"],
                      })
                    }
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </Field>
                <Field label="Due date">
                  <input
                    type="date"
                    required
                    value={task.due}
                    disabled={!lead}
                    onChange={(e) => setTask({ ...task, due: e.target.value })}
                  />
                </Field>
                <Field label="Milestone">
                  <select
                    value={task.milestone}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({ ...task, milestone: e.target.value })
                    }
                  >
                    <option value="">No milestone</option>
                    {d.milestones.map((m) => (
                      <option key={m.id}>{m.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Earliest start">
                  <input
                    type="date"
                    value={task.earliestStart || ""}
                    disabled={!lead}
                    onChange={(e) =>
                      setTask({
                        ...task,
                        earliestStart: e.target.value || null,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Prerequisites (hold Ctrl to select multiple)">
                <select
                  multiple
                  value={task.dependencies}
                  disabled={!lead}
                  onChange={(e) =>
                    setTask({
                      ...task,
                      dependencies: Array.from(e.target.selectedOptions).map(
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {d.tasks
                    .filter((t) => t.id !== task.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} · {t.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Blocker">
                <input
                  value={task.blocker}
                  disabled={!lead && task.owner !== me?.id}
                  placeholder="What is preventing progress?"
                  onChange={(e) =>
                    setTask({ ...task, blocker: e.target.value })
                  }
                />
              </Field>
              <Field label="Expected blocker resolution (leave empty if unknown)">
                <input
                  type="date"
                  value={task.blockedUntil || ""}
                  disabled={!lead && task.owner !== me?.id}
                  onChange={(e) =>
                    setTask({ ...task, blockedUntil: e.target.value || null })
                  }
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={task.locked}
                  disabled={!lead}
                  onChange={(e) =>
                    setTask({ ...task, locked: e.target.checked })
                  }
                />{" "}
                Protect assignment from recovery suggestions
              </label>
              {lead && task.status !== "Done" && (
                <button className="cg-primary" disabled={busy}>
                  Save task details
                </button>
              )}
            </form>
          </details>
          {d.tasks.some((t) => t.id === task.id) && (
            <>
              <h2>Discussion & evidence</h2>
              {(d.tasks.find((t) => t.id === task.id)?.comments || []).map(
                (c) => (
                  <div className="cg-comment" key={c.id}>
                    <small>
                      {name(c.author)} · {c.kind}
                    </small>
                    <p>{c.text}</p>
                  </div>
                ),
              )}
              <form
                className="cg-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const form = e.currentTarget;
                  run(async () => {
                    await command("comment.add", {
                      taskId: task.id,
                      text: f.get("text"),
                      kind: f.get("kind"),
                    });
                    form.reset();
                  });
                }}
              >
                <select name="kind" aria-label="Evidence type">
                  <option value="comment">Comment</option>
                  <option value="documentation">Documentation evidence</option>
                  <option value="blocker-resolution">
                    Blocker resolution evidence
                  </option>
                </select>
                <textarea
                  name="text"
                  required
                  aria-label="Comment"
                  placeholder="Share an update or link to evidence…"
                />
                <button className="cg-primary" disabled={busy}>
                  Add update
                </button>
              </form>
              <h2>Attachments</h2>
              {(d.tasks.find((t) => t.id === task.id)?.files || []).map((f) => (
                <p key={f.id}>
                  <a
                    href={
                      (process.env.NEXT_PUBLIC_APP_BASE_PATH || "") +
                      "/api/files/" +
                      f.id
                    }
                  >
                    {f.name}
                  </a>{" "}
                  · {Math.ceil(f.size / 1024)} KB
                </p>
              ))}
              <Field label="Attach PDF, image, TXT or CSV (up to 5 MB)">
                <input
                  type="file"
                  disabled={busy}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      run(async () => {
                        const body = new FormData();
                        body.set("file", file);
                        body.set("version", String(p.version));
                        setP(
                          await api<Project>(
                            "/projects/" +
                              p.id +
                              "/tasks/" +
                              task.id +
                              "/files",
                            { method: "POST", body },
                          ),
                        );
                      });
                  }}
                />
              </Field>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
