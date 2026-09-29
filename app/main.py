from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response, status
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from . import auth
from .models import Account, AccountCreate, AccountUpdate, LoginRequest
from .store import AccountStore

from .auth import AdminUser, CurrentUser, require_admin

app = FastAPI(title="Banking API", version="0.1.0")

@app.post("/api/login", tags=["auth"])
def login(credentials: LoginRequest) -> dict[str, str]:
    user = next(
        (
            user
            for user in auth.users.values()
            if user.email.casefold() == credentials.email.casefold()
        ),
        None,
    )

    stored_hash = (
        auth.password_hashes.get(user.userId)
        if user is not None
        else None
    )

    if stored_hash is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not auth.password_hasher.verify(
        credentials.password,
        stored_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = token_urlsafe(32)

    auth.sessions[token] = (
        user.userId,
        datetime.now(timezone.utc) + timedelta(minutes=30),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }

def get_account_store() -> AccountStore:
    return account_store


account_store = AccountStore()
Store = Annotated[AccountStore, Depends(get_account_store)]


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"message": "Banking API is running"}


@app.get("/api/accounts", response_model=list[Account], tags=["accounts"])
def list_accounts(store: Store) -> list[Account]:
    return store.list()


@app.get("/api/accounts/{account_id}", response_model=Account, tags=["accounts"])
def get_account(account_id: int, store: Store) -> Account:
    account = store.get(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.post("/api/accounts", response_model=Account, status_code=status.HTTP_201_CREATED, tags=["accounts"])
def create_account(account_data: AccountCreate, store: Store) -> Account:
    return store.create(account_data)


@app.patch("/api/accounts/{account_id}", response_model=Account, tags=["accounts"])
def update_account(account_id: int, account_data: AccountUpdate, store: Store, current_user: CurrentUser,) -> Account:
    if "balance" in account_data.model_fields_set:
        require_admin(current_user)

        if account_data.balance is None:
            raise HTTPException(
                status_code=422,
                detail="Balance cannot be null",
            )
    account = store.update(account_id, account_data)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.delete("/api/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["accounts"])
def delete_account(account_id: int, store: Store, admin: AdminUser,) -> Response:
    if not store.delete(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
