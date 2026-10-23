# Main-build research and decisions

Research date: 23 October 2026. Sources below are official technical documentation or original research. The rules and UI decisions are our implementation choices, not claims made by the sources.

## The teacher's edge case

**One qualified person is a skill bottleneck, not a reason to assign the task to an unqualified person.** Keep the specialist on the task. Search their other, unstarted work for transferable tasks. Simulate prioritizing the specialist task. Check the actual finish date after each change. If no feasible recovery exists, explicitly show the constraint and ask the lead to decide on scope, time, or additional qualified help.

The system must distinguish three states:

| Coverage | Meaning | Product behavior |
| --- | --- | --- |
| Zero qualified members | Missing skill | No fabricated finish date for that task or its dependents. Add qualified capacity, change the requirement through a reviewed scope decision, or mark the project forecast incomplete. |
| One qualified member | Specialist dependency | Preserve the owner. Protect their time by moving compatible work, test sequencing changes, and record a knowledge-sharing recommendation. |
| Several qualified members | Redistributable work | Test skill, calendar capacity, dependencies, assignment restrictions, and delivery impact before recommending a move. |

Paired work and training are long-term options. They do not instantly create proficiency or halve task duration. Adding a skill requires an explicit roster change by the lead. No automatic overtime, invented estimate reductions, or unsupported deadline promises.

## What the research changes

### Scheduling and dependency integrity

