import os
from datetime import datetime, timezone, timedelta
from secrets import token_urlsafe
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .models import User, Admin
from .mongo_store import MongoUserStore, get_user_store
import jwt
from jwt.exceptions import InvalidTokenError

JWT_SECRET = os.environ["BANK_JWT_SECRET"]
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME = timedelta(minutes=30)

bearer_scheme = HTTPBearer(auto_error=False)
sessions: dict[str, tuple[int, datetime]] = {}
UserStorage = Annotated[MongoUserStore, Depends(get_user_store)]
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]

def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + TOKEN_LIFETIME
    payload = {"sub": str(user.user_id), "username": user.email, "role": "admin" if isinstance(user, Admin) else "user", "exp": expires_at, "jti": token_urlsafe(32)}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    sessions[token] = (user.user_id, expires_at)
    return token

def logout_session(credentials: BearerCredentials) -> None:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sessions.pop(credentials.credentials, None)

def get_current_user(user_store: UserStorage, credentials: BearerCredentials) -> User:
    authentication_error = HTTPException(status_code=401, detail="Missing, invalid, or expired login", headers={"WWW-Authenticate": "Bearer"})

    if credentials is None:
        raise authentication_error

    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM],
            options={
                "require": ["sub", "username", "role", "exp", "jti"],
            },
        )

        user_id = int(payload["sub"])

        if payload["role"] not in ("admin", "user"):
            raise authentication_error

        if not isinstance(payload["username"], str):
            raise authentication_error

    except (InvalidTokenError, ValueError, TypeError):
        raise authentication_error from None

    session = sessions.get(token)

    if session is None:
        raise authentication_error

    session_user_id, expires_at = session

    if datetime.now(timezone.utc) >= expires_at:
        sessions.pop(token, None)
        raise authentication_error
    
    if session_user_id != user_id:
        raise authentication_error
    
    user = user_store.get(user_id)

    if user is None:
        raise authentication_error

    return user

CurrentUser = Annotated[User, Depends(get_current_user)]

def require_admin(current_user: CurrentUser) -> Admin:
    if not isinstance(current_user, Admin):
        raise HTTPException(
            status_code=403,
            detail="Administrator access required",
        )

    return current_user


AdminUser = Annotated[Admin, Depends(require_admin)]