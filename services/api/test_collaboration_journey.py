"""A full two-account journey with independent cookie jars and a fresh app session."""
from copy import deepcopy
from fastapi.testclient import TestClient
import main
from test_platform import client, cmd


def test_two_accounts_complete_assignment_help_reply_review_and_persisted_reports(client):
    lead = client
    credentials = {'name': 'Demo Lead', 'email': 'journey-lead@example.com', 'password': 'local-journey-password'}
    assert lead.post('/auth/register', json=credentials).status_code == 200
    pid = lead.post('/projects', json={'name': 'Collaboration journey', 'deadline': '2026-12-31', 'sample': True}).json()['id']
    p = lead.get('/projects/' + pid).json()
    code = lead.post('/projects/' + pid + '/invites', json={'version': p['version'], 'memberId': 'interface'}).json()['code']
    member_credentials = {'name': 'Demo Member', 'email': 'journey-member@example.com', 'password': 'local-member-password'}
    with TestClient(main.app) as member:
        assert member.post('/auth/register', json=member_credentials).status_code == 200
        assert member.post('/join', json={'code': code}).status_code == 200
        p = lead.get('/projects/' + pid).json()
        task = deepcopy(next(t for t in p['data']['tasks'] if t['id'] == 'CG-02'))
        task['owner'] = 'interface'
        assert cmd(lead, p, 'task.save', task).status_code == 200
        assignment = member.get('/notifications').json()['items'][0]
        assert assignment['kind'] == 'assignment' and assignment['taskId'] == 'CG-02'
        assert lead.get('/notifications').json()['unreadCount'] == 0
        assert member.post('/notifications/read', json={'ids': [assignment['id']]}).status_code == 200
        p = member.get('/projects/' + pid).json()
        p = cmd(member, p, 'task.status', {'taskId': 'CG-02', 'status': 'In progress'}).json()
        p = cmd(member, p, 'request.create', {'taskId': 'CG-02', 'category': 'Help', 'message': 'Please confirm the acceptance cases.'}).json()
        request_id = p['data']['requests'][-1]['id']
        assert lead.get('/notifications').json()['items'][0]['requestId'] == request_id
        p = lead.get('/projects/' + pid).json()
        p = cmd(lead, p, 'request.respond', {'requestId': request_id, 'status': 'Resolved', 'response': 'Include successful checkout and failed payment.'}).json()
        assert member.get('/notifications').json()['items'][0]['kind'] == 'reply'
        p = member.get('/projects/' + pid).json()
        p = cmd(member, p, 'comment.add', {'taskId': 'CG-02', 'kind': 'documentation', 'text': 'Both acceptance cases tested; evidence attached.'}).json()
        upload = member.post('/projects/' + pid + '/tasks/CG-02/files', data={'version': p['version']}, files={'file': ('test-results.txt', b'checkout: pass\nfailed payment: pass', 'text/plain')})
        assert upload.status_code == 200
        p = upload.json()
        p = cmd(member, p, 'task.status', {'taskId': 'CG-02', 'status': 'In review'}).json()
        assert lead.get('/notifications').json()['items'][0]['kind'] == 'review'
        assert cmd(member, p, 'task.approve', {'taskId': 'CG-02'}).status_code == 403
        p = lead.get('/projects/' + pid).json()
        p = cmd(lead, p, 'task.approve', {'taskId': 'CG-02'}).json()
        final_version = p['version']
        for actor in [lead, member]:
            report = actor.get('/projects/' + pid + '/report').json()
            accepted = next(t for t in report['data']['tasks'] if t['id'] == 'CG-02')
            assert accepted['status'] == 'Done' and accepted['remaining'] == 0
            assert accepted['acceptedBy'] == 'lead' and accepted['acceptance'] == 'Independent review'
            assert accepted['files'][0]['name'] == 'test-results.txt'
            assert report['data']['requests'][-1]['status'] == 'Resolved'
            assert report['generatedAt'] and report['version'] == final_version
            assert {'updated', 'request', 'submitted', 'approved'} <= {e['kind'] for e in report['activity']}
            contribution = next(c for c in report['analysis']['contributions'] if c['memberId'] == 'interface')
            assert contribution['acceptedEffort'] == 12 and contribution['documentation'] == 1
            assert next(c for c in report['analysis']['contributions'] if c['memberId'] == 'lead')['reviews'] == 1
        assert lead.post('/auth/logout').status_code == 200
        assert member.post('/auth/logout').status_code == 200
    # A fresh app client and new login must read persisted storage, not shared client state.
    with TestClient(main.app) as reopened:
        assert reopened.post('/auth/login', json=member_credentials).status_code == 200
        saved = reopened.get('/projects/' + pid + '/report').json()
        assert saved['version'] == final_version
        assert next(t for t in saved['data']['tasks'] if t['id'] == 'CG-02')['status'] == 'Done'
        feed = reopened.get('/notifications').json()
        assert {n['kind'] for n in feed['items']} == {'assignment', 'reply'}
        assert next(n for n in feed['items'] if n['id'] == assignment['id'])['readAt']
