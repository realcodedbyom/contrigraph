import pytest
from copy import deepcopy
from datetime import date
from fastapi.testclient import TestClient
import main
from seed import starter
from engine import schedule, validate, apply_scenario, analyze

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('CONTRIGRAPH_DB',str(tmp_path/'test.db'))
    monkeypatch.delenv('DATABASE_URL',raising=False)
    monkeypatch.setenv('ENABLE_SANDBOX','true')
    monkeypatch.delenv('SUPABASE_URL',raising=False)
    monkeypatch.delenv('SUPABASE_PUBLISHABLE_KEY',raising=False)
    main.attempts.clear()
    with TestClient(main.app) as c:
        yield c

def workspace(client):
    assert client.post('/auth/sandbox').status_code==200
    pid=client.get('/projects').json()[0]['id']
    return client.get('/projects/'+pid).json()

def cmd(client,p,kind,payload):
    return client.post('/projects/'+p['id']+'/commands',json={'version':p['version'],'type':kind,'payload':payload})

def sample():
    return starter({'id':'u','name':'Lead'})

def scenario(kind,**kw):
    return {'version':1,'kind':kind,'taskId':'CG-03','memberId':'interface','value':'','reason':'Testing recovery',**kw}

def test_specialist_cannot_be_reassigned():
    with pytest.raises(ValueError,match='every required skill'):
        apply_scenario(sample(),scenario('reassign'))

def test_offloading_preserves_specialist_and_improves_schedule():
    p=sample()
    changed,_=apply_scenario(p,scenario('reassign',taskId='CG-02'))
    assert next(t for t in changed['tasks'] if t['id']=='CG-03')['owner']=='lead'
    before=schedule(p,date(2026,10,26));after=schedule(changed,date(2026,10,26))
    assert after['date']<before['date']

def test_zero_skill_unknown_and_propagates():
    p=sample();p['members'][0]['skills'].remove('scheduling')
    f=schedule(p)
    assert f['date'] is None and f['delay'] is None
    assert {'CG-03','CG-04'}<=set(f['unscheduled'])

def test_zero_capacity_has_no_fake_date():
    p=sample();p['members'][0]['capacity']=0
    assert schedule(p)['date'] is None

def test_holidays_and_overrides():
    p=sample();p['tasks']=[p['tasks'][2]];p['tasks'][0]['remaining']=4
    p['holidays']=['2026-10-26'];p['members'][0]['overrides']={'2026-10-27':0}
    f=schedule(p,date(2026,10,24))
    assert f['date']=='2026-10-28'

def test_blocker_unknown_vs_conditional():
    p=sample();p['tasks'][2]['blocker']='Awaiting specs'
    assert schedule(p)['date'] is None
    p['tasks'][2]['blockedUntil']='2026-11-02'
    assert schedule(p)['conditional'] is True

def test_cycle_rejected():
    p=sample();p['tasks'][2]['dependencies']=['CG-04']
    with pytest.raises(ValueError,match='cycle'):validate(p)

def test_defer_descendants_not_done():
    p,affected=apply_scenario(sample(),scenario('defer'))
    assert affected==['CG-03','CG-04']
    assert schedule(p)['excluded']==affected
    assert analyze(p)['summary']['done']==1

def test_locked_task_cannot_move():
    p=sample();p['tasks'][1]['locked']=True
    with pytest.raises(ValueError,match='unlocked'):apply_scenario(p,scenario('reassign',taskId='CG-02'))

def test_priority_persists():
    p,_=apply_scenario(sample(),scenario('prioritize'))
    f=schedule(p,date(2026,10,26))
    assert f['tasks']['CG-03']['finishSlot']<f['tasks']['CG-02']['finishSlot']

def test_concurrency_and_atomic_cycle(client):
    p=workspace(client)
    t=deepcopy(p['data']['tasks'][2]);t['dependencies']=['CG-04']
    assert cmd(client,p,'task.save',t).status_code==422
    assert client.get('/projects/'+p['id']).json()['version']==p['version']
    assert cmd(client,p,'project.update',{'name':'Saved'}).status_code==200
    assert cmd(client,p,'project.update',{'name':'Lost update'}).status_code==409

