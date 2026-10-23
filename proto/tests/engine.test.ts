import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/seed";
import {
  schedule,
  topologicalSort,
  workload,
  recommendations,
  contributions,
  health,
} from "../lib/engine";
const copy = () => structuredClone(seed);
test("forecast respects dependencies and does not overlap an owner’s tasks", () => {
  const p = copy(),
    s = schedule(p);
  for (const t of p.tasks.filter((t) => t.status !== "Done"))
    for (const d of t.dependencies)
      assert.ok(s.tasks[t.id].start >= s.tasks[d].finish);
  for (const m of p.members) {
    const slots = p.tasks
      .filter((t) => t.owner === m.id && t.status !== "Done")
      .map((t) => s.tasks[t.id])
      .sort((a, b) => a.start - b.start);
    for (let i = 1; i < slots.length; i++)
      assert.ok(slots[i].start >= slots[i - 1].finish);
  }
  assert.equal(s.finish, 9.5);
  assert.equal(s.delay, 3);
});
test("a cycle is rejected before forecasting", () => {
  const p = copy();
  p.tasks[0].dependencies = ["CG-09"];
  p.tasks[3].dependencies = ["CG-01"];
  assert.throws(() => topologicalSort(p.tasks), /cycle/);
});
test("unknown dependencies are rejected", () => {
  const p = copy();
  p.tasks[0].dependencies = ["missing"];
  assert.throws(() => schedule(p), /Unknown dependency/);
});
test("recommendation balances effort and verifies delivery independently", () => {
  const p = copy(),
    rec = recommendations(p)[0];
  assert.equal(rec.task.id, "CG-08");
  assert.equal(rec.to, "manish");
  const changed = {
    ...p,
    tasks: p.tasks.map((t) =>
      t.id === rec.task.id ? { ...t, owner: rec.to } : t,
    ),
  };
  assert.deepEqual(
    workload(p).map((m) => m.utilization),
    [150, 90, 30],
  );
  assert.deepEqual(
    workload(changed).map((m) => m.utilization),
    [90, 90, 90],
  );
  assert.equal(schedule(changed).finish, 6.5);
  assert.equal(schedule(changed).delay, 0);
  assert.equal(p.tasks.find((t) => t.id === "CG-08")!.owner, "om");
});
test("no recommendation forces a skill mismatch", () => {
  const p = copy();
  p.members.find((m) => m.id === "manish")!.skills = ["frontend"];
  assert.equal(recommendations(p).length, 0);
});
test("no recommendation exceeds the recipient’s weekly capacity", () => {
  const p = copy();
  p.members.find((m) => m.id === "manish")!.capacity = 10;
  assert.equal(recommendations(p).length, 0);
});
test("blocked work is separate from ready work and never becomes free capacity", () => {
  const om = workload(copy())[0];
  assert.equal(om.assigned, 30);
  assert.equal(om.blocked, 18);
  assert.equal(om.ready, 12);
});
test("release delays propagate to downstream tasks", () => {
  const p = copy();
  p.tasks.find((t) => t.id === "CG-07")!.release = 5;
  const s = schedule(p);
  assert.equal(s.tasks["CG-07"].start, 5);
  assert.ok(s.tasks["CG-09"].start >= s.tasks["CG-07"].finish);
  assert.ok(s.delay > schedule(seed).delay);
});
test("health names its measured risk reasons", () => {
  const h = health(copy());
  assert.equal(h.label, "At risk");
  assert.ok(h.reasons.some((r) => r.includes("3 days")));
  assert.ok(h.reasons.some((r) => r.includes("150%")));
});
test("contribution dimensions count accepted effort separately from other evidence", () => {
  const c = contributions(copy());
  assert.equal(c[0].delivered, 8);
  assert.equal(c[0].docs, 1);
  assert.equal(c[0].help, 1);
  assert.equal(c[1].reviews, 1);
});
test("empty project has a valid forecast and no false risk", () => {
  const p = { ...copy(), tasks: [], activity: [] };
  assert.equal(schedule(p).finish, 0);
  assert.equal(health(p).label, "On track");
  assert.equal(recommendations(p).length, 0);
});
test("completed work uses no future capacity", () => {
  const p = copy();
  p.tasks = p.tasks.map((t) => ({ ...t, status: "Done", remaining: 0 }));
  assert.equal(schedule(p).finish, 0);
  assert.ok(workload(p).every((m) => m.assigned === 0));
});
test("invalid capacity and negative effort do not yield misleading forecasts", () => {
  const p = copy();
  p.members[0].capacity = 0;
  assert.throws(() => schedule(p), /capacity/);
  p.members[0].capacity = 20;
  p.tasks[0].remaining = -1;
  assert.throws(() => schedule(p), /non-negative/);
});
test("duplicate task identifiers are rejected", () => {
  const p = copy();
  p.tasks.push({ ...p.tasks[0] });
  assert.throws(() => schedule(p), /unique/);
});
