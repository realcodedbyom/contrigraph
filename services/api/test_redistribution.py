from copy import deepcopy
from datetime import date
import json
import pytest
from models import ProjectData, Member, Task
from redistribution import joint_schedule, simulate_move, suggest_moves
from test_platform import client, workspace, cmd
from store import connect, create_session
import main

START = date(2026, 10, 26)
MOVE = {'projectId':'a', 'taskId':'side', 'memberId':'helper'}


def projects():
    members = [Member(id='lead', userId='owner', name='Specialist', role='lead', skills=['specialist','testing']), Member(id='helper',userId='helper-user', name='Helper',skills=['testing'])]
    a = ProjectData(name='Primary', deadline='2026-11-10', members=members, tasks=[
        Task(id='side',title='Transferable testing',owner='lead',effort=8,remaining=8,priority='High',due='2026-10-27',requiredSkills=['testing']),
        Task(id='special',title='Unique specialist work',owner='lead',effort=8,remaining=8,due='2026-10-28',requiredSkills=['specialist']),
        Task(id='dependent',title='Downstream',owner='lead',effort=2,remaining=2,due='2026-11-10',requiredSkills=['specialist'],dependencies=['special'])]).model_dump(mode='json')
    b = ProjectData(name='Other project',deadline='2026-11-10',members=[members[0]],tasks=[Task(id='other',title='Other project work',owner='lead',effort=8,remaining=8,priority='High',due='2026-10-28',requiredSkills=['testing'])]).model_dump(mode='json')
    return {'a':a,'b':b}


def test_sole_specialist_sidework_moves_and_no_task_is_delayed():
    p = projects()
    preview = simulate_move(p, {'owner','helper-user'}, MOVE, START)
    assert preview['protectedTasks'] == ['special','dependent']
    assert p['a']['tasks'][0]['owner'] == 'lead' # preview has no mutation
    assert any(t['taskId']=='special' for t in preview['improvedTasks'])
    assert all(i['after']<=i['before'] for i in preview['impacts'])
    found = suggest_moves(p, {'owner','helper-user'}, {'a'}, START)
    assert found['suggestions'][0]['proposal'] == MOVE


def test_joint_calendar_never_double_books_and_preserves_dependencies():
    p=projects(); result,_=joint_schedule(p,START)
    used=set()
    for key,row in result.items():
        assert not used.intersection(row['slots'])
        used.update(row['slots'])
    assert result['a','dependent']['startSlot'] >= result['a','special']['finishSlot']


def test_no_unqualified_substitution_for_specialist():
    with pytest.raises(ValueError,match='every required skill'):
        simulate_move(projects(),{'owner','helper-user'},{**MOVE,'taskId':'special'},START)


def test_single_specialist_without_transferable_work_gets_no_forced_move():
    p=projects();p['a']['tasks']=[t for t in p['a']['tasks'] if t['id']!='side']
    assert suggest_moves(p,{'owner','helper-user'},{'a'},START)['suggestions']==[]


def test_reassigned_shared_schedule_is_resource_exclusive():
    p=projects();p['a']['tasks'][0]['owner']='helper'
    result,_=joint_schedule(p,START);used={}
    for (pid,tid),row in result.items():
        task=next(t for t in p[pid]['tasks'] if t['id']==tid)
        member=next(m for m in p[pid]['members'] if m['id']==task['owner'])
        slots=used.setdefault(member['userId'],set())
        assert not slots.intersection(row['slots'])
        slots.update(row['slots'])


def test_shared_calendar_conflict_does_not_create_capacity():
    p=projects();p['b']['members'][0]['overrides']={'2026-10-26':0}
    result,_=joint_schedule(p,START)
    assert all(slot>=48 for row in result.values() for slot in row['slots'])


@pytest.mark.parametrize('change', ['locked','active','review','deferred','zero'])
def test_protected_work_cannot_move(change):
    p=projects();t=p['a']['tasks'][0]
    if change=='locked':t['locked']=True
    elif change=='zero':t['remaining']=0
    else:t['status']={'active':'In progress','review':'In review','deferred':'Deferred'}[change]
    with pytest.raises(ValueError):simulate_move(p,{'owner','helper-user'},MOVE,START)


def test_recipient_busy_in_other_project_is_not_treated_as_idle():
    p=projects();p['b']['members'].append(deepcopy(p['a']['members'][1]))
    p['b']['tasks'].append(Task(id='busy',title='Existing helper commitment',owner='helper',effort=80,remaining=80,rank=-1,due='2026-10-27',requiredSkills=['testing']).model_dump(mode='json'))
    with pytest.raises(ValueError,match='delays at least one task'):
        simulate_move(p,{'owner','helper-user'},MOVE,START)


@pytest.mark.parametrize('failure',['hidden','unclaimed','zero-capacity','blocker','timezone'])
def test_incomplete_evidence_fails_closed(failure):
    p=projects();covered={'owner','helper-user'}
    if failure=='hidden':covered.remove('helper-user')
    elif failure=='unclaimed':p['a']['members'][1]['userId']=None
    elif failure=='zero-capacity':p['a']['members'][1]['capacity']=0
    elif failure=='blocker':p['b']['tasks'][0]['blocker']='Needs decision'
    elif failure=='timezone':p['b']['timezone']='UTC'
    with pytest.raises(ValueError):simulate_move(p,covered,MOVE,START)


