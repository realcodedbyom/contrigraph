from copy import deepcopy
import pytest
from test_platform import client, workspace, cmd
from store import create_session


def as_member(client, p, member='interface'):
    code = client.post('/projects/' + p['id'] + '/invites', json={'version': p['version'], 'memberId': member}).json()['code']
    client.post('/auth/logout')
    assert client.post('/auth/register', json={'name': 'Teammate', 'email': member + '@example.com', 'password': 'valid-test-password'}).status_code == 200
    assert client.post('/join', json={'code': code}).status_code == 200
    return client.get('/projects/' + p['id']).json()


def as_lead(client, p):
    client.cookies.set('contrigraph_session', create_session(p['data']['members'][0]['userId']))
    return client.get('/projects/' + p['id']).json()


def test_member_request_lead_response_persists_without_changing_plan(client):
    p = as_member(client, workspace(client))
    before = deepcopy(p['data']['tasks'])
    r = cmd(client, p, 'request.create', {'taskId': 'CG-07', 'category': 'Deadline change', 'message': 'Need two more days for testing.'})
    assert r.status_code == 200, r.text
    p = r.json(); item = p['data']['requests'][0]
    member_id = p['data']['members'][2]['userId']
    assert item['author'] == p['myMemberId'] and item['status'] == 'Open'
    assert item['createdAt'] and p['activity'][0]['meta']['requestId'] == item['id']
    reply = {'requestId': item['id'], 'status': 'Resolved', 'response': 'Agreed. I will adjust the plan after review.'}
    assert cmd(client, p, 'request.respond', reply).status_code == 403
    lead = as_lead(client, p)
    updated = cmd(client, lead, 'request.respond', reply).json()
    assert updated['data']['tasks'] == before
    assert updated['data']['requests'][0]['respondedBy'] == lead['myMemberId']
    assert cmd(client, lead, 'request.respond', reply).status_code == 409
    assert cmd(client, updated, 'request.respond', reply).status_code == 409
    client.cookies.set('contrigraph_session', create_session(member_id))
    result = client.get('/projects/' + p['id']).json()
    assert result['data']['requests'][0]['response'] == reply['response']
    assert client.get('/projects/' + p['id'] + '/report').json()['data']['requests'][0]['status'] == 'Resolved'


@pytest.mark.parametrize('payload', [
    {'category': 'Help', 'message': '   '},
    {'category': 'Invalid', 'message': 'Help'},
    {'category': 'Help', 'message': 'Help', 'author': 'lead'},
    {'category': 'Help', 'message': 123},
    {'category': 'Help', 'message': 'x' * 2001},
])
def test_invalid_requests_do_not_change_project(client, payload):
    p = workspace(client)
    assert cmd(client, p, 'request.create', payload).status_code == 422
    assert client.get('/projects/' + p['id']).json()['version'] == p['version']


def test_request_rejects_foreign_task_and_only_author_can_cancel(client):
    p = as_member(client, workspace(client))
    assert cmd(client, p, 'request.create', {'taskId': 'foreign', 'category': 'Help', 'message': 'Help'}).status_code == 404
    p = cmd(client, p, 'request.create', {'category': 'Help', 'message': 'Need a design decision.'}).json()
    member = p['data']['members'][2]['userId']; rid = p['data']['requests'][0]['id']
    lead = as_lead(client, p)
    assert cmd(client, lead, 'request.cancel', {'requestId': rid}).status_code == 403
    client.cookies.set('contrigraph_session', create_session(member))
    p = cmd(client, p, 'request.cancel', {'requestId': rid}).json()
    assert p['data']['requests'][0]['status'] == 'Cancelled'


def test_archive_restore_preserves_content_and_audits_workload_change(client):
    p = workspace(client)
    p = cmd(client, p, 'comment.add', {'taskId': 'CG-02', 'text': 'Keep this context.'}).json()
    r = client.post('/projects/' + p['id'] + '/tasks/CG-02/files', data={'version': p['version']}, files={'file': ('context.txt', b'context', 'text/plain')})
    assert r.status_code == 200
    p = r.json(); original = next(t for t in p['data']['tasks'] if t['id'] == 'CG-02')
    before = p['analysis']['summary']['remaining']
    r = cmd(client, p, 'task.archive', {'taskId': 'CG-02', 'reason': 'Duplicate task'})
    assert r.status_code == 200, r.text
    p = r.json()
    assert all(t['id'] != 'CG-02' for t in p['data']['tasks'])
    assert p['data']['archivedTasks'][0]['task'] == original
    assert p['analysis']['summary']['remaining'] == before - original['remaining']
    assert p['activity'][0]['kind'] == 'archived'
    assert cmd(client, p, 'task.save', original).status_code == 422
    r = cmd(client, p, 'task.restore', {'taskId': 'CG-02'})
    assert r.status_code == 200, r.text
    p = r.json()
    assert next(t for t in p['data']['tasks'] if t['id'] == 'CG-02') == original
    assert p['data']['archivedTasks'] == []
    assert p['analysis']['summary']['remaining'] == before
    assert p['activity'][0]['kind'] == 'restored'


