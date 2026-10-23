"""Attached to FastAPI by main after its helpers have been defined."""
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import hmac
import json
import time
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from redistribution import suggest_moves, simulate_move
from store import connect, save_project, event


class MoveRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    projectId: str = Field(min_length=1, max_length=80)
    taskId: str = Field(min_length=1, max_length=80)
    memberId: str = Field(min_length=1, max_length=80)


class ApprovalRequest(MoveRequest):
    token: str = Field(min_length=64, max_length=64)
    expiresAt: int
    reason: str = Field(min_length=1, max_length=500)


def context(db, user):
    rows = db.execute('SELECT DISTINCT p.* FROM projects p JOIN memberships m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.id', (user['id'],)).fetchall()
    projects = {r['id']: json.loads(r['data']) for r in rows}
    versions = {r['id']: r['version'] for r in rows}
    mids = {r['project_id']: r['member_id'] for r in db.execute('SELECT project_id, member_id FROM memberships WHERE user_id=?', (user['id'],))}
    leads = {pid for pid, data in projects.items() if next(m for m in data['members'] if m['id'] == mids[pid])['role'] == 'lead'}
    covered = set()
    for uid in {m['userId'] for p in projects.values() for m in p['members'] if m.get('userId')}:
        memberships = {r['project_id'] for r in db.execute('SELECT project_id FROM memberships WHERE user_id=?', (uid,))}
        if memberships <= set(projects):
            covered.add(uid)
    zone = next(iter(projects.values()))['timezone'] if projects else 'Asia/Kolkata'
    start = datetime.now(ZoneInfo(zone)).date()
    snapshot = {'projects': projects, 'versions': versions, 'covered': sorted(covered), 'leads': sorted(leads), 'user': user['id'], 'asOf': start.isoformat()}
    return projects, versions, mids, leads, covered, start, snapshot


def signature(key, snapshot, proposal, expires):
    message = json.dumps({'snapshot': snapshot, 'proposal': proposal, 'expires': expires}, sort_keys=True, separators=(',', ':')).encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def register(app, current_user, preview_key, get_project):
    @app.get('/workload/recommendations')
    def recommendations(user=Depends(current_user)):
        with connect() as db:
            projects, versions, mids, leads, covered, start, snapshot = context(db, user)
        if not leads:
            return {'suggestions': [], 'notes': ['Only a project lead can preview and approve redistribution for that project.'], 'truncated': False}
        return suggest_moves(projects, covered, leads, start)

    @app.post('/workload/redistribution/preview')
    def preview(body: MoveRequest, user=Depends(current_user)):
        with connect() as db:
            projects, versions, mids, leads, covered, start, snapshot = context(db, user)
        if body.projectId not in projects:
            raise HTTPException(404, 'Project not found.')
        if body.projectId not in leads:
            raise HTTPException(403, 'Only this project’s lead can approve reassignment.')
        if sum(len(p['tasks']) for p in projects.values()) > 500:
            raise HTTPException(422, 'Joint preview is limited to 500 visible tasks.')
        proposal = body.model_dump()
        result = simulate_move(projects, covered, proposal, start)
        expires = int(time.time()) + 600
        return {**result, 'versions': versions, 'expiresAt': expires, 'token': signature(preview_key, snapshot, proposal, expires)}

    @app.post('/workload/redistribution/approve')
    def approve(body: ApprovalRequest, user=Depends(current_user)):
        if not body.reason.strip():
            raise HTTPException(422, 'Record a reason for this decision.')
        proposal = body.model_dump(include={'projectId', 'taskId', 'memberId'})
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            projects, versions, mids, leads, covered, start, snapshot = context(db, user)
            if body.projectId not in projects:
                raise HTTPException(404, 'Project not found.')
            if body.projectId not in leads:
                raise HTTPException(403, 'Only this project’s lead can approve reassignment.')
            if body.expiresAt < time.time() or not hmac.compare_digest(body.token, signature(preview_key, snapshot, proposal, body.expiresAt)):
                raise HTTPException(409, 'This preview expired or portfolio data changed. Generate and review a fresh preview.')
            # Revalidate all safety conditions under the same write lock as the assignment.
            result = simulate_move(projects, covered, proposal, start)
            project = projects[body.projectId]
            task = next(t for t in project['tasks'] if t['id'] == body.taskId)
            old_owner = task['owner']
            task['owner'] = body.memberId
            actor = next(m for m in project['members'] if m['id'] == mids[body.projectId])
            save_project(db, body.projectId, versions[body.projectId], project, actor['id'])
            event(db, body.projectId, actor, 'decision', 'approved portfolio redistribution: ' + body.reason.strip(), body.taskId,
                  {'kind': 'portfolio-reassignment', 'from': old_owner, 'to': body.memberId,
                   'sourceVersion': versions[body.projectId], 'contextDigest': signature(preview_key, snapshot, proposal, body.expiresAt),
                   'sourceImpact': next(impact for impact in result['impacts'] if impact['projectId'] == body.projectId),
                   'protectedTasks': result['protectedTasks']})
        return get_project(body.projectId, user)
