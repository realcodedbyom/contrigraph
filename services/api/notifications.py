"""Transactional, recipient-scoped notifications. No email or push delivery."""
from datetime import datetime, timezone
import json
import secrets
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict

SCHEMA = '''CREATE TABLE IF NOT EXISTS notifications(
id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL,
task_id TEXT NOT NULL, request_id TEXT NOT NULL, message TEXT NOT NULL,
created_at TEXT NOT NULL, read_at TEXT);
CREATE INDEX IF NOT EXISTS notifications_recipient ON notifications(user_id,created_at,id);'''


def notify_changes(db, pid, before, after, actor_id):
    members = {m['id']: m for m in after['members']}
    actor = members.get(actor_id, {})
    actor_user = actor.get('userId')
    actor_name = actor.get('name', 'Your team')
    sent = set()

    def send(mid, kind, message, task='', request=''):
        uid = members.get(mid, {}).get('userId')
        key = (uid, kind, task, request)
        if not uid or uid == actor_user or key in sent:
            return
        sent.add(key)
        db.execute('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,?,NULL)',
                   (secrets.token_hex(16), uid, pid, kind, task, request, message,
                    datetime.now(timezone.utc).isoformat()))

    old_tasks = {t['id']: t for t in before['tasks']}
    for task in after['tasks']:
        old = old_tasks.get(task['id'], {})
        if task['owner'] and task['owner'] != old.get('owner'):
            send(task['owner'], 'assignment', f"{actor_name} assigned you: {task['title']}", task['id'])
        if task['status'] == 'In review' and old.get('status') != 'In review':
            for mid, member in members.items():
                if member['role'] in ['lead', 'reviewer']:
                    send(mid, 'review', f"{actor_name} submitted for review: {task['title']}", task['id'])
        if task.get('blocker') and task.get('blocker') != old.get('blocker'):
            for mid, member in members.items():
                if member['role'] == 'lead':
                    send(mid, 'help', f"{actor_name} reported a blocker: {task['title']}", task['id'])
    old_requests = {r['id']: r for r in before.get('requests', [])}
    for request in after.get('requests', []):
        old = old_requests.get(request['id'])
        if not old:
            author = members.get(request['author'], {}).get('name', 'A teammate')
            for mid, member in members.items():
                if member['role'] == 'lead':
                    send(mid, 'help', f"{author} requested: {request['category']}", request['taskId'], request['id'])
        elif old['status'] == 'Open' and request['status'] in ['Resolved', 'Declined']:
            send(request['author'], 'reply', f"{actor_name} replied to your {request['category'].lower()} request: {request['status'].lower()}", request['taskId'], request['id'])


class ReadNotifications(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ids: list[str] = Field(min_length=1, max_length=100)
    read: bool = True


def register(app, current_user, connect):
    # Recheck current membership for both reads and mutations, even for old notifications.
    scope = '''n.user_id=? AND EXISTS(SELECT 1 FROM memberships m
               WHERE m.project_id=n.project_id AND m.user_id=n.user_id)'''

    @app.get('/notifications')
    def inbox(unread: bool = False, before: str = '', user=Depends(current_user)):
        with connect() as db:
            params = [user['id']]
            where = scope + (' AND n.read_at IS NULL' if unread else '')
            if before:
                cursor = db.execute('SELECT n.created_at,n.id FROM notifications n WHERE ' + scope + ' AND n.id=?', (user['id'], before)).fetchone()
                if not cursor:
                    raise HTTPException(404, 'Notification cursor is no longer available.')
                where += ' AND (n.created_at<? OR (n.created_at=? AND n.id<?))'
                params += [cursor['created_at'], cursor['created_at'], cursor['id']]
            rows = db.execute('SELECT n.* FROM notifications n WHERE ' + where + ' ORDER BY n.created_at DESC,n.id DESC LIMIT 51', params).fetchall()
            project_ids = sorted({r['project_id'] for r in rows[:50]})
            names = {}
            if project_ids:
                slots = ','.join('?' for _ in project_ids)
                names = {r['id']: json.loads(r['data'])['name'] for r in db.execute(f'SELECT id,data FROM projects WHERE id IN ({slots})', project_ids)}
            count = db.execute('SELECT COUNT(*) AS count FROM notifications n WHERE ' + scope + ' AND n.read_at IS NULL', (user['id'],)).fetchone()['count']
            items = [{ 'id': r['id'], 'projectId': r['project_id'], 'projectName': names[r['project_id']], 'kind': r['kind'], 'taskId': r['task_id'], 'requestId': r['request_id'], 'message': r['message'], 'createdAt': r['created_at'], 'readAt': r['read_at']} for r in rows[:50]]
            return {'items': items, 'unreadCount': count, 'nextCursor': rows[49]['id'] if len(rows) > 50 else None}

    @app.post('/notifications/read')
    def read_notifications(body: ReadNotifications, user=Depends(current_user)):
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            placeholders = ','.join('?' for _ in body.ids)
            rows = db.execute('SELECT n.id FROM notifications n WHERE ' + scope + f' AND n.id IN ({placeholders})', [user['id'], *body.ids]).fetchall()
            if {r['id'] for r in rows} != set(body.ids):
                raise HTTPException(404, 'Notification not found.')
            stamp = datetime.now(timezone.utc).isoformat() if body.read else None
            db.execute(f'UPDATE notifications SET read_at=? WHERE user_id=? AND id IN ({placeholders})', [stamp, user['id'], *body.ids])
        return {'ok': True}
