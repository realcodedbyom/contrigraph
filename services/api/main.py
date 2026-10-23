from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
import json
import os
import secrets
import time
import httpx
from fastapi import FastAPI, Request, Response, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse
from pydantic import ValidationError, BaseModel, Field, ConfigDict
from pwdlib import PasswordHash
from models import Credentials, Command, ProjectData, Task, Member, Milestone, Comment, Scenario, ProgressUpdate
from engine import analyze, validate, eligible, apply_scenario
from seed import starter
from store import connect, init_db, digest, create_session, load_project, save_project, events_for, event, database_kind, close_pool

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield
    close_pool()


app = FastAPI(title='ContriGraph Decision Engine', version='1.0.0', lifespan=lifespan)
passwords = PasswordHash.recommended()
attempts = defaultdict(deque)
COOKIE = 'contrigraph_session'
PREVIEW_KEY = os.environ.get('PREVIEW_SIGNING_KEY', '').encode() or secrets.token_bytes(32)


def cloud():
    return bool(os.environ.get('SUPABASE_URL') and os.environ.get('SUPABASE_PUBLISHABLE_KEY'))


def issue_cookie(response, user_id):
    token = create_session(user_id)
    response.set_cookie(COOKIE, token, httponly=True, samesite='lax', secure=os.environ.get('COOKIE_SECURE') == 'true', max_age=86400, path='/')


@app.middleware('http')
async def browser_protection(request, call_next):
    if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
        origin = request.headers.get('origin')
        allowed = os.environ.get('APP_ORIGINS', 'http://127.0.0.1:3000,http://localhost:3000').split(',')
        if origin and origin not in allowed:
            return JSONResponse({'detail': 'Untrusted request origin.'}, status_code=403)
        limit = 16 * 1024 if request.url.path.startswith('/auth/') else (6 * 1024 * 1024 if '/files' in request.url.path else 1024 * 1024)
        length = request.headers.get('content-length', '0')
        if length.isdigit() and int(length) > limit:
            return JSONResponse({'detail': 'Request too large.'}, status_code=413)
        # Enforce the limit for chunked requests too, before parsing JSON or multipart.
        chunks, received = [], 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > limit:
                return JSONResponse({'detail': 'Request too large.'}, status_code=413)
            chunks.append(chunk)
        request._body = b''.join(chunks)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(ValueError)
async def invalid_value(request, error):
    return Response(json.dumps({'detail': str(error)[:500]}), status_code=422, media_type='application/json')


def current_user(request: Request):
    if os.environ.get('AUTH_MODE') == 'clerk':
        from clerk_identity import clerk_user
        return clerk_user(request)
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, 'Sign in to continue.')
    with connect() as db:
        row = db.execute('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', (digest(token), time.time())).fetchone()
    if not row:
        raise HTTPException(401, 'Your session has expired. Sign in again.')
    return {k: row[k] for k in ['id', 'email', 'name', 'provider']}


def throttle(request):
    key = request.client.host if request.client else 'unknown'
    queue = attempts[key]
    while queue and queue[0] < time.time() - 60:
        queue.popleft()
    if len(attempts) > 10000:
        for old_key in list(attempts):
            if not attempts[old_key] or attempts[old_key][-1] < time.time() - 60:
                del attempts[old_key]
    if len(queue) >= 5:
        raise HTTPException(429, 'Too many attempts. Wait one minute before retrying.', headers={'Retry-After': '60'})
    queue.append(time.time())


async def supabase_auth(path, payload):
    payload = dict(payload)
    redirect = payload.pop('email_redirect_to', None)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/' + path,
                                         headers={'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY']}, params={'redirect_to': redirect} if redirect else None, json=payload)
    except httpx.HTTPError:
        raise HTTPException(503, 'The identity service is unavailable. Please retry.')
    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            raise HTTPException(502, 'The identity service returned an unexpected response. Please retry later.')
        message = data.get('msg') or data.get('error_description') or data.get('message') or 'Authentication failed.'
        if data.get('code') == 'over_email_send_rate_limit' or 'email rate limit' in message.lower():
            raise HTTPException(503, 'Confirmation email delivery is temporarily unavailable. Please try again later. If you already confirmed your email, you can still sign in.')
        raise HTTPException(429 if response.status_code == 429 else 400, message)
    return response.json()


