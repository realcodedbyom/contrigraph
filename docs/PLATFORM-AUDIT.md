# Platform audit and next improvements

## Readable reporting and two-account collaboration

View report now opens a saved performance snapshot with browser print/PDF styling and the matching JSON download. It covers delivery, milestones, workload/capacity, separate contribution dimensions, risks/recommendations, task acceptance, team requests, latest update and available activity. A newer project revision disables export until refresh. Deferred scope is excluded from completion, and per-project forecast assumptions and the 1,000-event history limit remain explicit.

An isolated two-account browser journey verified assignment → notification → help request → lead reply → documented submission → review alert → independent acceptance. A full API restart followed by a fresh member login confirmed the persisted accepted task, resolved reply and notifications. The automated journey adds attachment persistence, self-approval rejection and report checks for both accounts. Local and VPS suites pass 138 tests; both release builds pass. The temporary QA sign-in route was removed. No test mutations were made to production.

PDF-save verification is limited: the print action was invoked, but desktop Computer Use stopped at print preview because it could not confidently identify the browser URL. A saved PDF and its pagination were not independently verified. See [the detailed demonstration](COLLABORATION-DEMO.md) and sample-data screenshots.

## Notification inbox and interactive product tour

The personal inbox now covers assignments (including approved portfolio redistribution), help requests, new/changed blockers, lead replies and review submissions. Only claimed recipients receive alerts; the actor does not notify themselves. Project and notification writes share a transaction, and stale or replayed updates cannot create duplicate alerts. Read state is private to each account and does not modify project versions. Every read and read-state mutation rechecks current membership. The new `003_notifications.sql` migration adds a private RLS-enabled table; existing project data is preserved. No historical backfill, email or device push is implied. Active windows poll every 15 seconds; older items are paginated.

The product page adds an interactive assignment → request → reply → review example, with original layout, GSAP interaction motion, keyboard navigation and reduced-motion support. Existing Lenis, React Bits CountUp, Skiper/Vengeance components and the original shader remain in place. Examples are clearly labeled, with no fabricated customers or performance claims.

REA was explicitly requested and used through the pinned 6.7.0 CLI because the session has no connected REA MCP tools. No agent configuration or native engines were installed. Observed public evidence:

- Jira notification documentation: `ev_aed8b1e1161dda4c611e0843a4816b3462c7a2b99f7a5359e8048f2714936426`.
- Jira public product page: `ev_9bc1ef9ccc38e94cf1352496ec4d93c206672e8a534530a06d22837f664229e7`.
- ClickUp public product page: `ev_82d8a93899ebb5bff2ae5a58e703c5be94be035789b5c91745d56fdea628894c`.
- ClickUp public Inbox feature action: `ev_03ea6f07c53df2a46296a9e8687738c7add1b0aec6d246791840401c477fea42`, all three steps completed; opened a signup dialog, not an authenticated inbox.
- ClickUp help browser capture `ev_4b59f6be548d289e943182d60b305be6dc36ba1b35e9bb57c206678918a7f827` reached bot verification and is not evidence of the inbox. The official help content was retrieved separately through web browsing. A preliminary feature capture failed because its heading locator was ambiguous; the corrected run targeted the observed Inbox button.

