import { Task } from "./types";
/** Server guarantees a DAG. Group nodes by prerequisite depth for readable arrows. */
export function dependencyPositions(tasks: Task[]) {
  const depths = new Map<string, number>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = (id: string): number => {
    if (depths.has(id)) return depths.get(id)!;
    const task = byId.get(id);
    const value = task?.dependencies.length
      ? 1 + Math.max(...task.dependencies.map(depth))
      : 0;
    depths.set(id, value);
    return value;
  };
  const lanes = new Map<number, number>();
  const positions: Record<string, { x: number; y: number }> = {};
  for (const task of tasks) {
    const level = depth(task.id);
    const lane = lanes.get(level) || 0;
    positions[task.id] = { x: lane * 285, y: level * 190 };
    lanes.set(level, lane + 1);
  }
  return positions;
}