@app.get('/health')
def health_check():
    with connect() as db:
        db.execute('SELECT id FROM users LIMIT 0')
    return {'status': 'ok', 'database': database_kind(), 'identity': 'clerk' if os.environ.get('AUTH_MODE') == 'clerk' else ('supabase' if cloud() else 'local'), 'sandbox': os.environ.get('ENABLE_SANDBOX') == 'true' and os.environ.get('AUTH_MODE') != 'clerk'}


@app.get('/auth/me')
def me(user=Depends(current_user)):
    return user


@app.get('/auth/providers')
async def auth_providers():
    if os.environ.get('AUTH_MODE') == 'clerk':
        return {'provider': 'clerk', 'googleUrl': ''}
    if not cloud():
        return {'googleUrl': ''}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            result = await client.get(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/settings', headers={'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY']})
        if result.status_code != 200 or not result.json().get('external', {}).get('google'):
            return {'googleUrl': ''}
    except (httpx.HTTPError, ValueError):
        return {'googleUrl': ''}
    from urllib.parse import urlencode
    redirect_url = os.environ.get('AUTH_REDIRECT_URL', '').strip()
    if not redirect_url:
        return {'googleUrl': ''}
    return {'googleUrl': os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/authorize?' + urlencode({'provider': 'google', 'redirect_to': redirect_url})}


@app.post('/auth/register')
async def register(body: Credentials, request: Request, response: Response):
    if os.environ.get('AUTH_MODE') == 'clerk':
        raise HTTPException(403, 'Create your account using the sign-up form.')
    if os.environ.get('AUTH_MODE') == 'google':
        raise HTTPException(403, 'Use Continue with Google to create your account.')
    throttle(request)
    if not body.name.strip():
        raise HTTPException(422, 'Your name is required.')
    if cloud():
        signup_payload = {'email': body.email, 'password': body.password, 'data': {'name': body.name.strip()}}
        redirect_url = os.environ.get('AUTH_REDIRECT_URL')
        if redirect_url:
            signup_payload['email_redirect_to'] = redirect_url
        result = await supabase_auth('signup', signup_payload)
        if not result.get('access_token'):
            return {'confirmationRequired': True, 'message': 'Check your email to confirm your account, then sign in.'}
        identity = result['user']
        uid = identity['id']
        with connect() as db:
            db.execute('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email', (uid, body.email, body.name.strip(), None, 'supabase'))
    else:
        uid = secrets.token_hex(16)
        with connect() as db:
            if db.execute('SELECT 1 FROM users WHERE email=?', (body.email,)).fetchone():
                raise HTTPException(409, 'An account with that email already exists.')
            db.execute('INSERT INTO users VALUES(?,?,?,?,?)', (uid, body.email, body.name.strip(), passwords.hash(body.password), 'local'))
    issue_cookie(response, uid)
    return {'id': uid, 'name': body.name.strip(), 'email': body.email}


@app.post('/auth/login')
async def login(body: Credentials, request: Request, response: Response):
    if os.environ.get('AUTH_MODE') == 'clerk':
        raise HTTPException(403, 'Sign in using the sign-in form.')
    if os.environ.get('AUTH_MODE') == 'google':
        raise HTTPException(403, 'Use Continue with Google to sign in.')
    throttle(request)
    if cloud():
        result = await supabase_auth('token?grant_type=password', {'email': body.email, 'password': body.password})
        identity = result['user']
        uid = identity['id']
        name = identity.get('user_metadata', {}).get('name') or body.email.split('@')[0]
        with connect() as db:
            db.execute('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email', (uid, body.email, name, None, 'supabase'))
    else:
        with connect() as db:
            row = db.execute('SELECT * FROM users WHERE email=? AND provider=?', (body.email, 'local')).fetchone()
            if not row or not passwords.verify(body.password, row['password_hash']):
                raise HTTPException(401, 'Email or password is incorrect.')
            uid, name = row['id'], row['name']
    issue_cookie(response, uid)
    return {'id': uid, 'name': name, 'email': body.email}


class ResendVerification(BaseModel):
    email: str = Field(min_length=3, max_length=254)


@app.post('/auth/resend')
async def resend_verification(body: ResendVerification, request: Request):
    if os.environ.get('AUTH_MODE') == 'clerk':
        raise HTTPException(403, 'Request a new verification code from the sign-in form.')
    if os.environ.get('AUTH_MODE') == 'google':
        raise HTTPException(403, 'Use Continue with Google. Email confirmation is not needed for Google sign-in.')
    throttle(request)
    if not cloud():
        raise HTTPException(400, 'Email verification is not enabled for local accounts.')
    email = Credentials.email_valid(body.email)
    resend_payload = {'type': 'signup', 'email': email}
    redirect_url = os.environ.get('AUTH_REDIRECT_URL')
    if redirect_url:
        resend_payload['email_redirect_to'] = redirect_url
    await supabase_auth('resend', resend_payload)
    return {'message': 'If this account still needs confirmation, a new email has been requested. Open the newest message. Already confirmed? Sign in with your password.'}


@app.post('/auth/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with connect() as db:
            db.execute('DELETE FROM sessions WHERE token_hash=?', (digest(token),))
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}


class AuthCallback(BaseModel):
    accessToken: str = Field(min_length=20, max_length=10000)


async def verified_identity(token):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.get(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/user',
                                      headers={'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY'], 'Authorization': 'Bearer ' + token})
    except httpx.HTTPError:
        raise HTTPException(503, 'The identity service is unavailable. Please sign in again.')
    if result.status_code != 200:
        raise HTTPException(401, 'The confirmation session expired. Your email may already be confirmed; sign in with your password.')
    return result.json()


@app.post('/auth/callback')
async def auth_callback(body: AuthCallback, request: Request, response: Response):
    if os.environ.get('AUTH_MODE') == 'clerk':
        raise HTTPException(403, 'Use the current sign-in provider.')
    throttle(request)
    if not cloud():
        raise HTTPException(404)
    identity = await verified_identity(body.accessToken)
    uid, email = identity['id'], identity['email']
    name = identity.get('user_metadata', {}).get('name') or email.split('@')[0]
    with connect() as db:
        db.execute('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email',
                   (uid, email, name, None, 'supabase'))
    issue_cookie(response, uid)
    return {'id': uid, 'name': name, 'email': email, 'provider': 'supabase'}


@app.post('/auth/sandbox')
def sandbox(request: Request, response: Response):
    if os.environ.get('ENABLE_SANDBOX') != 'true' or os.environ.get('AUTH_MODE') == 'clerk':
        raise HTTPException(404)
    throttle(request)
    uid = 'sandbox-' + secrets.token_hex(10)
    user = {'id': uid, 'name': 'Your team lead', 'email': uid + '@example.invalid', 'provider': 'sandbox'}
    with connect() as db:
        db.execute('INSERT INTO users VALUES(?,?,?,?,?)', (uid, user['email'], user['name'], None, 'sandbox'))
    issue_cookie(response, uid)
    create_project_record(user, starter(user))
    return user


def create_project_record(user, data):
    validate(data)
    pid = secrets.token_hex(12)
    created = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('INSERT INTO projects VALUES(?,?,1,?)', (pid, json.dumps(data), created))
        for member in data['members']:
            db.execute('INSERT INTO memberships VALUES(?,?,?,NULL)', (pid, member['id'], member.get('userId')))
        event(db, pid, data['members'][0], 'created', 'created the project')
    return pid


class NewProject(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    deadline: date
    sample: bool = False


@app.post('/projects')
def create_project(body: NewProject, user=Depends(current_user)):
    data = starter(user, body.sample)
    data.update(name=body.name.strip(), description=body.description, deadline=body.deadline.isoformat())
    if not data['name']:
        raise HTTPException(422, 'Project name cannot be blank.')
    return {'id': create_project_record(user, data)}


@app.get('/projects')
def list_projects(user=Depends(current_user)):
    with connect() as db:
        rows = db.execute('SELECT DISTINCT p.* FROM projects p JOIN memberships m ON m.project_id=p.id WHERE m.user_id=? ORDER BY p.created DESC', (user['id'],)).fetchall()
    return [{'id': r['id'], 'version': r['version'], 'name': json.loads(r['data'])['name'], 'deadline': json.loads(r['data'])['deadline']} for r in rows]


@app.get('/projects/{pid}')
def get_project(pid: str, user=Depends(current_user)):
    with connect() as db:
        data, version, mid = load_project(db, pid, user['id'])
        history = events_for(db, pid)
    data = ProjectData.model_validate(data).model_dump(mode='json')
    return {'id': pid, 'version': version, 'myMemberId': mid, 'data': data, 'activity': history, 'analysis': analyze(data, history)}


@app.get('/workload')
def cross_project_workload(user=Depends(current_user)):
    from portfolio import portfolio_workload
    from redistribution_routes import context
    with connect() as db:
        projects, _, _, _, _, start, _ = context(db, user)
    return portfolio_workload(projects.items(), start)


def actor_for(data, mid):
    return next(m for m in data['members'] if m['id'] == mid)


def require_lead(actor):
    if actor['role'] != 'lead':
        raise HTTPException(403, 'Only the team lead can make this change.')


@app.post('/projects/{pid}/commands')
def command(pid: str, body: Command, user=Depends(current_user)):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        data, version, mid = load_project(db, pid, user['id'])
        if body.version != version:
            raise HTTPException(409, 'The project changed. Reload before applying this change.')
        actor = actor_for(data, mid)
        p = body.payload
        kind, task_id, text, meta = 'updated', '', '', {}
        if body.type == 'task.save':
            require_lead(actor)
            task = Task.model_validate(p).model_dump(mode='json')
            old = next((t for t in data['tasks'] if t['id'] == task['id']), None)
            if (old and old['status'] != task['status']) or (not old and task['status'] != 'To do'):
                raise HTTPException(422, 'Save new tasks as To do. Use status, submission, approval, or scope actions for transitions.')
            if old and old['status'] == 'Done':
                raise HTTPException(422, 'Accepted work is immutable. Create a follow-up task for changes.')
            if old and old['status'] == 'In review' and any(task[f] != old[f] for f in ['owner', 'requiredSkills', 'dependencies', 'effort', 'remaining', 'title', 'description']):
                raise HTTPException(422, 'Return the task to In progress before changing submitted work.')
            if task['owner']:
                member = next((m for m in data['members'] if m['id'] == task['owner']), None)
                if not member or not eligible(member, task):
                    raise HTTPException(422, 'Choose a member with every required skill, or leave the task unassigned.')
            for field in ['comments', 'files', 'submittedBy', 'acceptedBy', 'acceptance']:
                task[field] = old[field] if old else ([] if field in ['comments', 'files'] else None)
            if task['remaining'] == 0 and task['status'] != 'Done':
                task['status'] = 'To do' if not old else old['status']
            if old:
                data['tasks'] = [task if t['id'] == task['id'] else t for t in data['tasks']]
            else:
                data['tasks'].append(task)
            kind, task_id, text = ('updated' if old else 'created'), task['id'], ('updated ' if old else 'created ') + task['title']
        elif body.type in ['task.status', 'task.approve']:
            task = next((t for t in data['tasks'] if t['id'] == p.get('taskId')), None)
            if not task:
                raise HTTPException(404, 'Task not found.')
            task_id = task['id']
            if task['status'] == 'Done':
                raise HTTPException(422, 'Accepted work is already complete.')
            if body.type == 'task.approve':
                if actor['role'] not in ['lead', 'reviewer']:
                    raise HTTPException(403, 'A lead or reviewer must approve deliverables.')
                if task['status'] != 'In review':
                    raise HTTPException(422, 'Submit the task for review first.')
                if mid in [task['owner'], task.get('submittedBy')] and len(data['members']) > 1:
                    raise HTTPException(403, 'Your own deliverable needs another reviewer. Invite a reviewer if needed.')
                if any(next(t for t in data['tasks'] if t['id'] == dep)['status'] != 'Done' for dep in task['dependencies']):
                    raise HTTPException(422, 'Complete the prerequisite tasks before approval.')
                if task['blocker']:
                    raise HTTPException(422, 'Resolve the blocker before approval.')
                task.update(status='Done', remaining=0, acceptedBy=mid, acceptance='Independent review' if task['owner'] != mid else 'Self-attested: single-member project')
                kind, text, meta = 'approved', 'accepted ' + task['title'], {'independent': task['owner'] != mid}
            else:
                if actor['role'] != 'lead' and task['owner'] != mid:
                    raise HTTPException(403, 'You can only update your own assigned work.')
                status = p.get('status', task['status'])
                if status not in ['To do', 'In progress', 'In review']:
                    raise HTTPException(422, 'Use approval or scope review for that status.')
                if task['status'] == 'Deferred':
                    raise HTTPException(422, 'Deferred scope must be replanned explicitly, not silently restarted.')
                if status in ['In progress', 'In review']:
                    if not task['owner'] or not eligible(actor_for(data, task['owner']), task):
                        raise HTTPException(422, 'A qualified owner must be assigned before starting work.')
                    if any(next(t for t in data['tasks'] if t['id'] == dep)['status'] != 'Done' for dep in task['dependencies']):
                        raise HTTPException(422, 'This task is waiting on unfinished prerequisites.')
                    if task['blocker']:
                        raise HTTPException(422, 'Resolve the blocker before starting or submitting work.')
                remaining = p.get('remaining', task['remaining'])
                task.update(status=status, remaining=remaining)
                if status == 'In review':
                    task['submittedBy'] = mid
                kind, text = ('submitted' if status == 'In review' else 'updated'), 'moved ' + task['title'] + ' to ' + status
        elif body.type == 'task.blocker':
            task = next((t for t in data['tasks'] if t['id'] == p.get('taskId')), None)
            if not task:
                raise HTTPException(404, 'Task not found.')
            if actor['role'] != 'lead' and task['owner'] != mid:
                raise HTTPException(403, 'You can only report blockers on your own work.')
            if task['status'] in ['Done', 'Deferred']:
                raise HTTPException(422, 'Only active scope can have a blocker updated.')
            previous = task['blocker']
            task['blocker'] = str(p.get('blocker', '')).strip()
            task['blockedUntil'] = p.get('blockedUntil') if task['blocker'] else None
            kind, task_id = 'blocked' if task['blocker'] else 'unblocked', task['id']
            text = ('reported a blocker on ' if task['blocker'] else 'cleared a blocker on ') + task['title']
            meta = {'previous': previous, 'current': task['blocker']}
        elif body.type == 'member.save':
            require_lead(actor)
            member = Member.model_validate(p).model_dump(mode='json')
            old = next((m for m in data['members'] if m['id'] == member['id']), None)
            member['userId'] = old['userId'] if old else None
            if old:
                data['members'] = [member if m['id'] == member['id'] else m for m in data['members']]
            else:
                data['members'].append(member)
                db.execute('INSERT INTO memberships VALUES(?,?,NULL,NULL)', (pid, member['id']))
            kind, text = 'team', 'updated availability and skills for ' + member['name']
        elif body.type == 'project.update':
            require_lead(actor)
            allowed = {'name', 'description', 'deadline', 'timezone', 'holidays', 'wipLimits'}
            if not set(p) <= allowed:
                raise HTTPException(422, 'Unsupported project settings.')
            data.update(p)
            kind, text = 'settings', 'updated project settings'
        elif body.type == 'progress.add':
            require_lead(actor)
            if set(p) != {'health', 'summary', 'nextSteps'}:
                raise HTTPException(422, 'Provide health, summary and next steps.')
            if not all(isinstance(p[key], str) for key in p):
                raise HTTPException(422, 'Progress update fields must be text.')
            update = ProgressUpdate(id=secrets.token_hex(12), author=mid, time=datetime.now(timezone.utc).isoformat(),
                                    health=p['health'], summary=str(p['summary']).strip(), nextSteps=str(p['nextSteps']).strip()).model_dump(mode='json')
            data.setdefault('updates', []).append(update)
            kind, text, meta = 'progress', 'posted a project update: ' + update['health'], {'updateId': update['id']}
        elif body.type == 'milestone.save':
            require_lead(actor)
            milestone = Milestone.model_validate(p).model_dump(mode='json')
            old = next((m for m in data['milestones'] if m['id'] == milestone['id']), None)
            data['milestones'] = [milestone if m['id'] == milestone['id'] else m for m in data['milestones']] if old else [*data['milestones'], milestone]
            if old and old['name'] != milestone['name']:
                for task in data['tasks']:
                    if task['milestone'] == old['name']:
                        task['milestone'] = milestone['name']
            kind, text = 'milestone', 'planned milestone ' + milestone['name']
        elif body.type == 'comment.add':
            task = next((t for t in data['tasks'] if t['id'] == p.get('taskId')), None)
            if not task:
                raise HTTPException(404, 'Task not found.')
            comment = Comment(id=secrets.token_hex(10), author=mid, text=str(p.get('text', '')).strip(), kind=p.get('kind', 'comment'), time=datetime.now(timezone.utc).isoformat()).model_dump(mode='json')
            if not comment['text']:
                raise HTTPException(422, 'Write a comment first.')
            task['comments'].append(comment)
            kind, task_id, text = 'commented', task['id'], 'added ' + comment['kind'] + ' evidence to ' + task['title']
        elif body.type == 'scenario.apply':
            require_lead(actor)
            scenario = Scenario.model_validate({**p, 'version': version}).model_dump(mode='json')
            if not scenario['reason'].strip():
                raise HTTPException(422, 'Record a reason for the planning decision.')
            before = analyze(data, include_recommendations=False)
            data, affected = apply_scenario(data, scenario)
            after = analyze(data, include_recommendations=False)
            kind, task_id, text = 'decision', scenario['taskId'], 'approved ' + scenario['kind'] + ' scenario: ' + scenario['reason']
            meta = {'scenario': scenario, 'affected': affected, 'before': before['forecast']['date'], 'after': after['forecast']['date']}
        validate(data)
        data = ProjectData.model_validate(data).model_dump(mode='json')
        save_project(db, pid, version, data)
        event(db, pid, actor, kind, text, task_id, meta)
    return get_project(pid, user)


@app.post('/projects/{pid}/simulate')
def simulate(pid: str, body: Scenario, user=Depends(current_user)):
    with connect() as db:
        data, version, mid = load_project(db, pid, user['id'])
        history = events_for(db, pid)
    if body.version != version:
        raise HTTPException(409, 'Refresh the project before simulating.')
    changed, affected = apply_scenario(data, body.model_dump(mode='json'))
    before = analyze(data, history, include_recommendations=False)
    after = analyze(changed, history, include_recommendations=False)
    return {'before': before, 'after': after, 'affected': affected, 'version': version,
            'canApprove': actor_for(data, mid)['role'] == 'lead', 'scenario': body.model_dump(mode='json')}


class InviteRequest(BaseModel):
    version: int
    memberId: str


@app.post('/projects/{pid}/invites')
def create_invite(pid: str, body: InviteRequest, user=Depends(current_user)):
    with connect() as db:
        data, version, mid = load_project(db, pid, user['id'])
        require_lead(actor_for(data, mid))
        member = next((m for m in data['members'] if m['id'] == body.memberId), None)
        if not member or member.get('userId'):
            raise HTTPException(422, 'Choose an unclaimed member profile.')
        if version != body.version:
            raise HTTPException(409, 'Refresh the project first.')
        token = secrets.token_urlsafe(18)
        db.execute('UPDATE memberships SET invite_hash=? WHERE project_id=? AND member_id=?', (digest(token), pid, body.memberId))
    return {'code': token, 'member': member['name'], 'note': 'Single-use invitation. Share only with the intended teammate.'}


class JoinRequest(BaseModel):
    code: str = Field(min_length=10, max_length=200)


@app.post('/join')
def join(body: JoinRequest, user=Depends(current_user)):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM memberships WHERE invite_hash=? AND user_id IS NULL', (digest(body.code.strip()),)).fetchone()
        if not row:
            raise HTTPException(404, 'Invitation is invalid or already used.')
        if db.execute('SELECT 1 FROM memberships WHERE project_id=? AND user_id=?', (row['project_id'], user['id'])).fetchone():
            raise HTTPException(409, 'You already belong to this project.')
        project = db.execute('SELECT * FROM projects WHERE id=?', (row['project_id'],)).fetchone()
        data = json.loads(project['data'])
        member = actor_for(data, row['member_id'])
        member['userId'] = user['id']
        db.execute('UPDATE memberships SET user_id=?,invite_hash=NULL WHERE project_id=? AND member_id=? AND user_id IS NULL', (user['id'], row['project_id'], row['member_id']))
        save_project(db, row['project_id'], project['version'], data)
        event(db, row['project_id'], member, 'joined', 'joined the project')
    return {'id': row['project_id']}


@app.post('/projects/{pid}/tasks/{tid}/files')
async def upload(pid: str, tid: str, version: int = Form(...), file: UploadFile = File(...), user=Depends(current_user)):
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, 'Attachments must be at most 5 MB.')
    media = file.content_type or 'application/octet-stream'
    allowed = {'image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'}
    if media not in allowed:
        raise HTTPException(422, 'Upload a PNG, JPEG, WebP, PDF, TXT, or CSV file.')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        data, current_version, mid = load_project(db, pid, user['id'])
        task = next((t for t in data['tasks'] if t['id'] == tid), None)
        if not task:
            raise HTTPException(404, 'Task not found.')
        if len(task['files']) >= 10:
            raise HTTPException(422, 'Maximum ten attachments per task.')
        if current_version != version:
            raise HTTPException(409, 'Refresh before attaching a file.')
        fid = secrets.token_hex(12)
        name = Path(file.filename or 'attachment').name[:160]
        db.execute('INSERT INTO attachments VALUES(?,?,?,?,?,?,?)', (fid, pid, tid, name, media, content, mid))
        task['files'].append({'id': fid, 'name': name, 'size': len(content), 'mediaType': media})
        save_project(db, pid, version, data)
        event(db, pid, actor_for(data, mid), 'attached', 'attached evidence to ' + task['title'], tid)
    return get_project(pid, user)


@app.get('/files/{fid}')
def download_file(fid: str, user=Depends(current_user)):
    with connect() as db:
        row = db.execute('SELECT * FROM attachments WHERE id=?', (fid,)).fetchone()
        if not row:
            raise HTTPException(404)
        load_project(db, row['project_id'], user['id'])
        from urllib.parse import quote
        return Response(row['content'], media_type='application/octet-stream', headers={'Content-Disposition': "attachment; filename*=UTF-8''" + quote(row['name'])})


@app.get('/projects/{pid}/report')
def report(pid: str, user=Depends(current_user)):
    project = get_project(pid, user)
    project['generatedAt'] = datetime.now(timezone.utc).isoformat()
    project['limitations'] = ['Forecasts depend on estimates, declared skills and entered calendars.', 'Documentation and blocker-resolution records are self-reported evidence, not independent proof.', 'No automatic grades or member ranking.']
    return project

@app.get('/projects/{pid}/revision')
def revision(pid: str, user=Depends(current_user)):
    with connect() as db:
        _, version, _ = load_project(db, pid, user['id'])
    return {'version': version}

from redistribution_routes import register as register_redistribution
register_redistribution(app, current_user, PREVIEW_KEY, get_project)
