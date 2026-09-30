from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .models import User, Admin
from .mongo_store import MongoUserStore, get_user_store

bearer_scheme = HTTPBearer(auto_error=False)
sessions: dict[str, tuple[int, datetime]] = {}
UserStorage = Annotated[MongoUserStore, Depends(get_user_store)]

def logout_session(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]) -> None:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sessions.pop(credentials.credentials, None)

def get_current_user(
    user_store: UserStorage,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> User:
    authentication_error = HTTPException(
        status_code=401,
        detail="Missing, invalid, or expired login",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise authentication_error

    token = credentials.credentials
    session = sessions.get(token)

    if session is None:
        raise authentication_error

    user_id, expires_at = session

    if datetime.now(timezone.utc) >= expires_at:
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