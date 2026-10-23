"""Exercise real RSA validation and fresh Clerk identities without live test users."""
import time
from types import SimpleNamespace
import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
import clerk_identity as identity
import main
from store import connect, create_session
from test_platform import client

ISSUER = 'https://unit-test.clerk.accounts.dev'
ORIGIN = 'https://dsvv.live'

@pytest.fixture
def clerk(monkeypatch):
    monkeypatch.setenv('AUTH_MODE', 'clerk')
    monkeypatch.setenv('CLERK_ISSUER', ISSUER)
    monkeypatch.setenv('APP_ORIGINS', ORIGIN)
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(identity, 'signing_keys', lambda issuer: SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key())))
    def token(**changes):
        claims = dict(sub='user_fresh', sid='sess_unit', iss=ISSUER, azp=ORIGIN, iat=int(time.time()), exp=int(time.time())+60)
        claims.update(changes)
        return jwt.encode(claims, private, algorithm='RS256')
    monkeypatch.setattr(identity, 'verified_profile', lambda subject: (subject+'@example.invalid', subject))
    return token

@pytest.mark.parametrize('changes', [dict(exp=1), dict(iss='https://other.clerk.accounts.dev'), dict(azp='https://attacker.invalid'), dict(azp=None), dict(sts='pending'), dict(sub='unexpected')])
def test_reject_invalid_session_context(clerk, changes):
    with pytest.raises(HTTPException) as err:
        identity.verify_session(clerk(**changes))
    assert err.value.status_code == 401

def test_reject_forged_signature_and_missing_session(clerk):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    claims = dict(sub='user_fresh', sid='sess_unit', iss=ISSUER, azp=ORIGIN, iat=int(time.time()), exp=int(time.time())+60)
    with pytest.raises(HTTPException):
        identity.verify_session(jwt.encode(claims, key, algorithm='RS256'))
    with pytest.raises(HTTPException):
        identity.verify_session(clerk(sid=None))

def test_fresh_mapping_is_stable_and_isolated(client, clerk):
    headers = {'Authorization': 'Bearer '+clerk()}
    first = client.get('/auth/me', headers=headers)
    assert first.status_code == 200
    assert first.json()['provider'] == 'clerk'
    assert client.get('/auth/me', headers=headers).json()['id'] == first.json()['id']
    assert client.get('/projects', headers=headers).json() == []
    project = client.post('/projects', headers=headers, json={'name':'Clerk team','deadline':'2026-12-01'}).json()['id']
    assert client.get('/projects/'+project, headers=headers).status_code == 200
    other = client.get('/auth/me', headers={'Authorization':'Bearer '+clerk(sub='user_other')})
    assert other.json()['id'] != first.json()['id']
    assert client.get('/projects/'+project, headers={'Authorization':'Bearer '+clerk(sub='user_other')}).status_code == 404
    with connect() as db:
        assert db.execute('SELECT count(*) AS n FROM auth_identities').fetchone()['n'] == 2

def test_old_cookie_and_missing_token_are_rejected(client, clerk):
    with connect() as db:
        db.execute('INSERT INTO users VALUES(?,?,?,?,?)', ('legacy', 'legacy@example.invalid', 'Old', None, 'supabase'))
    client.cookies.set(main.COOKIE, create_session('legacy'))
    assert client.get('/auth/me').status_code == 401
    assert client.get('/projects').status_code == 401
    assert client.get('/auth/me', headers={'Authorization':'Bearer broken'}).status_code == 401

def test_matching_email_never_claims_existing_account(client, clerk):
    with connect() as db:
        db.execute('INSERT INTO users VALUES(?,?,?,?,?)', ('legacy', 'user_fresh@example.invalid', 'Old', None, 'supabase'))
    assert client.get('/auth/me', headers={'Authorization':'Bearer '+clerk()}).status_code == 409
    with connect() as db:
        assert db.execute('SELECT count(*) AS n FROM auth_identities').fetchone()['n'] == 0

def test_clerk_mode_cannot_create_legacy_sessions(client, clerk):
    body = {'name':'Example', 'email':'test@example.invalid', 'password':'long-enough-password'}
    for route in ['register', 'login', 'resend']:
        assert client.post('/auth/'+route, json=body).status_code == 403
    assert client.post('/auth/callback',json={'accessToken':'x'*30}).status_code == 403
    assert client.post('/auth/sandbox').status_code == 404
    assert client.get('/auth/providers').json()['provider'] == 'clerk'
    assert client.get('/health').json()['identity'] == 'clerk'

@pytest.mark.parametrize('primary,status,expected', [('email_main','verified',True), ('email_main','unverified',False), ('missing','verified',False)])
def test_verified_primary_email_required(monkeypatch, primary, status, expected):
    monkeypatch.setenv('CLERK_SECRET_KEY','unit-test-only')
    profile = {'id':'user_profile', 'primary_email_address_id':primary, 'first_name':'Team', 'last_name':'Lead', 'email_addresses':[{'id':'email_main', 'email_address':'Lead@example.invalid', 'verification':{'status':status}}]}
    monkeypatch.setattr(identity.httpx, 'get', lambda *a,**kw: httpx.Response(200, json=profile, request=httpx.Request('GET','https://api.clerk.com/v1/users/user_profile')))
    if expected:
        assert identity.verified_profile('user_profile') == ('lead@example.invalid', 'Team Lead')
    else:
        with pytest.raises(HTTPException) as err: identity.verified_profile('user_profile')
        assert err.value.status_code == 403
