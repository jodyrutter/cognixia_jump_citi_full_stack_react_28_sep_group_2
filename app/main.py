from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response, status

from .models import Account, AccountCreate, AccountUpdate
from .store import AccountStore

app = FastAPI(title="Banking API", version="0.1.0")


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
def update_account(account_id: int, account_data: AccountUpdate, store: Store) -> Account:
    account = store.update(account_id, account_data)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.delete("/api/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["accounts"])
def delete_account(account_id: int, store: Store) -> Response:
    if not store.delete(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