def test_session_and_isolation(client):
    p=workspace(client)
    client.post('/auth/logout')
    assert client.get('/projects/'+p['id']).status_code==401
    client.post('/auth/sandbox')
    assert client.get('/projects/'+p['id']).status_code==404

def test_attachment_persists_and_checks_membership(client):
    p=workspace(client)
    r=client.post('/projects/'+p['id']+'/tasks/CG-03/files',data={'version':p['version']},files={'file':('evidence.txt',b'hello','text/plain')})
    assert r.status_code==200,r.text
    fid=next(t for t in r.json()['data']['tasks'] if t['id']=='CG-03')['files'][0]['id']
    assert client.get('/files/'+fid).content==b'hello'
    client.post('/auth/logout');client.post('/auth/sandbox')
    assert client.get('/files/'+fid).status_code==404

def test_invite_claim_and_member_permissions(client):
    p=workspace(client)
    code=client.post('/projects/'+p['id']+'/invites',json={'version':p['version'],'memberId':'interface'}).json()['code']
    client.post('/auth/logout')
    assert client.post('/auth/register',json={'name':'Teammate','email':'person@example.com','password':'long-test-password'}).status_code==200
    assert client.post('/join',json={'code':code}).status_code==200
    assert client.post('/join',json={'code':code}).status_code==404
    p=client.get('/projects/'+p['id']).json()
    assert cmd(client,p,'project.update',{'name':'Hacked'}).status_code==403
    assert cmd(client,p,'task.status',{'taskId':'CG-03','status':'In progress'}).status_code==403
    assert cmd(client,p,'task.status',{'taskId':'CG-07','status':'In progress'}).status_code==200

def test_approval_requires_review_and_independence(client):
    p=workspace(client)
    assert cmd(client,p,'task.approve',{'taskId':'CG-03'}).status_code==422
    p=cmd(client,p,'task.status',{'taskId':'CG-03','status':'In review'}).json()
    assert cmd(client,p,'task.approve',{'taskId':'CG-03'}).status_code==403

def test_prerequisite_blocks_progress(client):
    p=workspace(client)
    assert cmd(client,p,'task.status',{'taskId':'CG-04','status':'In progress'}).status_code==422

def test_single_member_acceptance_is_labelled(client):
    workspace(client)
    pid=client.post('/projects',json={'name':'Solo','deadline':'2026-12-01'}).json()['id']
    p=client.get('/projects/'+pid).json()
    t=sample()['tasks'][2];t['owner']='lead'
    p=cmd(client,p,'task.save',t).json()
    p=cmd(client,p,'task.status',{'taskId':t['id'],'status':'In review'}).json()
    p=cmd(client,p,'task.approve',{'taskId':t['id']}).json()
    assert p['data']['tasks'][0]['acceptance']=='Self-attested: single-member project'
    assert p['analysis']['contributions'][0]['reviews']==0

def test_origin_and_last_lead_protection(client):
    p=workspace(client)
    assert client.post('/auth/logout',headers={'Origin':'https://evil.invalid'}).status_code==403
    member=p['data']['members'][0];member['role']='member'
    assert cmd(client,p,'member.save',member).status_code==422

def test_half_hour_capacity_is_preserved():
    from datetime import timedelta
    from engine import daily_hours
    p=sample();m=p['members'][0];m['capacity']=20.5
    assert sum(daily_hours(p,m,date(2026,10,26)+timedelta(days=i)) for i in range(7))==20.5

def test_blocker_reporting_and_clearing(client):
    p=workspace(client)
    p=cmd(client,p,'task.blocker',{'taskId':'CG-03','blocker':'Waiting for requirements','blockedUntil':None}).json()
    assert p['analysis']['forecast']['date'] is None
    p=cmd(client,p,'task.blocker',{'taskId':'CG-03','blocker':'','blockedUntil':None}).json()
    assert p['analysis']['forecast']['date'] is not None
    assert p['activity'][0]['kind']=='unblocked'