def test_members_cannot_archive_or_restore(client):
    p = workspace(client)
    p = cmd(client, p, 'task.archive', {'taskId': 'CG-02', 'reason': 'Duplicate'}).json()
    p = as_member(client, p)
    assert cmd(client, p, 'task.archive', {'taskId': 'CG-07', 'reason': 'Not wanted'}).status_code == 403
    assert cmd(client, p, 'task.restore', {'taskId': 'CG-02'}).status_code == 403


def test_archive_protects_dependencies_reviews_and_open_requests(client):
    p = workspace(client)
    for tid in ['CG-01', 'CG-03']:
        assert cmd(client, p, 'task.archive', {'taskId': tid, 'reason': 'Remove'}).status_code == 422
    p = cmd(client, p, 'request.create', {'category': 'Help', 'taskId': 'CG-02', 'message': 'Please clarify.'}).json()
    assert cmd(client, p, 'task.archive', {'taskId': 'CG-02', 'reason': 'Remove'}).status_code == 422
    p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In review'}).json()
    assert cmd(client, p, 'task.archive', {'taskId': 'CG-07', 'reason': 'Remove'}).status_code == 422


def test_restore_requires_prerequisites_and_current_skills(client):
    p = workspace(client)
    for tid in ['CG-04', 'CG-03']:
        p = cmd(client, p, 'task.archive', {'taskId': tid, 'reason': 'Replan'}).json()
    assert cmd(client, p, 'task.restore', {'taskId': 'CG-04'}).status_code == 422
    member = deepcopy(p['data']['members'][0]); member['skills'].remove('scheduling')
    p = cmd(client, p, 'member.save', member).json()
    assert cmd(client, p, 'task.restore', {'taskId': 'CG-03'}).status_code == 422
    member['skills'].append('scheduling'); p = cmd(client, p, 'member.save', member).json()
    for tid in ['CG-03', 'CG-04']:
        r = cmd(client, p, 'task.restore', {'taskId': tid})
        assert r.status_code == 200, r.text
        p = r.json()


def test_owner_can_update_remaining_while_blocked_but_not_another_persons_work(client):
    p = as_member(client, workspace(client))
    assert cmd(client, p, 'task.progress', {'taskId': 'CG-03', 'remaining': 3}).status_code == 403
    p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In progress'}).json()
    p = cmd(client, p, 'task.blocker', {'taskId': 'CG-07', 'blocker': 'Waiting for feedback'}).json()
    r = cmd(client, p, 'task.progress', {'taskId': 'CG-07', 'remaining': 2.5})
    assert r.status_code == 200, r.text
    task = next(t for t in r.json()['data']['tasks'] if t['id'] == 'CG-07')
    assert task['remaining'] == 2.5 and task['status'] == 'In progress' and task['blocker']
    assert cmd(client, p, 'task.progress', {'taskId': 'CG-07', 'remaining': 2}).status_code == 409


@pytest.mark.parametrize('remaining', [-1, 0.25, 501, True, 'hours'])
def test_invalid_progress_is_atomic(client, remaining):
    p = workspace(client)
    assert cmd(client, p, 'task.progress', {'taskId': 'CG-02', 'remaining': remaining}).status_code == 422
    assert client.get('/projects/' + p['id']).json()['version'] == p['version']


def test_submitted_effort_is_immutable_until_returned(client):
    p = workspace(client)
    p = cmd(client, p, 'task.status', {'taskId': 'CG-02', 'status': 'In review'}).json()
    assert cmd(client, p, 'task.progress', {'taskId': 'CG-02', 'remaining': 2}).status_code == 422
    assert cmd(client, p, 'task.status', {'taskId': 'CG-02', 'status': 'In review', 'remaining': 2}).status_code == 422
