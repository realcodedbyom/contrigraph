from copy import deepcopy
import pytest
from test_platform import client, workspace, cmd
from test_team_workflows import as_member, as_lead
from store import connect, create_session


def inbox(client, **params):
    r = client.get('/notifications', params=params)
    assert r.status_code == 200, r.text
    return r.json()


def sign_as(client, uid):
    client.cookies.set('contrigraph_session', create_session(uid))


def test_assignments_are_transactional_recipient_scoped_and_not_duplicated(client):
    p = as_member(client, workspace(client)); uid = p['data']['members'][2]['userId']
    p = as_lead(client, p)
    task = deepcopy(next(t for t in p['data']['tasks'] if t['id'] == 'CG-02'))
    task['owner'] = 'interface'
    original = p
    p = cmd(client, p, 'task.save', task).json()
    assert inbox(client)['items'] == []
    assert cmd(client, original, 'task.save', task).status_code == 409
    p = cmd(client, p, 'task.save', task).json()
    sign_as(client, uid)
    feed = inbox(client)
    assert feed['unreadCount'] == 1
    assert feed['items'][0]['kind'] == 'assignment' and feed['items'][0]['taskId'] == 'CG-02'
    assert feed['items'][0]['projectId'] == p['id']
    assert 'assigned you' in feed['items'][0]['message']


def test_help_reply_review_and_blocker_reach_correct_people(client):
    p = as_member(client, workspace(client)); uid = p['data']['members'][2]['userId']
    p = cmd(client, p, 'request.create', {'taskId': 'CG-07', 'category': 'Help', 'message': 'Need design feedback'}).json()
    rid = p['data']['requests'][0]['id']
    assert inbox(client)['unreadCount'] == 0
    p = as_lead(client, p)
    assert inbox(client)['items'][0]['requestId'] == rid
    p = cmd(client, p, 'request.respond', {'requestId': rid, 'status': 'Resolved', 'response': 'Reviewed the design. Continue.'}).json()
    assert inbox(client)['unreadCount'] == 1
    sign_as(client, uid)
    assert inbox(client)['items'][0]['kind'] == 'reply'
    p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In review'}).json()
    assert inbox(client)['unreadCount'] == 1
    p = as_lead(client, p)
    assert {n['kind'] for n in inbox(client)['items']} == {'help', 'review'}
    sign_as(client, uid)
    p = cmd(client, p, 'task.blocker', {'taskId': 'CG-08', 'blocker': 'Need recording equipment'}).json()
    p = as_lead(client, p)
    assert inbox(client)['items'][0]['taskId'] == 'CG-08'
    assert inbox(client)['unreadCount'] == 3


def test_read_state_is_private_persistent_and_does_not_change_project_version(client):
    p = as_member(client, workspace(client)); uid = p['data']['members'][2]['userId']
    p = cmd(client, p, 'request.create', {'category': 'Help', 'message': 'Help'}).json()
    p = as_lead(client, p); nid = inbox(client)['items'][0]['id']
    assert client.post('/notifications/read', json={'ids': [nid]}).status_code == 200
    assert inbox(client, unread=True)['items'] == []
    assert inbox(client)['items'][0]['readAt']
    assert client.get('/projects/' + p['id']).json()['version'] == p['version']
    assert client.post('/notifications/read', json={'ids': [nid], 'read': False}).status_code == 200
    assert inbox(client)['unreadCount'] == 1
    sign_as(client, uid)
    assert client.post('/notifications/read', json={'ids': [nid]}).status_code == 404
    assert client.get('/notifications', params={'before': nid}).status_code == 404
    assert inbox(client)['items'] == []
    client.post('/auth/logout')
    assert client.get('/notifications').status_code == 401


def test_notifications_hidden_after_membership_is_removed(client):
    p = as_member(client, workspace(client))
    p = cmd(client, p, 'request.create', {'category': 'Help', 'message': 'Help'}).json()
    p = as_lead(client, p); nid = inbox(client)['items'][0]['id']
    with connect() as db:
        db.execute('DELETE FROM memberships WHERE project_id=? AND member_id=?', (p['id'], p['myMemberId']))
    assert inbox(client)['unreadCount'] == 0
    assert client.post('/notifications/read', json={'ids': [nid]}).status_code == 404


def test_notification_failure_rolls_back_task_and_audit(client, monkeypatch):
    p = workspace(client)
    import notifications
    def broken(*args):
        raise ValueError('notification unavailable')
    monkeypatch.setattr(notifications, 'notify_changes', broken)
    assert cmd(client, p, 'task.progress', {'taskId': 'CG-02', 'remaining': 4}).status_code == 422
    after = client.get('/projects/' + p['id']).json()
    assert after['version'] == p['version'] and after['data'] == p['data'] and after['activity'] == p['activity']


def test_self_assignment_does_not_notify_and_preview_never_sends(client):
    p = workspace(client)
    task = deepcopy(next(t for t in p['data']['tasks'] if t['id'] == 'CG-02'))
    task['owner'] = ''
    p = cmd(client, p, 'task.save', task).json()
    task['owner'] = 'lead'
    p = cmd(client, p, 'task.save', task).json()
    assert inbox(client)['items'] == []
    assert client.post('/projects/' + p['id'] + '/simulate', json={'version': p['version'], 'kind': 'reassign', 'taskId': 'CG-02', 'memberId': 'interface'}).status_code == 200
    assert inbox(client)['items'] == []


def test_pagination_and_bulk_read_have_no_missing_or_duplicate_items(client):
    p = as_member(client, workspace(client))
    for i in range(53):
        p = cmd(client, p, 'request.create', {'category': 'Help', 'message': f'Request {i}'}).json()
    p = as_lead(client, p)
    first = inbox(client); second = inbox(client, before=first['nextCursor'])
    assert len(first['items']) == 50 and len(second['items']) == 3
    assert len({n['id'] for n in first['items'] + second['items']}) == 53
    ids = [n['id'] for n in first['items']]
    assert client.post('/notifications/read', json={'ids': ids + ['foreign']}).status_code == 404
    assert inbox(client)['unreadCount'] == 53
    assert client.post('/notifications/read', json={'ids': ids}).status_code == 200
    assert inbox(client, unread=True)['unreadCount'] == 3


def test_portfolio_approval_notifies_recipient_without_other_project_details(client):
    from test_redistribution import setup_portfolio, preview, approval
    pid, other, owner = setup_portfolio(client)
    proposal = preview(client, pid)
    sign_as(client, 'helper-user')
    assert inbox(client)['items'] == []
    sign_as(client, owner)
    assert client.post('/workload/redistribution/approve', json=approval(proposal)).status_code == 200
    assert client.post('/workload/redistribution/approve', json=approval(proposal)).status_code == 409
    sign_as(client, 'helper-user')
    items = inbox(client)['items']
    assert len(items) == 1 and items[0]['taskId'] == 'side'
    assert items[0]['projectId'] == pid and other not in str(items)
    assert 'Other project' not in str(items)


def test_repeat_submission_does_not_repeat_notification(client):
    p = as_member(client, workspace(client))
    for _ in range(2):
        p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In review'}).json()
    as_lead(client, p)
    assert inbox(client)['unreadCount'] == 1