def test_independent_approval_records_review(client):
    p=workspace(client)
    code=client.post('/projects/'+p['id']+'/invites',json={'version':p['version'],'memberId':'interface'}).json()['code']
    lead_cookie=client.cookies.get(main.COOKIE)
    client.post('/auth/logout')
    client.post('/auth/register',json={'name':'Interface','email':'interface@example.com','password':'long-test-password'})
    client.post('/join',json={'code':code})
    p=client.get('/projects/'+p['id']).json()
    p=cmd(client,p,'task.status',{'taskId':'CG-07','status':'In review','remaining':0}).json()
    # Obtain a fresh lead session through the stored sandbox identity, without reusing a logged-out token.
    from store import create_session
    lead_uid=p['data']['members'][0]['userId']
    client.cookies.set(main.COOKIE,create_session(lead_uid))
    p=cmd(client,p,'task.approve',{'taskId':'CG-07'}).json()
    assert p['analysis']['contributions'][0]['reviews']==1
    assert next(t for t in p['data']['tasks'] if t['id']=='CG-07')['acceptance']=='Independent review'

def test_cloud_confirmation_contract(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    async def fake(path,payload):return {'user':{'id':'pending'}}
    monkeypatch.setattr(main,'supabase_auth',fake)
    r=client.post('/auth/register',json={'name':'Cloud User','email':'cloud@example.com','password':'long-test-password'})
    assert r.json()['confirmationRequired'] is True
    assert client.get('/auth/me').status_code==401

def test_cloud_login_creates_server_session(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    async def fake(path,payload):return {'access_token':'test-only','user':{'id':'cloud-id','user_metadata':{'name':'Cloud User'}}}
    monkeypatch.setattr(main,'supabase_auth',fake)
    r=client.post('/auth/login',json={'email':'cloud@example.com','password':'long-test-password'})
    assert r.status_code==200
    assert 'HttpOnly' in r.headers['set-cookie']
    assert client.get('/auth/me').json()['provider']=='supabase'

def test_recovery_requires_recorded_reason(client):
    p=workspace(client)
    assert cmd(client,p,'scenario.apply',scenario('prioritize',reason='')).status_code==422
    preview=client.post('/projects/'+p['id']+'/simulate',json=scenario('prioritize')).json()
    assert preview['version']==p['version']
    assert client.get('/projects/'+p['id']).json()['version']==p['version']

def test_oversized_attachment_rejected(client):
    p=workspace(client)
    r=client.post('/projects/'+p['id']+'/tasks/CG-03/files',data={'version':p['version']},files={'file':('big.txt',b'x'*(5*1024*1024+1),'text/plain')})
    assert r.status_code==413

def test_resources_never_overlap_and_dependencies_release_after_finish():
    p=sample();f=schedule(p,date(2026,10,26))
    for task in p['tasks']:
        row=f['tasks'][task['id']]
        for dep in task['dependencies']:
            if row['allocations']:
                assert row['start']>=f['tasks'][dep]['finish']
    for m in p['members']:
        daily={}
        for task in p['tasks']:
            if task['owner']==m['id']:
                for allocation in f['tasks'][task['id']]['allocations']:
                    day=allocation['date'];daily[day]=daily.get(day,0)+allocation['hours']
        assert all(hours<=4 for hours in daily.values())

def test_confirmation_callback_verifies_upstream_identity(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    seen=[]
    async def verified(token):
        seen.append(token)
        return {'id':'verified-callback','email':'verified@example.com','user_metadata':{'name':'Confirmed teammate'}}
    monkeypatch.setattr(main,'verified_identity',verified)
    r=client.post('/auth/callback',json={'accessToken':'a-test-token-long-enough'})
    assert r.status_code==200
    assert seen==['a-test-token-long-enough']
    assert client.get('/auth/me').json()['id']=='verified-callback'

def test_confirmation_failure_does_not_create_session(client,monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    async def rejected(token):raise HTTPException(401,'Expired confirmation')
    monkeypatch.setattr(main,'verified_identity',rejected)
    assert client.post('/auth/callback',json={'accessToken':'an-expired-token-long-enough'}).status_code==401
    assert client.get('/auth/me').status_code==401

def test_resend_verification_uses_signup_flow(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    calls=[]
    async def fake(path,payload):calls.append((path,payload));return {}
    monkeypatch.setattr(main,'supabase_auth',fake)
    r=client.post('/auth/resend',json={'email':'Person@Example.com'})
    assert r.status_code==200
    assert calls==[('resend',{'type':'signup','email':'person@example.com'})]
    assert client.get('/auth/me').status_code==401

def test_resend_rejects_invalid_email(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    assert client.post('/auth/resend',json={'email':'invalid'}).status_code==422


@pytest.mark.parametrize('task_id,status', [('CG-04', 'In progress'), ('CG-03', 'In review'), ('CG-02', 'Done')])
def test_task_save_cannot_bypass_workflow(client, task_id, status):
    p = workspace(client)
    task = deepcopy(next(t for t in p['data']['tasks'] if t['id'] == task_id))
    task['status'] = status
    assert cmd(client, p, 'task.save', task).status_code == 422
    after = client.get('/projects/' + p['id']).json()
    assert after['version'] == p['version']
    assert after['activity'] == p['activity']


def test_new_task_must_start_in_todo(client):
    p = workspace(client)
    task = deepcopy(p['data']['tasks'][2])
    task.update(id='NEW-TASK', status='In progress')
    assert cmd(client, p, 'task.save', task).status_code == 422


def test_submitted_deliverable_cannot_change_without_resubmission(client):
    p = workspace(client)
    p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In review'}).json()
    task = deepcopy(next(t for t in p['data']['tasks'] if t['id'] == 'CG-07'))
    task['description'] = 'Different deliverable'
    assert cmd(client, p, 'task.save', task).status_code == 422
    # The lead submitted on another member's behalf, so cannot also be its independent reviewer.
    assert cmd(client, p, 'task.approve', {'taskId': 'CG-07'}).status_code == 403
    p = cmd(client, p, 'task.status', {'taskId': 'CG-07', 'status': 'In progress'}).json()
    task['status'] = 'In progress'
    assert cmd(client, p, 'task.save', task).status_code == 200


def test_milestone_rename_preserves_task_grouping(client):
    p = workspace(client)
    milestone = deepcopy(p['data']['milestones'][1])
    previous = milestone['name']
    milestone['name'] = 'Functional release'
    result = cmd(client, p, 'milestone.save', milestone)
    assert result.status_code == 200
    after = client.get('/projects/' + p['id']).json()
    linked = {t['id'] for t in p['data']['tasks'] if t['milestone'] == previous}
    assert linked
    assert all(t['milestone'] == milestone['name'] for t in after['data']['tasks'] if t['id'] in linked)

def test_auth_throttle_returns_retry_after(client):
    for _ in range(5):
        assert client.post('/auth/login',json={'email':'nobody@example.com','password':'wrong-password'}).status_code == 401
    result=client.post('/auth/login',json={'email':'nobody@example.com','password':'wrong-password'})
    assert result.status_code == 429
    assert result.headers['retry-after'] == '60'


def test_auth_body_limit_catches_chunked_request(client):
    result=client.post('/auth/login',content=iter([b'x'*9000,b'x'*9000]),headers={'Content-Type':'application/json'})
    assert result.status_code == 413
    assert result.json()['detail'] == 'Request too large.'


def test_origin_rejection_is_json(client):
    result=client.post('/auth/login',json={'email':'nobody@example.com','password':'wrong-password'},headers={'Origin':'https://untrusted.example'})
    assert result.status_code == 403
    assert result.json()['detail'] == 'Untrusted request origin.'


def test_confirmation_quota_error_and_redirect_contract(client,monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://identity.example')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test-key')
    monkeypatch.setenv('AUTH_REDIRECT_URL','https://dsvv.live/contrigraph/')
    captured={}
    class FakeClient:
        def __init__(self,**kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,url,**kwargs):
            captured.update(kwargs)
            return main.httpx.Response(429,json={'code':'over_email_send_rate_limit','msg':'email rate limit exceeded'})
    monkeypatch.setattr(main.httpx,'AsyncClient',FakeClient)
    result=client.post('/auth/register',json={'email':'new@example.com','password':'safe-password','name':'New member'})
    assert result.status_code == 503
    assert 'Confirmation email delivery' in result.json()['detail']
    assert captured['params'] == {'redirect_to':'https://dsvv.live/contrigraph/'}
    assert 'email_redirect_to' not in captured['json']
