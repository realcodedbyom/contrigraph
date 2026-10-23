"""Audited requests and reversible removal, inside the project command transaction."""
from datetime import datetime, timezone
import secrets
from fastapi import HTTPException
from models import TeamRequest, ArchivedTask
from engine import eligible


def text_field(payload, key, maximum):
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise HTTPException(422, f'Provide {key} with 1–{maximum} characters.')
    return value.strip()


def apply_team_command(data, actor, kind, payload):
    now = datetime.now(timezone.utc).isoformat()
    mid = actor['id']
    requests = data.setdefault('requests', [])
    archived = data.setdefault('archivedTasks', [])
    if kind == 'request.create':
        if not set(payload) <= {'taskId', 'category', 'message'}:
            raise HTTPException(422, 'Unsupported request fields.')
        task_id = payload.get('taskId', '')
        if task_id and not any(t['id'] == task_id for t in data['tasks']):
            raise HTTPException(404, 'Choose a task in this project.')
        item = TeamRequest(id=secrets.token_hex(12), author=mid, taskId=task_id,
                           category=payload.get('category'), message=text_field(payload, 'message', 2000), createdAt=now).model_dump(mode='json')
        requests.append(item)
        return 'request', task_id, 'asked the team lead: ' + item['category'], {'requestId': item['id']}
    if kind in ['request.respond', 'request.cancel']:
        allowed = {'requestId'} if kind == 'request.cancel' else {'requestId', 'status', 'response'}
        if set(payload) != allowed:
            raise HTTPException(422, 'Unsupported request fields.')
        item = next((r for r in requests if r['id'] == payload.get('requestId')), None)
        if not item:
            raise HTTPException(404, 'Request not found.')
        if kind == 'request.cancel' and item['author'] != mid:
            raise HTTPException(403, 'Only the requester can cancel their request.')
        if kind == 'request.respond' and actor['role'] != 'lead':
            raise HTTPException(403, 'Only a team lead can respond to requests.')
        if item['status'] != 'Open':
            raise HTTPException(409, 'This request is already closed. Refresh to see the response.')
        if kind == 'request.cancel':
            item.update(status='Cancelled', respondedAt=now, respondedBy=mid)
        else:
            if payload.get('status') not in ['Resolved', 'Declined']:
                raise HTTPException(422, 'Choose Resolved or Declined.')
            item.update(status=payload['status'], response=text_field(payload, 'response', 2000), respondedAt=now, respondedBy=mid)
        return 'request', item['taskId'], item['status'].lower() + ' a team request', {'requestId': item['id'], 'status': item['status']}
    if actor['role'] != 'lead':
        raise HTTPException(403, 'Only a team lead can archive or restore tasks.')
    if kind == 'task.archive':
        if set(payload) != {'taskId', 'reason'}:
            raise HTTPException(422, 'Provide a task and archive reason.')
        task = next((t for t in data['tasks'] if t['id'] == payload.get('taskId')), None)
        if not task:
            raise HTTPException(404, 'Task not found.')
        if task['status'] in ['Done', 'In review']:
            raise HTTPException(422, 'Accepted and submitted work must retain its review history. Return submitted work to In progress first.')
        if any(task['id'] in t['dependencies'] for t in data['tasks']):
            raise HTTPException(422, 'Other tasks depend on this task. Replan those dependencies before archiving it.')
        if any(r['taskId'] == task['id'] and r['status'] == 'Open' for r in requests):
            raise HTTPException(422, 'Respond to open requests for this task before archiving it.')
        archived.append(ArchivedTask(task=task, archivedBy=mid, archivedAt=now, reason=text_field(payload, 'reason', 500)).model_dump(mode='json'))
        data['tasks'] = [t for t in data['tasks'] if t['id'] != task['id']]
        return 'archived', task['id'], 'archived ' + task['title'], {'reason': payload['reason'].strip()}
    if kind == 'task.restore':
        if set(payload) != {'taskId'}:
            raise HTTPException(422, 'Provide only the archived task identifier.')
        record = next((r for r in archived if r['task']['id'] == payload.get('taskId')), None)
        if not record:
            raise HTTPException(404, 'Archived task not found.')
        task = record['task']
        if any(t['id'] == task['id'] for t in data['tasks']):
            raise HTTPException(422, 'A task with this identifier already exists.')
        if task['owner']:
            owner = next((m for m in data['members'] if m['id'] == task['owner']), None)
            if not owner or not eligible(owner, task):
                raise HTTPException(422, 'The original owner no longer has the required skills. Update the team skills before restoring this task.')
        if any(dep not in {t['id'] for t in data['tasks']} for dep in task['dependencies']):
            raise HTTPException(422, 'Restore the prerequisite tasks first.')
        data['tasks'].append(task)
        data['archivedTasks'] = [r for r in archived if r['task']['id'] != task['id']]
        return 'restored', task['id'], 'restored ' + task['title'], {}
    raise HTTPException(422, 'Unsupported team command.')
