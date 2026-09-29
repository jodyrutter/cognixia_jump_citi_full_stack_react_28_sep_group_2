from typing import Annotated

from fastapi import Depends, FastAPI, Header, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import Admin, AdminCreate, Account, AccountCreate, AccountUpdate, Customer, CustomerCreate, CustomerUpdate, MoneyRequest
from .services.account_service import (
    AccountNotFoundError,
    AccountService,
    CustomerNotFoundError,
    InsufficientFundsError,
    InvalidAmountError,
)
from .services.user_service import UserService
from .services.user_service import (
    AdminRequiredError,
    AuthenticationRequiredError,
    CustomerHasAccountsError,
)
from .store import AccountStore
from .user_store import UserStore

app = FastAPI(title="Banking API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_account_store() -> AccountStore:
    return account_store


account_store = AccountStore()
user_store = UserStore()


def get_account_service() -> AccountService:
    return AccountService(account_store, user_store)


def get_user_service() -> UserService:
    return UserService(user_store, account_store)


def require_admin_user(
    user_id: Annotated[int | None, Header(alias="X-User-Id")] = None,
    service: UserService = Depends(get_user_service),
) -> Admin:
    return service.require_admin(user_id)


Service = Annotated[AccountService, Depends(get_account_service)]
Users = Annotated[UserService, Depends(get_user_service)]
AdminUser = Annotated[Admin, Depends(require_admin_user)]


@app.exception_handler(AccountNotFoundError)
async def account_not_found_handler(_request: Request, _exception: AccountNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Account not found"})


@app.exception_handler(CustomerNotFoundError)
async def customer_not_found_handler(_request: Request, _exception: CustomerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Customer not found"})


@app.exception_handler(CustomerHasAccountsError)
async def customer_has_accounts_handler(_request: Request, _exception: CustomerHasAccountsError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": "Customer still owns accounts"})


@app.exception_handler(AuthenticationRequiredError)
async def authentication_required_handler(_request: Request, _exception: AuthenticationRequiredError) -> JSONResponse:
    return JSONResponse(status_code=401, content={"detail": "Authentication required"})


@app.exception_handler(AdminRequiredError)
async def admin_required_handler(_request: Request, _exception: AdminRequiredError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": "Admin access required"})


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


@app.get("/api/customers/{customer_id}", response_model=Customer, tags=["users"])
def get_customer(customer_id: int, service: Users) -> Customer:
    return service.get_customer(customer_id)


@app.patch("/api/customers/{customer_id}", response_model=Customer, tags=["users"])
def update_customer(customer_id: int, user_data: CustomerUpdate, service: Users) -> Customer:
    return service.update_customer(customer_id, user_data)


@app.delete("/api/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
def delete_customer(customer_id: int, _admin: AdminUser, service: Users) -> Response:
    service.delete_customer(customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/customers/{customer_id}/accounts", response_model=list[Account], tags=["users"])
def list_customer_accounts(customer_id: int, service: Service) -> list[Account]:
    return service.list_customer_accounts(customer_id)


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
