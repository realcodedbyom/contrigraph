"use client";
import { useState } from "react";
import { Project, Task, dateLabel } from "@/lib/types";

const statuses = [
  "To do",
  "In progress",
  "In review",
  "Done",
  "Deferred",
] as const;
const views = [
  "All tasks",
  "My work",
  "Overdue",
  "Blocked",
  "Review queue",
  "Unassigned",
] as const;

export default function TaskBoard({
  project,
  openTask,
  initialView = "All tasks",
}: {
  project: Project;
  openTask: (task: Task) => void;
  initialView?: string;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<string>(initialView);
  const [owner, setOwner] = useState("");
  const [priority, setPriority] = useState("");
  const [milestone, setMilestone] = useState("");
  const [sort, setSort] = useState("due");
  const { data, analysis, myMemberId } = project;
  const names = new Map(data.members.map((m) => [m.id, m.name]));
  const excluded = new Set(analysis.forecast.excluded);
  const active = (task: Task) =>
    task.status !== "Done" && !excluded.has(task.id);
  const blocked = (task: Task) =>
    active(task) &&
    Boolean(
      task.blocker ||
      task.dependencies.some(
        (id) => data.tasks.find((t) => t.id === id)?.status !== "Done",
      ),
    );
  const matchesView = (task: Task, selected: string) => {
    if (selected === "My work")
      return task.owner === myMemberId && active(task);
    if (selected === "Overdue")
      return active(task) && task.due < analysis.forecast.asOf;
    if (selected === "Blocked") return blocked(task);
    if (selected === "Review queue")
      return task.status === "In review" && active(task);
    if (selected === "Unassigned") return !task.owner && active(task);
    return true;
  };
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const filtered = data.tasks
    .filter(
      (task) =>
        matchesView(task, view) &&
        (!owner ||
          (owner === "unassigned" ? !task.owner : task.owner === owner)) &&
        (!priority || task.priority === priority) &&
        (!milestone || task.milestone === milestone) &&
        [
          task.id,
          task.title,
          task.description,
          names.get(task.owner) || "Unassigned",
          ...task.requiredSkills,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        (sort === "priority"
          ? priorityOrder[a.priority] - priorityOrder[b.priority]
          : sort === "effort"
            ? b.remaining - a.remaining
            : a.due.localeCompare(b.due)) || a.id.localeCompare(b.id),
    );
  const reset = () => {
    setQuery("");
    setView("All tasks");
    setOwner("");
    setPriority("");
    setMilestone("");
    setSort("due");
  };
  return (
    <>
      {Object.entries(data.wipLimits).map(([status, limit]) => {
        const count = data.tasks.filter((t) => t.status === status).length;
        return (
          <p
            key={status}
            className={count > limit! ? "cg-alert" : "cg-filter-summary"}
            role="status"
          >
            {status}: {count} / {limit} across the whole project
            {count > limit!
              ? ". WIP limit exceeded. Finish or review existing work before starting more."
              : ". Within WIP limit."}
          </p>
        );
      })}
      <div className="cg-task-views" aria-label="Task views">
        {views.map((item) => (
          <button
            key={item}
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {item}{" "}
            <span>{data.tasks.filter((t) => matchesView(t, item)).length}</span>
          </button>
        ))}
      </div>
      <div className="cg-task-filters">
        <label>
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, ID, skill or person"
          />
        </label>
        <label>
          Owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Any priority</option>
            {["High", "Medium", "Low"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Milestone
          <select
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
          >
            <option value="">All milestones</option>
            {Array.from(
              new Set(data.tasks.map((t) => t.milestone).filter(Boolean)),
            ).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="effort">Remaining effort</option>
          </select>
        </label>
        <button className="cg-text" onClick={reset}>
          Reset filters
        </button>
      </div>
      <p className="cg-filter-summary" role="status">
        Showing {filtered.length} of {data.tasks.length} tasks. View counts
        cover the whole project.
      </p>
      {!filtered.length ? (
        <section className="cg-panel">
          <h2>No matching tasks</h2>
          <p>Try another view or clear your filters.</p>
          <button className="cg-text" onClick={reset}>
            Show all tasks
          </button>
        </section>
      ) : (
        <div className="cg-board">
          {statuses.map((status) => (
            <section key={status}>
              <h2>
                {status}
                <span>
                  {filtered.filter((t) => t.status === status).length}
                </span>
              </h2>
              {filtered
                .filter((t) => t.status === status)
                .map((task) => (
                  <button
                    className="cg-task"
                    key={task.id}
                    onClick={() => openTask(task)}
                  >
                    <div>
                      <small>{task.id}</small>
                      <span
                        className={
                          "cg-pill " +
                          (task.priority === "High" ? "amber" : "neutral")
                        }
                      >
                        {task.priority}
                      </span>
                    </div>
                    <h3>{task.title}</h3>
                    <p>{task.requiredSkills.join(" · ") || "General work"}</p>
                    {blocked(task) && (
                      <span className="cg-blocked">
                        Waiting on{" "}
                        {task.blocker ? "a blocker" : "prerequisites"}
                      </span>
                    )}
                    <footer>
                      <span>{names.get(task.owner) || "Unassigned"}</span>
                      <b>{task.remaining}h</b>
                    </footer>
                    <small>
                      {active(task) && task.due < analysis.forecast.asOf
                        ? "Overdue · "
                        : "Due "}
                      {dateLabel(task.due)}
                    </small>
                  </button>
                ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