Sources: [ClickUp Inbox](https://help.clickup.com/hc/en-us/articles/33947959867543-What-is-the-Inbox), [Jira personal settings](https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/), [ClickUp product](https://clickup.com/), [Jira product](https://www.atlassian.com/software/jira). The useful patterns are a personal unread queue, direct context navigation, clear signup/login entry points and interactive product demonstrations. This is a bounded public-surface comparison, not private code recovery or a verified feature-parity claim. Raw captures remain in ignored local artifacts; owned REA browsers were cleaned up.

Validation: 137 API tests, including transactional rollback, recipient isolation, revoked membership, replay prevention, pagination and portfolio notifications. Browser checks confirmed help → lead inbox → reply → member inbox → exact resolved request, review notification → reviewable task, assignment → correct task, and read/unread/bulk-read behavior. The product tour was checked at desktop and 390px mobile width. All test mutations used an isolated local database.

Deployment verification: local and VPS production builds passed, and the VPS staging suite also passed all 137 tests. The private notification migration completed while preserving existing data. Both services are active; all 13 public-route checks and the production authentication, metadata, security-header and body-limit smoke checks pass. The live authenticated inbox loads successfully; the public tour responds to keyboard navigation. Production browser checks were read-only. Source and the previous build were retained on the VPS for rollback.

## 24 October follow-up: daily work before analysis

The user reported clipped navigation at 100% zoom, difficulty finding assigned work, unclear task removal and no obvious way to request a lead decision. A bounded review of [Jira reviews on Capterra](https://www.capterra.com/p/19319/JIRA/reviews/), [Jira reviews on G2](https://www.g2.com/products/jira/reviews), and [ClickUp user discussion](https://www.reddit.com/r/clickup/comments/1lbyhu4/) found similar complaints about complexity, navigation and too many interactions. These are qualitative examples, not a representative survey or proof of demand.

Implemented: My work as the default view; owner/lead progress controls separated from planning; team-visible requests with lead responses; reversible lead-only task archive; an independently scrolling sidebar and compact mobile menu; restored What-if simulator naming; Overview shortcuts to tasks, requests, reviews, blockers and unassigned work. Public help explains permissions and the difference between estimates and measured hours.

Requests and archive records use the existing project document and transaction/version checks, with server attribution and audit events. No SQL migration or existing-data reset is needed. Up to 500 requests and 500 archived tasks are supported per project; additions reject at the bound rather than deleting history. Responses do not automatically change dates or assignments. Accepted tasks retain contribution history. Restoring a task rechecks original-owner skills and prerequisites.

Verification: 128 API tests pass; local and VPS production builds pass. Browser checks used isolated local accounts and verified member progress, a deadline request, a lead reply visible to the member, archive/restore with recalculated workload, the Overview review shortcut, and a read-only What-if preview. Navigation was checked at normal desktop zoom, a 1280 × 600 embedded viewport and a 390 × 844 mobile viewport. Production checks remain read-only; no test records are added to real projects.

Positioning hypothesis: small software teams with shared deadlines and scarce specialist skills. The reason to adopt is clear daily ownership plus a visible route to resolve blocked work; the reason to recommend is a demonstrably safer workload decision that saves coordination time. The next validation should observe several teams completing invitation → assignment → blocker/request → decision → review, and measure task-finding time, unanswered-request age, repeated use and referral intent. Do not call this validated product-market fit. Saved views, request notifications outside the workspace, load testing and backup/restore drills remain follow-up work.

23 October 2026. This is a bounded audit, not a claim of complete production certification.

## Evidence and method

The requested source is https://github.com/morluto/rea. Its version-45 skill is installed in `.agents/skills/reverse-engineer-anything/` and the user's skill directory. An initial search selected `realkeisers/rea`, a different repository; that installed copy was replaced, with a backup outside the active skills directory. npm metadata for the actual `rea-agents@6.7.0` CLI points to `morluto/rea`. No MCP configuration changes or native disassembly engines were needed. CLI execution uses the shipped command contracts; the newer skill can describe capabilities outside that pinned release.

REA opened a temporary headless Chrome profile, navigated to Linear's public filter documentation, and captured accessibility evidence. This establishes what the documentation says, not private application implementation. No authenticated competitor account or proprietary backend was inspected.

- Public documentation capture: `ev_5580deaad134cdb8f8ebab3e375bbf01178b473e4677b07438c4a5743bc9a554`, retained in `artifacts/rea-linear-filters-evidence.json`.
- Local application browser capture: `ev_d03cb55ce4f24a25053f3bfd7579dbda901a0e5110249977761d75b555275721`, retained in `artifacts/rea-board-evidence.json`.
- Local scenario explicitly clicked sandbox sign-in, waited for project data, opened the board, checked 3 owned active tasks and 2 blocked tasks, tested an empty search, and reset to all 8 sample tasks. All steps completed. Temporary browser cleanup succeeded. Screenshot: `artifacts/task-board-audit.png`.
- An earlier browser attempt timed out before project loading completed. It was not counted as a successful check. The corrected scenario waits for readiness. The product now shows loading instead of briefly claiming the user has no projects.

Artifacts are ignored by Git. The sample sandbox creates isolated example data in the configured database; it does not modify the user's existing project.

## Patterns from established platforms

| Source | Documented behavior | ContriGraph decision |
| --- | --- | --- |
| [Linear filters](https://linear.app/docs/filters) | Combine criteria to focus work by assignee, status and other properties; some filters are shareable through URLs. | Implemented focused task views plus owner, priority, milestone, search and sorting. Sharing and persistent custom views remain future work. |
| [Asana workload](https://help.asana.com/s/article/portfolio-workload-and-universal-workload) | Compare effort with person capacity, inspect tasks, and view workload across projects. | Existing per-project effort/calendar engine remains. Next: an authorized cross-project capacity view, avoiding double-counting shared people or leaking private task titles. |
| [Jira column constraints](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/) | Column limits give a visual warning and count the entire column even when quick filters hide work. | Next: configurable advisory limits for In progress and In review. Filtering must never conceal a breached limit. These are flow signals, not a substitute for skill/calendar constraints. |
| [Linear project updates](https://linear.app/docs/initiative-and-project-updates) | Dated updates pair reported project health with explanatory text and a regular reporting cadence. | Next: lead-authored updates with next steps and stale-update indicators, displayed separately from the calculated forecast. |

These are independently implemented workflow ideas. No competitor source code or visual assets were copied. The deterministic, no-LLM product requirement remains in force.

## Fixed in this pass

1. Task-save requests could bypass status-transition checks. New tasks now start in To do; status changes require their explicit workflow command. Invalid transitions do not change the project version or audit log.
2. Submitted deliverable fields could change while awaiting acceptance. Return work to In progress before changing the reviewed content, effort, owner, skills or prerequisites.
3. A lead submitting someone else's task could also approve it as independent review. Multi-member projects now reject approval by either the owner or submitter.
4. Renaming a milestone left tasks grouped under the old name. Linked task names now change atomically with the milestone.
5. Task status, approval and blocker actions now use the editor's captured version, preventing a background refresh from silently making stale inputs appear current. Successful editor commands advance that editor version.
6. Board views now cover all tasks, own active work, overdue work, blockers and review queues. Completed and deferred scope are excluded from actionable overdue/blocked views. Overdue uses the forecast's project-local date. Filters combine, counts are labelled, and a clear reset handles empty results.
7. Initial project retrieval now has an explicit loading state.
8. Restart testing reproduced web readiness before API/database readiness. The development launcher now health-checks the API before starting Next.js, with a bounded timeout and clear failure. Heading animation now skips absent headings during loading instead of emitting GSAP warnings.

## Verification and boundaries

- Backend regression suite: 36 passing tests, including six added cases for workflow bypass, new-task state, review integrity and milestone rename persistence. Tests isolate SQLite fixtures and mock cloud identity; they do not repeatedly send verification emails.
- Production Next.js build passed. REA exercised the new desktop board in the live local app.
- Existing tests cover scheduling, specialist preservation, zero skills/capacity, blockers, dependency cycles, calendars, roles, invitations, session isolation, files and optimistic concurrency.
- Supabase persistence and email confirmation were verified in the preceding build pass. This pass is not an independent revalidation of every cloud workflow, browser size, or multi-user race.
- The current scheduler is greedy and project-local. Two projects can each allocate the same person's full capacity. Until cross-project scheduling exists, availability must be budgeted per project; do not label this a global availability guarantee.
- Auth rate limits are process-local, sessions expire after 24 hours, audit exports retain the latest 1,000 events, and there is no delivery notification service. See README for deployment requirements.

## Prioritized next implementation

1. Cross-project workload: stable user identity mapping, permissions-preserving aggregates, explicit capacity reservations, regression tests for overlapping allocations.
2. Progress updates: stored author/time/health/summary/next steps, lead permissions, history, stale state and export support.
3. Advisory work-in-progress limits: project settings, full-column counts, a review-queue bottleneck signal and accessible warnings.
4. Saved and shareable task views: per-project/user settings, validated URL state, restoration after reload and browser navigation.
5. Delivery readiness: paginated audit exports, distributed rate limiting, backup/restore verification, mobile/browser coverage and load testing.

The teacher's sole-specialist case remains non-negotiable: retain the qualified specialist, move eligible side work only after full resimulation, and report uncertainty when no feasible recovery exists.


## Implemented follow-up: workload, updates and WIP limits

The first three priorities above have now shipped in the local application. Cross-project workload is permission-scoped daily aggregation rather than a joint solver. It merges claimed user identities, counts capacity once, reports calendar differences conservatively, lists unassigned work, and retains unknown private commitments. Project updates and WIP limits persist in the existing project document with role/version validation and transactional audit events. Defaults preserve older projects without DDL changes.

Desktop REA evidence: `ev_0d45b458577f44a4c1c6aeee3e12cc79fd7d01836c541f19b9ec55da23cd1522` in `artifacts/rea-planning-evidence.json`. All 36 recorded steps (including initial navigation) completed. The scenario published an update, saved both WIP limits, started two tasks against a limit of one, confirmed the warning survived a review-queue filter, created a second sample project, observed overload and confirmed combined workload after reload. Owned browser cleanup succeeded.

Live cloud API checks independently verified Postgres storage, updates and report export, WIP persistence, two-project shared capacity, and unauthenticated access rejection after logout. The backend suite now has 54 passing cases, adding privacy, identity merging, conflicting calendars, unassigned/unscheduled scope, permission restrictions, immutable attribution, stale writes, invalid input, advisory behavior and legacy defaults. The production build passes.

Remaining boundaries: the workload view does not rewrite project schedules or approve cross-project redistribution, private project demand is not disclosed, unclaimed rosters cannot be reliably merged, and published update history is capped at 500 records per project. Saved views and broader deployment hardening remain future work.

Mobile REA evidence at 390 × 844: `ev_84754e69a71da03df122d74216b37835ad5ccc559cdcb6b9ff91a5fa5be31585`, retained in `artifacts/rea-planning-mobile-evidence.json`. All 17 steps completed: sandbox login, progress publishing, WIP configuration and workload navigation. A preliminary scenario left a task dialog open before trying sidebar navigation; it was corrected and is not counted as a product failure or passing run.

Final visual review found duplicate React keys could leave the WIP settings panel mounted after navigation. Component keys are now unique by feature and project. The browser scenarios assert that the old panel is detached on entering cross-project workload. A transient Supabase pool connection timeout occurred during one restart; the next startup completed and passed the API health gate.


## Cross-project redistribution follow-up

The workload screen now supports finding a safe reassignment, previewing its impact across visible projects, and explicit lead approval. This supersedes the earlier limitation about approval support. The existing grid remains a comparison of independently planned demand; preview dates come from a separate joint resource-constrained simulation.

The joint scheduler namespaces project/task identifiers, preserves each project's dependency graph and skill declarations, and allocates shared identities from one intersected calendar of half-hour slots. Suggested moves cannot delay any task and must advance at least one. The sole specialist is retained; eligible side work is considered instead. Locks, active/reviewed/deferred scope, zero remaining effort, missing skills, unknown/conditional forecasts, timezone mismatch, unclaimed identities and incomplete visibility fail closed. No candidate is not proof of impossibility; human scope, sequencing or deadline decisions remain available.

Preview and approval are separate endpoints. A ten-minute HMAC token binds the proposal to the actor and portfolio snapshot. Approval repeats role, freshness and schedule checks while holding the same write lock as project updates and project creation. It saves only the source assignment and an audit event. Audit metadata deliberately excludes unrelated project identities and dates; those impacts are visible only in the authorized lead's preview. Changing any visible project or membership coverage invalidates the preview, and a successful approval cannot be replayed.

Verification: 80 backend tests pass, including shared-resource exclusivity, dependency ordering, specialist side-work recovery, no-transferable-work behavior, a recipient busy elsewhere, conflicting calendars, hidden commitments, locks and workflow state, forged/expired/replayed tokens, stale unrelated projects, changed membership scope, role enforcement, read-only previews, persistence and audit privacy. Production Next.js build passes.

Live desktop REA evidence: `ev_c963c0214d4834666a2a99c1aa00eb6d8345577a090630cea6b659f594ebe1e1` in `artifacts/rea-redistribution-evidence.json`; all 12 steps completed and the owned browser was terminated. Test setup used ordinary API invitations to link two isolated sandbox users across three Supabase projects. It verified suggestions, an unchanged assignment after preview, the protected specialist, UI approval, persisted reassignment, audit recording, and rejection of the older token. Audit redaction was subsequently tightened and covered by the regression suite and final mobile pass.

Implementation: `services/api/redistribution.py`, `services/api/redistribution_routes.py`, `services/api/test_redistribution.py`, and `apps/web/components/PortfolioRedistribution.tsx`. The retained reproduction script `artifacts/test_live_redistribution.py` uses sandbox data and keeps its browser session credential only in a child-process environment variable. Evidence capture requests no network bodies or storage values. Production multi-worker installations need a common server-only PREVIEW_SIGNING_KEY; otherwise a process restart invalidates previews.

Final mobile live evidence: `ev_aeeac206877a579d99322d191c17fa582778e8eac191e23865ba2277f21517cb` in `artifacts/rea-redistribution-mobile-evidence.json`. All 12 steps completed at 390 × 844. Supabase checks confirmed the approved owner, retained specialist, audit recording without other project IDs, and replay rejection. The final suite has 80 passing tests, including simultaneous approvals (one commit), newly hidden commitments and revoked lead permissions.


## Shared dashboard schedule and repository release

The portfolio dashboard now derives task allocations and project dates directly from `joint_schedule`, the same calculation used by redistribution previews and approvals. The API also shares the same permission-scoped context and reporting date. This supersedes the independent-demand grid described in earlier entries above. Per-project views remain explicitly scoped to that project's plan; portfolio decisions use Across projects.

Eight added regression cases verify before/after forecast agreement, allocation totals, no shared-capacity overbooking, empty portfolios, intersecting calendars, blockers, missing owners, deferred scope, and timezone limitations. Mixed project timezones show unknown dates and allocations until aligned, while declared capacity remains informational. Due-effort and late-task warnings remain visible even when a schedule fits the available slots.

Verification: 88 backend tests and the production build pass. The live desktop approval scenario also passed against Supabase, including equality of dashboard and preview dates before and after approval, specialist retention, persisted owner change, private audit metadata and replay rejection. Desktop evidence: `ev_9cc1962606042cfaaa3c7c7a514ca11815682376ce544c00c7adc1469ebb9f12` (raw capture retained locally).

Repository preparation preserves `proto`, excludes local credentials/caches/raw evidence, adds GitHub Actions test/build verification, and publishes a sample-data screenshot gallery. Screenshots are documentation, not a public application deployment.

Final mobile check: all 12 REA steps passed at 390 × 844; dashboard/preview equality was checked before and after approval against Supabase. Evidence: `ev_c190d2881969dcf55e0d704262c2be50569e477db3a75f97e16636f242f15c8f`. The preserved prototype also passes its 14 tests. Raw captures remain local; only selected sample-data screenshots are published.
