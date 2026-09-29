from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from .models import Admin, AdminCreate, Account, AccountCreate, AccountUpdate, Customer, CustomerCreate, MoneyRequest
from .services.account_service import (
    AccountNotFoundError,
    AccountService,
    CustomerNotFoundError,
    InsufficientFundsError,
    InvalidAmountError,
)
from .services.user_service import UserService
from .store import AccountStore
from .user_store import UserStore

app = FastAPI(title="Banking API", version="0.1.0")


def get_account_store() -> AccountStore:
    return account_store


account_store = AccountStore()
user_store = UserStore()


def get_account_service() -> AccountService:
    return AccountService(account_store, user_store)


def get_user_service() -> UserService:
    return UserService(user_store)


Service = Annotated[AccountService, Depends(get_account_service)]
Users = Annotated[UserService, Depends(get_user_service)]


@app.exception_handler(AccountNotFoundError)
async def account_not_found_handler(_request: Request, _exception: AccountNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Account not found"})


@app.exception_handler(CustomerNotFoundError)
async def customer_not_found_handler(_request: Request, _exception: CustomerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Customer not found"})


@app.exception_handler(InvalidAmountError)
async def invalid_amount_handler(_request: Request, _exception: InvalidAmountError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Amount must be greater than zero"})


@app.exception_handler(InsufficientFundsError)
async def insufficient_funds_handler(_request: Request, _exception: InsufficientFundsError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Insufficient funds"})


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"message": "Banking API is running"}


@app.get("/api/customers", response_model=list[Customer], tags=["users"])
def list_customers(service: Users) -> list[Customer]:
    return service.list_customers()


@app.post("/api/customers", response_model=Customer, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_customer(user_data: CustomerCreate, service: Users) -> Customer:
    return service.create_customer(user_data)


@app.get("/api/admins", response_model=list[Admin], tags=["users"])
def list_admins(service: Users) -> list[Admin]:
    return service.list_admins()


@app.post("/api/admins", response_model=Admin, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_admin(user_data: AdminCreate, service: Users) -> Admin:
    return service.create_admin(user_data)


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
