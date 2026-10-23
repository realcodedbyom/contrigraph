"""Clerk session validation and stable application identity mapping."""
import os
import secrets
from functools import lru_cache
import httpx
import jwt
from fastapi import HTTPException
from store import connect


@lru_cache(maxsize=4)
def signing_keys(issuer):
    return jwt.PyJWKClient(issuer + '/.well-known/jwks.json', lifespan=300, timeout=10)


def verify_session(token):
    issuer = os.environ.get('CLERK_ISSUER', '').rstrip('/')
    if not issuer.startswith('https://'):
        raise HTTPException(503, 'Sign-in configuration is unavailable.')
    try:
        key = signing_keys(issuer).get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=['RS256'], issuer=issuer, leeway=5,
                            options={'require': ['exp', 'iat', 'iss', 'sub', 'sid'], 'verify_aud': False})
        allowed = [p.strip() for p in os.environ.get('APP_ORIGINS', '').split(',') if p.strip()]
        if not allowed or claims.get('azp') not in allowed or claims.get('sts') == 'pending' or not isinstance(claims['sub'], str) or not claims['sub'].startswith('user_') or not isinstance(claims['sid'], str) or not claims['sid']:
            raise jwt.InvalidTokenError('Invalid session context')
        return claims
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, 'Sign-in verification is temporarily unavailable.')
    except jwt.PyJWTError:
        raise HTTPException(401, 'Your sign-in session expired. Please sign in again.')


def verified_profile(subject):
    secret = os.environ.get('CLERK_SECRET_KEY', '')
    if not secret:
        raise HTTPException(503, 'Sign-in configuration is unavailable.')
    try:
        response = httpx.get('https://api.clerk.com/v1/users/' + subject,
                             headers={'Authorization': 'Bearer ' + secret}, timeout=15)
        response.raise_for_status()
        profile = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, 'Could not retrieve your account. Please retry.')
    if profile.get('id') != subject:
        raise HTTPException(401, 'Account verification failed.')
    email = next((e for e in profile.get('email_addresses', []) if e.get('id') == profile.get('primary_email_address_id') and e.get('verification', {}).get('status') == 'verified'), None)
    if not email:
        raise HTTPException(403, 'A verified primary email is required.')
    return email['email_address'].strip().lower(), (' '.join(filter(None, [profile.get('first_name'), profile.get('last_name')])).strip() or email['email_address'].split('@')[0])[:100]


def clerk_user(request):
    header = request.headers.get('authorization', '')
    token = header[7:] if header.startswith('Bearer ') else request.cookies.get('__session', '')
    if not token:
        raise HTTPException(401, 'Sign in to continue.')
    claims = verify_session(token)
    subject = claims['sub']
    with connect() as db:
        row = db.execute('SELECT u.* FROM auth_identities a JOIN users u ON u.id=a.user_id WHERE a.provider=? AND a.subject=?', ('clerk', subject)).fetchone()
        if row:
            return {**{k: row[k] for k in ['id', 'email', 'name']}, 'provider': 'clerk'}
    email, name = verified_profile(subject)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        bound = db.execute('SELECT user_id FROM auth_identities WHERE provider=? AND subject=?', ('clerk', subject)).fetchone()
        if bound:
            user_id = bound['user_id']
        else:
            # Fresh deployment: never silently claim an older provider's account by email.
            if db.execute('SELECT id FROM users WHERE lower(email)=?', (email,)).fetchone():
                raise HTTPException(409, 'This email belongs to another account. Contact the project owner.')
            user_id = secrets.token_hex(16)
            db.execute('INSERT INTO users VALUES(?,?,?,?,?)', (user_id, email, name, None, 'clerk'))
            db.execute('INSERT INTO auth_identities(provider,subject,user_id) VALUES(?,?,?)', ('clerk', subject, user_id))
        row = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
        return {**{k: row[k] for k in ['id', 'email', 'name']}, 'provider': 'clerk'}
