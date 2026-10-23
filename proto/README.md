# ContriGraph

An algorithm-driven project management prototype for Team Xyphic’s TechTrix BONUS02 entry. Built from the presentation and the shared conversation’s decision to skip generative AI.

## Run

Requires Node 20.9+.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. `npm test` runs the scheduling and analysis tests. `npm run build` creates a static production export in `out/`.

## Working features

- Multiple projects with descriptions and deadlines, plus editable member availability.
- Task creation/editing, priorities, owners, estimated/remaining hours, milestone assignment, deadlines, status, comments and local evidence attachments.
- Kanban with drag and drop and explicit completion approval. Open prerequisites prevent completion.
- React Flow dependency graph, new dependency connections, cycle prevention, manual blockers and release delays.
- Deterministic resource-constrained greedy forecast, with owner availability and prerequisite finish constraints.
- Weekly capacity analysis that separates ready work from blocked effort.
- Skill/capacity-checked redistribution recommendations. What-If scenarios recalculate delivery and show task start/finish offsets before approval.
- Contribution dimensions for accepted effort, reviews, documentation and blocker resolution. No ranking or automatic grade.
- Explainable health rules, overdue alerts, project activity, in-app reports, JSON reports, contribution CSV and workspace backup.
- Responsive custom UI, React Bits CountUp, GSAP navigation motion, Lenis scrolling, Vengeance UI CornerButton, and a custom WebGL shader. See `docs/DESIGN-SOURCES.md`.

## Demo scenario

The sample is a snapshot anchored to **23 October 2026**, with a deadline of 30 October. Om has 30h assigned, Moksh 18h, and Manish 6h, against 20h each. The scheduler forecasts 9.5 elapsed days (2 November, rounded up). Moving the independent 12h testing task from Om to qualified teammate Manish balances all three at 90% and recalculates delivery to 6.5 days (30 October). The simulator proves the date separately from the utilization improvement. Input estimates can change the result.

## Honest prototype boundaries

All application state and attachments are saved in browser localStorage. New visitors receive sample data. There is no authentication, server authorization, live collaboration, cloud upload, trusted audit trail or notification delivery. Comments and evidence are self-reported. “Approve” is a local workflow action, not a protected team-lead permission. Reports disclose this limitation.

The forecasting engine currently runs as pure TypeScript functions in `lib/engine.ts`, so the demo works without credentials or a Python service. FastAPI/NetworkX and Supabase from the proposal are the next integration phase, not dependencies pretending to be connected.

The greedy scheduler is valid but not guaranteed optimal. It reserves uninterrupted owner time for one task at a time, uses uniform daily availability (`weekly hours / 5`), and maps elapsed offsets to calendar dates without weekends or holidays. Manual blockers need an earliest-start estimate. Task delays, health thresholds and capacity are explainable calculations, not learned predictions. Workload compares all remaining project work to one week of capacity; multiple deadline windows are future work.

## Next implementation phase

1. Supabase Auth and project membership, normalized Postgres records, RLS policies, private Storage buckets and Realtime subscriptions.
2. Server-generated audit events and independent reviewer approvals, enforced by database policies and protected functions.
3. Move the six intelligence functions behind FastAPI with NetworkX DAG validation. Preserve the tested TypeScript examples as cross-language contract fixtures.
4. Add calendars, time windows, partially consumed availability and task splitting to the scheduler.
5. Backend email/in-app alert delivery, signed evidence URLs and trusted report exports.

No API keys or user contact details from the presentation are included in the source.
