from copy import deepcopy
from datetime import date
import json
import pytest
from test_platform import client, workspace, cmd, sample
from portfolio import portfolio_workload
from store import connect, create_session


def test_shared_identity_capacity_is_not_added_twice():
    first = sample(); second = deepcopy(first)
    first['tasks'] = [first['tasks'][2]]; second['tasks'] = [second['tasks'][2]]
    first['tasks'][0]['due'] = second['tasks'][0]['due'] = '2026-10-28'
    result = portfolio_workload([('first', first), ('second', second)], date(2026, 10, 26))
    lead = next(p for p in result['people'] if p['linked'])
    assert lead['available'] == 20
    assert lead['remaining'] == 24
    assert lead['overloaded'] is True
    assert lead['days'][0]['planned'] == 4
    assert lead['days'][0]['overbooked'] == 0
    assert len(lead['projects']) == 2
    assert len([p for p in result['people'] if not p['linked']]) == 4


def test_unassigned_work_is_reported_without_inventing_owner_capacity():
    p = sample(); p['tasks'][2]['owner'] = ''
    result = portfolio_workload([('p', p)], date(2026, 10, 26))
    assert [t['id'] for t in result['unassigned']] == ['CG-03']
    assert all(t['id'] != 'CG-03' for person in result['people'] for t in person['tasks'])


def test_conflicting_calendars_use_lowest_day_capacity():
    first = sample(); second = deepcopy(first)
    second['members'][0]['overrides'] = {'2026-10-26': 0}
    second['timezone'] = 'UTC'
    lead = next(p for p in portfolio_workload([('a', first), ('b', second)], date(2026, 10, 26))['people'] if p['linked'])
    assert lead['calendarConflict']
    assert lead['days'][0]['available'] == 0
    assert lead['available'] == 16


def test_workload_excludes_completed_and_deferred_but_keeps_unscheduled():
    p = sample(); p['tasks'][1]['status'] = 'Deferred'; p['tasks'][2]['blocker'] = 'External decision'
    result = portfolio_workload([('p', p)], date(2026, 10, 26))
    lead = next(row for row in result['people'] if row['linked'])
    assert {t['id'] for t in lead['tasks']} == {'CG-03', 'CG-04'}
    assert lead['unscheduled'] == 2
    assert lead['remaining'] == 18


def test_portfolio_auth_and_no_private_project_leak(client):
    assert client.get('/workload').status_code == 401
    first = workspace(client)
    owner_id = first['data']['members'][0]['userId']
    client.post('/auth/logout'); second = workspace(client)
    second_id = second['data']['members'][0]['userId']
    # Give the first project's owner membership of a private second project,
    # but keep the second viewer out of the first project.
    with connect() as db:
        data = second['data']; data['members'][1]['userId'] = owner_id
        db.execute('UPDATE projects SET data=? WHERE id=?', (json.dumps(data), second['id']))
        db.execute('UPDATE memberships SET user_id=? WHERE project_id=? AND member_id=?', (owner_id, second['id'], 'database'))
    response = client.get('/workload')
    assert response.status_code == 200
    assert response.json()['projectCount'] == 1
    assert first['id'] not in response.text
    assert all(project['id'] == second['id'] for p in response.json()['people'] for project in p['projects'])
    client.cookies.set('contrigraph_session', create_session(owner_id))
    assert client.get('/workload').json()['projectCount'] == 2


def test_updates_persist_export_and_audit(client):
    p = workspace(client)
    payload = {'health': 'At risk', 'summary': 'Review is delayed', 'nextSteps': 'Lead will arrange an independent review'}
    response = cmd(client, p, 'progress.add', payload)
    assert response.status_code == 200
    updated = response.json()
    update = updated['data']['updates'][0]
    assert update['author'] == p['myMemberId'] and update['time'] and update['id']
    assert updated['activity'][0]['kind'] == 'progress'
    assert client.get('/projects/' + p['id']).json()['data']['updates'] == [update]
    assert client.get('/projects/' + p['id'] + '/report').json()['data']['updates'] == [update]
    assert cmd(client, p, 'progress.add', payload).status_code == 409
    assert cmd(client, updated, 'project.update', {'updates': []}).status_code == 422


@pytest.mark.parametrize('payload', [
    {'health':'On track','summary':'  ','nextSteps':'Work'},
    {'health':'Excellent','summary':'Progress','nextSteps':'Work'},
    {'health':'On track','summary':None,'nextSteps':'Work'},
    {'health':'On track','summary':'Progress','nextSteps':'Work','author':'forged'},
])
def test_invalid_update_atomic(client, payload):
    p = workspace(client)
    assert cmd(client, p, 'progress.add', payload).status_code == 422
    assert client.get('/projects/' + p['id']).json()['version'] == p['version']


def test_member_can_read_but_not_set_limits_or_publish(client):
    p = workspace(client)
    code = client.post('/projects/' + p['id'] + '/invites', json={'version': p['version'], 'memberId': 'interface'}).json()['code']
    client.post('/auth/logout')
    client.post('/auth/register', json={'name':'Reader','email':'reader@example.com','password':'valid-test-password'})
    client.post('/join', json={'code':code})
    p = client.get('/projects/' + p['id']).json()
    assert cmd(client,p,'progress.add',{'health':'On track','summary':'Test','nextSteps':'Test'}).status_code == 403
    assert cmd(client,p,'project.update',{'wipLimits':{'In progress':1}}).status_code == 403
    assert client.get('/workload').status_code == 200


@pytest.mark.parametrize('limits', [{'Done':2},{'In progress':0},{'In review':201},{'In progress':1.5},{'In review':True}])
def test_invalid_wip_limits(client, limits):
    p = workspace(client)
    assert cmd(client,p,'project.update',{'wipLimits':limits}).status_code == 422
    assert client.get('/projects/'+p['id']).json()['version'] == p['version']


def test_wip_advisory_survives_reload_and_can_be_disabled(client):
    p = workspace(client)
    p = cmd(client,p,'project.update',{'wipLimits':{'In progress':1,'In review':1}}).json()
    p = cmd(client,p,'task.status',{'taskId':'CG-02','status':'In progress'}).json()
    assert not any(r['code']=='wip' for r in p['analysis']['health']['reasons'])
    response = cmd(client,p,'task.status',{'taskId':'CG-03','status':'In progress'})
    assert response.status_code == 200  # advisory, never an unexpected hard stop
    p = client.get('/projects/'+p['id']).json()
    assert p['data']['wipLimits']['In progress'] == 1
    assert any(r['code']=='wip' for r in p['analysis']['health']['reasons'])
    p = cmd(client,p,'project.update',{'wipLimits':{}}).json()
    assert not any(r['code']=='wip' for r in p['analysis']['health']['reasons'])


def test_legacy_project_defaults(client):
    p = workspace(client)
    with connect() as db:
        data = p['data']; data.pop('updates'); data.pop('wipLimits')
        db.execute('UPDATE projects SET data=? WHERE id=?', (json.dumps(data),p['id']))
    result = client.get('/projects/'+p['id']).json()
    assert result['data']['updates'] == [] and result['data']['wipLimits'] == {}
