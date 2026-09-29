from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .models import User, Admin
import os 
from pwdlib import PasswordHash

bearer_scheme = HTTPBearer(auto_error=False)
users: dict[int, User] = {}
sessions: dict[str, tuple[int, datetime]] = {}

password_hasher = PasswordHash.recommended()
password_hashes: dict[int, str] = {}

admin_hash = os.getenv("BANK_ADMIN_PASSWORD_HASH")

if admin_hash:
    users[1] = Admin(
        userId=1,
        name="Local Admin",
        email="admin@example.com",
        address="Local development",
    )
    password_hashes[1] = admin_hash

def get_current_user(
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

    user = users.get(user_id)

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