export type Status =
  "To do" | "In progress" | "In review" | "Done" | "Deferred";
export type User = {
  id: string;
  name: string;
  email: string;
  provider?: string;
};
export type Member = {
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  role: "lead" | "member" | "reviewer";
  capacity: number;
  skills: string[];
  weekdays: number[];
  overrides: Record<string, number>;
  color: string;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  owner: string;
  effort: number;
  remaining: number;
  status: Status;
  priority: "High" | "Medium" | "Low";
  due: string;
  dependencies: string[];
  requiredSkills: string[];
  milestone: string;
  blocker: string;
  blockedUntil: string | null;
  earliestStart: string | null;
  locked: boolean;
  rank: number;
  submittedBy: string | null;
  acceptedBy: string | null;
  acceptance: string | null;
  comments: {
    id: string;
    author: string;
    text: string;
    kind: string;
    time: string;
  }[];
  files: { id: string; name: string; size: number; mediaType: string }[];
};
export type ProjectData = {
  requests?: TeamRequest[];
  archivedTasks?: {
    task: Task;
    archivedBy: string;
    archivedAt: string;
    reason: string;
  }[];
  updates: {
    id: string;
    author: string;
    time: string;
    health: "On track" | "At risk" | "Off track";
    summary: string;
    nextSteps: string;
  }[];
  wipLimits: Partial<Record<"In progress" | "In review", number>>;
  name: string;
  description: string;
  deadline: string;
  timezone: string;
  holidays: string[];
  members: Member[];
  tasks: Task[];
  milestones: { id: string; name: string; due: string }[];
};
export type TeamRequest = {
  id: string;
  author: string;
  taskId: string;
  category:
    | "Help"
    | "Deadline change"
    | "Reassignment"
    | "New task"
    | "Archive task"
    | "Other";
  message: string;
  status: "Open" | "Resolved" | "Declined" | "Cancelled";
  createdAt: string;
  response: string;
  respondedBy: string;
  respondedAt: string;
};
export type Forecast = {
  asOf: string;
  date: string | null;
  partialDate: string;
  delay: number | null;
  complete: boolean;
  conditional: boolean;
  unscheduled: string[];
  excluded: string[];
  assumptions: string[];
  tasks: Record<
    string,
    {
      start: string | null;
      finish: string | null;
      finishSlot: number | null;
      allocations: { date: string; hours: number }[];
      state: string;
      reason: string;
    }
  >;
};
export type Workload = Member & {
  assigned: number;
  dueEffort: number;
  available: number;
  blocked: number;
  utilization: number | null;
  scheduledThisWeek: number;
};
export type SkillRisk = {
  taskId: string;
  title: string;
  skills: string[];
  kind: "single-specialist" | "missing-skill";
  members: string[];
  downstream: string[];
  reason: string;
};
export type Recommendation = {
  id: string;
  kind: string;
  taskId: string;
  memberId: string;
  title: string;
  reason: string;
  forecast: string;
  hours: number;
  recoveredDays: number | null;
};
export type Analysis = {
  forecast: Forecast;
  workload: Workload[];
  skillRisks: SkillRisk[];
  health: {
    tone: string;
    label: string;
    reasons: {
      severity: string;
      code: string;
      text: string;
      taskId?: string;
    }[];
  };
  recommendations: Recommendation[];
  contributions: {
    memberId: string;
    delivered: number;
    acceptedEffort: number;
    reviews: number;
    documentation: number;
    blockerResolutions: number;
  }[];
  summary: {
    total: number;
    done: number;
    deferred: number;
    remaining: number;
    blockers: number;
  };
};
export type Activity = {
  id: string;
  actor: string;
  actor_name: string;
  kind: string;
  taskId: string;
  text: string;
  time: string;
  meta: Record<string, unknown>;
};
export type Project = {
  id: string;
  version: number;
  myMemberId: string;
  data: ProjectData;
  activity: Activity[];
  analysis: Analysis;
};
export type Scenario = {
  version: number;
  kind: "reassign" | "prioritize" | "defer" | "deadline" | "availability";
  taskId: string;
  memberId: string;
  value: string;
  reason: string;
};
export type Simulation = {
  before: Analysis;
  after: Analysis;
  affected: string[];
  version: number;
  canApprove: boolean;
  scenario: Scenario;
};
export const dateLabel = (value: string | null | undefined) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "Unknown";
export const splitSkills = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