[Google OR-Tools: job-shop scheduling](https://developers.google.com/optimization/scheduling/job_shop) separates precedence from resource exclusivity and demonstrates that a valid schedule can still be suboptimal. ContriGraph therefore validates both constraints and labels its greedy schedule as a forecast, not an optimum. Task effort is allocated into half-hour calendar slots; dependencies release only after the predecessor's final slot.

[Google OR-Tools: employee scheduling](https://developers.google.com/optimization/scheduling/employee_scheduling) treats staffing rules as constraints. Our skill eligibility is a hard assignment constraint. Preference, workload balance, and finish-date improvement cannot override it.

[NetworkX topological sorting](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.dag.topological_sort.html) requires a directed acyclic graph. Every mutation validates task references, self-links, and cycles before saving. Cyclic changes fail atomically and create no success audit event.

[NetworkX longest paths](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.dag.dag_longest_path.html) works on the dependency graph. A dependency-only longest path is not automatically the resource-constrained delivery path. Our UI describes affected downstream tasks without pretending graph topology alone proves the finish date.

[Microsoft: how Project schedules work](https://support.microsoft.com/en-us/project/how-project-schedules-tasks-behind-the-scenes) explains calendars, task links, resource availability and finish dates. Our main build uses member working weekdays, date-specific hour overrides, project holidays, actual remaining effort and a project timezone. The prototype's fixed October snapshot and calendar-day arithmetic are retired.

[Microsoft: resource leveling](https://support.microsoft.com/en-us/project/resource-leveling-dialog-box) distinguishes using slack from allowing the project finish to move. A balanced utilization chart does not establish an earlier delivery date. Every recommended reassignment is rescheduled; worsening or incomplete plans are excluded from automatic recovery recommendations.

### Knowledge concentration and contribution evidence

[Bus Factor in Practice, ICSE SEIP 2022](https://arxiv.org/abs/2202.01523) investigates knowledge concentration using sources beyond commits, including review and meeting data. We expose a literal **skill coverage** count from the roster, not an inferred or scientifically calibrated bus-factor score. Single-specialist warnings are planning signals, not judgments about a student.

[SPACE, Microsoft Research / ACM Queue, 2021](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/) argues against a single productivity metric. Our evidence view separates accepted deliverables, accepted estimated effort, independent reviews, documentation and blocker-resolution records. Hours are estimates rather than verified time worked. No overall ranking, auto-grading, comment-count rewards or automatic fairness verdict.

### Persistence, identity and concurrent changes

[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) requires both grants and policies. A publishable key is not a privileged database credential. The supplied Supabase URL/key can enable authentication; they do not authorize database administration or prove a schema exists. The local API remains the authority for project membership and workflow rules until a tested Postgres/RLS migration is applied.

[FastAPI password security](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) documents secure password hashing and identity verification. Cloud mode delegates credential validation to Supabase. Local test mode uses Argon2. The browser receives an opaque HttpOnly session cookie, not a password or service-role key.

[OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) informs random session identifiers, server-side expiry, secure-cookie configuration, logout invalidation and origin checks for browser writes. Production requires HTTPS, an explicit origin allowlist, and sandbox disabled.

[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) informs the local Argon2 fallback. This fallback is for development/tests when cloud identity is absent, not an alternative account directory silently mixed into Supabase login.

[Python SQLite transactions](https://docs.python.org/3/library/sqlite3.html) supports the local persistent store. Project state and the corresponding server-generated audit event commit in one transaction. Parameterized queries avoid building SQL from input. Files are stored as database blobs with membership-checked download endpoints.

[SQLAlchemy version counters](https://docs.sqlalchemy.org/en/20/orm/versioning.html) describes optimistic conflict detection. We implement the same compare-and-swap principle explicitly: each write carries the project version, updates only that version, and returns HTTP 409 on a stale revision. The UI reloads instead of silently overwriting another user's work.

[Python zoneinfo](https://docs.python.org/3/library/zoneinfo.html) supplies IANA timezone dates, with tzdata on Windows. Project days follow the project timezone. Event timestamps are UTC. This is a day-level capacity calendar, not a full shift planner or timezone-overlap optimizer.

## Main-build contracts

- Team lead manages members, skills, milestones, assignments, scope, and scenario approvals.
- Members update their own task progress and submit deliverables. A separate reviewer or lead accepts deliverables. A single-member project can self-attest, visibly distinguished from independent review.
- Scope deferral is explicit and excludes a task and all downstream work from the active delivery forecast. The UI lists everything deferred; a shorter forecast does not count removed work as completed.
- Open blockers without a resolution date make the forecast incomplete. A dated blocker produces a conditional forecast with its assumption visible.
- Scheduling uses a bounded 180-day horizon and half-hour granularity. Unscheduled work makes the forecast incomplete, never zero days late.
- Polling refreshes the database state and alerts. It is not advertised as WebSocket Realtime.
- Comments are conversation. Accepted reviews and deliverables are evidence. Client-created history cannot be submitted as trusted audit events.
- Feasible recovery and the recommended decision remain separate. The lead sees before/after effort, dates, scope and constraints before applying a version-checked scenario.

## Required regression cases

Single specialist; specialist with transferable side work; specialist absent; zero skill coverage; multiple required skills; zero capacity; weekend and holiday; partial-day capacity; expected and unknown blocker release; long task split across working days; dependency cycles; deleted/missing reference; owner mismatch; completed prerequisite; deferred downstream scope; stale scenario approval; nonmember access; member changing another member's task; self-approval; independent review evidence; session expiry; authorized attachment download; malformed and oversized input.

## Delivery architecture

`apps/web`: Next.js, custom React UI, React Flow, charts and restrained motion. Same-origin `/api` reverse proxy.

`services/api`: FastAPI, Pydantic validation, NetworkX DAG checks, calendar scheduling, risk/recovery/contribution functions, authenticated commands, persistent local SQLite and guarded attachments.

Supabase: cloud authentication using the supplied public settings. Cloud Postgres migration and RLS remain a separate verified integration step; no unconfigured cloud persistence is claimed. The preserved `proto/` is reference material and is not the main application's database.

## Cloud connection implementation update

The main build includes a psycopg Postgres adapter and an explicit private-schema migration. [Supabase's connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) distinguishes database connection strings from Data API credentials. The [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys) explains publishable and elevated server keys. Neither is a SQL connection string. Backend database activation therefore requires DATABASE_URL, while the supplied public settings already enable Supabase Auth integration.

The SQL migration keeps application data in a non-public schema with RLS and revoked public privileges. All application access passes through the API's membership and role checks. Cloud migration and Postgres integration were subsequently verified using the project’s IPv4 session pooler. All six tables have RLS enabled and anonymous/authenticated Data API roles cannot access the private schema. The earlier SQLite store is preserved locally. The API uses a bounded psycopg connection pool to avoid reconnecting for every query.
