# Two-account collaboration demonstration

24 October 2026. This walkthrough uses isolated local data and two accounts. Browser cookie jars were separated by `127.0.0.1` and `localhost`; both talked to the same FastAPI instance and SQLite file. Production Clerk authentication is not part of this local walkthrough.

1. The lead, Alex Demo, assigned CG-02 to the claimed Interface teammate profile, linked to Sam Demo's account.
2. Sam's inbox received an assignment alert. Opening it marked it read and opened CG-02 directly, with the new owner loaded from the server.
3. Sam started the task and sent a Help request linked to CG-02, asking the lead to confirm acceptance cases.
4. Alex's inbox received the request. Opening it selected the exact request. Alex resolved it with a written response.
5. Sam's reply alert opened that same resolved request, with the full lead response visible.
6. Sam added documentation evidence and submitted the task for review. Alex's review alert opened CG-02 with the evidence and acceptance action visible.
7. Alex independently accepted the deliverable. Saved revision 9 records CG-02 as Done, zero remaining effort, the submitting member and the approving lead. The report shows 12h of accepted estimated effort and one documentation record for the member, plus one independent review for the lead.

No notification goes to the actor for their own action. Opening notifications does not change the project revision. Evidence is team-entered and estimated effort is not tracked time or a productivity score.

After the browser walkthrough, the API process was stopped and restarted against the same isolated database. A new member login confirmed revision 9, accepted CG-02 with zero remaining effort and independent lead acceptance, the resolved request/reply and the saved assignment/reply notifications.

The regression test `services/api/test_collaboration_journey.py` repeats the journey with two independent clients, includes a persisted attachment, rejects member self-approval, verifies both accounts' reports and logs back in using a fresh app client to check saved task, request, contribution and notification read state. The full backend suite passes 138 tests.

## Report presentation

**View report** opens a saved, generated snapshot. **Refresh report** includes later updates; the app disables print and JSON download if it detects a newer project revision. The report includes:

- Delivery health, completion of active scope, effort, forecast date and estimated delay.
- Milestone progress, workload, available capacity and separate contribution dimensions.
- Task states, independent acceptance and evidence counts.
- Requests with lead decisions, latest project update, risks and recommended next steps.
- Available activity history and explicit forecast/evidence assumptions.

**Print / Save PDF** invokes the browser print dialog. Print styles remove workspace controls, use an A4 portrait layout, repeat table headings and avoid splitting rows. JSON exports the same snapshot. Completion excludes deferred scope, and the report explicitly distinguishes its per-project forecast from the shared schedule in Across projects. Activity retrieval remains capped at 1,000 records.

The report content and print action were exercised in the browser. Saving the final PDF was not verified: desktop Computer Use stopped at print preview because it could not confidently determine the browser URL. This is a verification limitation, not evidence of a successful PDF export. The temporary local QA sign-in page was removed before the release build.

Local and VPS release builds pass; the VPS staging suite also passes all 138 tests. The live web build was updated after staging checks. Two obsolete web-root source files from an older deployment were moved into a server-side rollback folder after the clean source build exposed their outdated auth imports. This release changes report presentation; no production database migration or test records are required.

Screenshots: [report](screenshots/performance-report.png), [review](screenshots/collaboration-review.png).