def setup_portfolio(client):
    first=workspace(client);owner=first['data']['members'][0]['userId']
    source=projects();source['a']['members'][0]['userId']=owner;source['b']['members'][0]['userId']=owner
    # Isolated test database: establish a real linked recipient and two memberships.
    with connect() as db:
        db.execute('INSERT INTO users VALUES(?,?,?,?,?)',('helper-user','helper@example.com','Helper',None,'test'))
        db.execute('UPDATE projects SET data=? WHERE id=?',(json.dumps(source['a']),first['id']))
        db.execute('DELETE FROM memberships WHERE project_id=?',(first['id'],))
        db.execute('INSERT INTO memberships VALUES(?,?,?,NULL)',(first['id'],'lead',owner))
        db.execute('INSERT INTO memberships VALUES(?,?,?,NULL)',(first['id'],'helper','helper-user'))
    second=main.create_project_record({'id':owner},source['b'])
    return first['id'],second,owner


def preview(client,pid):
    response=client.post('/workload/redistribution/preview',json={**MOVE,'projectId':pid})
    assert response.status_code==200,response.text
    return response.json()


def approval(p):
    return {**p['proposal'],'token':p['token'],'expiresAt':p['expiresAt'],'reason':'Protect specialist time without delaying either project.'}


def test_preview_approval_persistence_audit_and_replay(client):
    pid,other,_=setup_portfolio(client)
    before=client.get('/projects/'+pid).json();p=preview(client,pid)
    assert client.get('/projects/'+pid).json()['version']==before['version']
    response=client.post('/workload/redistribution/approve',json=approval(p))
    assert response.status_code==200,response.text
    after=client.get('/projects/'+pid).json()
    assert next(t for t in after['data']['tasks'] if t['id']=='side')['owner']=='helper'
    assert next(t for t in after['data']['tasks'] if t['id']=='special')['owner']=='lead'
    assert after['activity'][0]['meta']['kind']=='portfolio-reassignment'
    assert after['activity'][0]['meta']['sourceVersion']==before['version']
    assert other not in json.dumps(after['activity'][0]['meta'])
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==409


def test_any_project_change_invalidates_preview(client):
    pid,other,_=setup_portfolio(client);p=preview(client,pid)
    other_project=client.get('/projects/'+other).json()
    assert cmd(client,other_project,'project.update',{'name':'Changed elsewhere'}).status_code==200
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==409
    assert next(t for t in client.get('/projects/'+pid).json()['data']['tasks'] if t['id']=='side')['owner']=='lead'


def test_forged_expired_and_reasonless_approvals(client,monkeypatch):
    import redistribution_routes
    pid,_,_=setup_portfolio(client);p=preview(client,pid);body=approval(p)
    assert client.post('/workload/redistribution/approve',json={**body,'token':'0'*64}).status_code==409
    assert client.post('/workload/redistribution/approve',json={**body,'reason':' '}).status_code==422
    assert client.post('/workload/redistribution/approve',json={**body,'memberId':'lead'}).status_code==409
    monkeypatch.setattr(redistribution_routes.time,'time',lambda:p['expiresAt']+1)
    assert client.post('/workload/redistribution/approve',json=body).status_code==409


def test_hidden_commitment_prevents_preview_without_disclosing_project(client):
    pid,_,owner=setup_portfolio(client)
    hidden=projects()['b'];hidden['name']='Private confidential project';hidden['members'][0]['userId']='helper-user'
    private_id=main.create_project_record({'id':'helper-user'},hidden)
    response=client.post('/workload/redistribution/preview',json={**MOVE,'projectId':pid})
    assert response.status_code==422
    assert private_id not in response.text and hidden['name'] not in response.text


def test_member_and_anonymous_cannot_approve(client):
    pid,_,_=setup_portfolio(client);p=preview(client,pid)
    client.cookies.set(main.COOKIE,create_session('helper-user'))
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==403
    assert client.post('/workload/redistribution/preview',json=p['proposal']).status_code==403
    client.post('/auth/logout')
    assert client.get('/workload/recommendations').status_code==401


def test_changed_membership_and_new_projects_invalidate_preview(client):
    pid,_,owner=setup_portfolio(client);p=preview(client,pid)
    new=projects()['b'];new['members'][0]['userId']=owner
    main.create_project_record({'id':owner},new)
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==409


def test_new_hidden_commitment_invalidates_existing_preview(client):
    pid,_,_=setup_portfolio(client);p=preview(client,pid)
    hidden=projects()['b'];hidden['members'][0]['userId']='helper-user'
    main.create_project_record({'id':'helper-user'},hidden)
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==409


def test_concurrent_approvals_only_commit_once(client):
    from concurrent.futures import ThreadPoolExecutor
    pid,_,_=setup_portfolio(client);p=preview(client,pid)
    before=client.get('/projects/'+pid).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(lambda _:client.post('/workload/redistribution/approve',json=approval(p)).status_code,range(2)))
    assert sorted(statuses)==[200,409]
    after=client.get('/projects/'+pid).json()
    assert after['version']==before['version']+1
    assert sum(e['meta'].get('kind')=='portfolio-reassignment' for e in after['activity'])==1


def test_role_revocation_prevents_approval(client):
    pid,_,_=setup_portfolio(client);p=preview(client,pid)
    current=client.get('/projects/'+pid).json()
    helper=deepcopy(current['data']['members'][1]);helper['role']='lead'
    current=cmd(client,current,'member.save',helper).json()
    owner=deepcopy(current['data']['members'][0]);owner['role']='member'
    assert cmd(client,current,'member.save',owner).status_code==200
    assert client.post('/workload/redistribution/approve',json=approval(p)).status_code==403
