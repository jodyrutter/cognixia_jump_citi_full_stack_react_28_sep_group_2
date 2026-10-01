import os
from datetime import datetime, timezone, timedelta
from secrets import token_urlsafe
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .models import User, Admin
from .mongo_store import MongoUserStore, get_user_store
from dataclasses import dataclass
from threading import RLock
import jwt
from jwt.exceptions import InvalidTokenError

JWT_SECRET = os.environ["BANK_JWT_SECRET"]
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(minutes=30)
IDLE_TIMEOUT = timedelta(minutes=30)

bearer_scheme = HTTPBearer(auto_error=False)

UserStorage = Annotated[MongoUserStore, Depends(get_user_store)]
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]

@dataclass
class LoginSession:
    user_id: int
    last_activity: datetime

sessions: dict[str, LoginSession] = {}
session_lock = RLock()

def authentication_error() -> HTTPException:
    return HTTPException(status_code=401, detail="Missing, invalid, or expired login", headers={"WWW-Authenticate": "Bearer"})

def encode_session_token(user: User, session_id: str) -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.user_id),
        "username": user.email,
        "role": "admin" if isinstance(user, Admin) else "user",
        "sid": session_id,
        "jti": token_urlsafe(32),
        "exp": now + TOKEN_LIFETIME,
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_credentials(credentials: BearerCredentials) -> dict:
    if credentials is None:
        raise authentication_error()

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM],
            options={
                "require": [
                    "sub",
                    "username",
                    "role",
                    "sid",
                    "jti",
                    "exp",
                ],
            },
        )

        if not isinstance(payload["sub"], str):
            raise authentication_error()

        int(payload["sub"])

        if not isinstance(payload["username"], str):
            raise authentication_error()

        if payload["role"] not in ("admin", "user"):
            raise authentication_error()

        if (not isinstance(payload["sid"], str) or not payload["sid"]):
            raise authentication_error()

        if (not isinstance(payload["jti"], str) or not payload["jti"]):
            raise authentication_error()

        return payload

    except (InvalidTokenError, ValueError, TypeError):
        raise authentication_error() from None

def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    session_id = token_urlsafe(32)

    with session_lock:
        expired_ids = [key for key, session in sessions.items() if now - session.last_activity >= IDLE_TIMEOUT]

        for key in expired_ids:
            sessions.pop(key, None)

        sessions[session_id] = LoginSession(user_id=user.user_id, last_activity=now)

    return encode_session_token(user, session_id)

def get_current_user(user_store: UserStorage, credentials: BearerCredentials,) -> User:
    payload = decode_credentials(credentials)

    user_id = int(payload["sub"])
    session_id = payload["sid"]

    user = user_store.get(user_id)

    if user is None:
        with session_lock:
            sessions.pop(session_id, None)

        raise authentication_error()

    with session_lock:
        now = datetime.now(timezone.utc)
        session = sessions.get(session_id)

        if session is None or session.user_id != user_id:
            raise authentication_error()

        if now - session.last_activity >= IDLE_TIMEOUT:
            sessions.pop(session_id, None)
            raise authentication_error()

        session.last_activity = now

    return user

CurrentUser = Annotated[User, Depends(get_current_user)]

def renew_access_token(current_user: CurrentUser, credentials: BearerCredentials) -> str:
    payload = decode_credentials(credentials)
    session_id = payload["sid"]

    with session_lock:
        session = sessions.get(session_id)

        if (session is None or session.user_id != current_user.user_id):
            raise authentication_error()

        return encode_session_token(current_user, session_id)

def logout_session(credentials: BearerCredentials) -> None:
    payload = decode_credentials(credentials)

    with session_lock:
        sessions.pop(payload["sid"], None)


def require_admin(current_user: CurrentUser) -> Admin:
    if not isinstance(current_user, Admin):
        raise HTTPException(status_code=403, detail="Administrator access required")

    return current_user


AdminUser = Annotated[Admin, Depends(require_admin)]