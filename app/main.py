from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from .models import Account, AccountCreate, AccountUpdate, MoneyRequest
from .services.account_service import (
    AccountNotFoundError,
    AccountService,
    InsufficientFundsError,
    InvalidAmountError,
)
from .store import AccountStore

app = FastAPI(title="Banking API", version="0.1.0")


def get_account_store() -> AccountStore:
    return account_store


account_store = AccountStore()


def get_account_service() -> AccountService:
    return AccountService(account_store)


Service = Annotated[AccountService, Depends(get_account_service)]


@app.exception_handler(AccountNotFoundError)
async def account_not_found_handler(_request: Request, _exception: AccountNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Account not found"})


@app.exception_handler(InvalidAmountError)
async def invalid_amount_handler(_request: Request, _exception: InvalidAmountError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Amount must be greater than zero"})


@app.exception_handler(InsufficientFundsError)
async def insufficient_funds_handler(_request: Request, _exception: InsufficientFundsError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Insufficient funds"})


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"message": "Banking API is running"}


@app.get("/api/accounts", response_model=list[Account], tags=["accounts"])
def list_accounts(service: Service) -> list[Account]:
    return service.list_accounts()


@app.get("/api/accounts/{account_id}", response_model=Account, tags=["accounts"])
def get_account(account_id: int, service: Service) -> Account:
    return service.get_account(account_id)


@app.post("/api/accounts", response_model=Account, status_code=status.HTTP_201_CREATED, tags=["accounts"])
def create_account(account_data: AccountCreate, service: Service) -> Account:
    return service.create_account(account_data)


@app.patch("/api/accounts/{account_id}", response_model=Account, tags=["accounts"])
def update_account(account_id: int, account_data: AccountUpdate, service: Service) -> Account:
    return service.update_account(account_id, account_data)


@app.delete("/api/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["accounts"])
def delete_account(account_id: int, service: Service) -> Response:
    service.delete_account(account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/accounts/{account_id}/deposit", response_model=Account, tags=["transactions"])
def deposit(account_id: int, request: MoneyRequest, service: Service) -> Account:
    return service.deposit(account_id, request.amount)


@app.post("/api/accounts/{account_id}/withdraw", response_model=Account, tags=["transactions"])
def withdraw(account_id: int, request: MoneyRequest, service: Service) -> Account:
    return service.withdraw(account_id, request.amount)
