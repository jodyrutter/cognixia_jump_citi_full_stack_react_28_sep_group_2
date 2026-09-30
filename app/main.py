from typing import Annotated
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from fastapi import Depends, FastAPI, HTTPException, Header, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import auth
from .auth import AdminUser, CurrentUser, require_admin, logout_session
from .models import Account, AccountCreate, AccountOpenRequest, AccountUpdate, Me, MoneyRequest, LoginRequest, Admin, AdminCreate, Customer, CustomerCreate, CustomerUpdate
from .services.account_service import (
    AccountNotFoundError,
    AccountService,
    CustomerNotFoundError,
    InsufficientFundsError,
    InvalidAmountError,
)
from .mongo_store import MongoAccountStore, MongoUserStore, get_user_store, mongo_account_store, EmailAlreadyExistsError
from .services.user_service import UserService, CustomerHasAccountsError
from .services.user_service import CustomerNotFoundError as UserCustomerNotFoundError

UserStorage = Annotated[MongoUserStore, Depends(get_user_store)]

app = FastAPI(title="Banking API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/login", tags=["auth"])
def login(credentials: LoginRequest, user_store: UserStorage) -> dict[str, str]:
    user = user_store.authenticate(credentials.email, credentials.password)

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password", headers={"WWW-Authenticate": "Bearer"})

    token = auth.create_access_token(user)

    return {"access_token": token, "token_type": "bearer"}

def get_account_store() -> MongoAccountStore:
    return account_store


account_store = mongo_account_store


def get_account_service(
    store: Annotated[MongoAccountStore, Depends(get_account_store)],
    user_store: UserStorage,
) -> AccountService:
    return AccountService(store, user_store)


Service = Annotated[AccountService, Depends(get_account_service)]


def get_user_service(
    user_store: UserStorage,
    store: Annotated[MongoAccountStore, Depends(get_account_store)],
) -> UserService:
    return UserService(user_store, store)


Users = Annotated[UserService, Depends(get_user_service)]

@app.post("/api/logout",status_code=status.HTTP_204_NO_CONTENT,tags=["auth"],dependencies=[Depends(logout_session)])
def logout() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/signup", response_model=Customer, status_code=status.HTTP_201_CREATED, tags=["auth"])
def signup(user_data: CustomerCreate, service: Users) -> Customer:
    return service.create_customer(user_data)


@app.get("/api/me", response_model=Me, tags=["auth"])
def get_me(current_user: CurrentUser) -> Me:
    return Me(
        user_id=current_user.user_id,
        name=current_user.name,
        email=current_user.email,
        address=current_user.address,
        role="admin" if isinstance(current_user, Admin) else "customer",
    )


@app.patch("/api/me", response_model=Customer, tags=["auth"])
def update_me(user_data: CustomerUpdate, service: Users, current_user: CurrentUser) -> Customer:
    if not isinstance(current_user, Customer):
        raise HTTPException(
            status_code=403,
            detail="Only customers can update their own profile here",
        )
    return service.update_customer(current_user.user_id, user_data)


@app.get("/api/me/accounts", response_model=list[Account], tags=["accounts"])
def list_my_accounts(service: Service, current_user: CurrentUser) -> list[Account]:
    if not isinstance(current_user, Customer):
        raise HTTPException(
            status_code=403,
            detail="Only customers have accounts",
        )
    return service.list_customer_accounts(current_user.user_id)


@app.exception_handler(UserCustomerNotFoundError)
@app.exception_handler(CustomerNotFoundError)
async def customer_not_found_handler(_request: Request, _exception: CustomerNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Customer not found"})


@app.exception_handler(CustomerHasAccountsError)
async def customer_has_accounts_handler(_request: Request, _exception: CustomerHasAccountsError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": "Customer still owns accounts"})


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
def update_customer(customer_id: int, user_data: CustomerUpdate, service: Users, current_user:CurrentUser) -> Customer:
    is_owner = current_user.user_id == customer_id
    is_admin = isinstance(current_user, Admin)

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own profile",
        )
    return service.update_customer(customer_id, user_data)


@app.delete("/api/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
def delete_customer(customer_id: int, _admin: AdminUser, service: Users) -> Response:
    service.delete_customer(customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/customers/{customer_id}/accounts", response_model=list[Account], tags=["users"])
def list_customer_accounts(customer_id: int, service: Service, current_user: CurrentUser) -> list[Account]:
    is_owner = current_user.user_id == customer_id
    is_admin = isinstance(current_user, Admin)

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own accounts",
        )
    return service.list_customer_accounts(customer_id)


@app.get("/api/admins", response_model=list[Admin], tags=["users"])
def list_admins(service: Users) -> list[Admin]:
    return service.list_admins()


@app.post("/api/admins", response_model=Admin, status_code=status.HTTP_201_CREATED, tags=["users"])
def create_admin(user_data: AdminCreate, service: Users, admin: AdminUser) -> Admin:
    return service.create_admin(user_data)



@app.exception_handler(AccountNotFoundError)
async def account_not_found_handler(_request: Request, _exception: AccountNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "Account not found"})


@app.exception_handler(InvalidAmountError)
async def invalid_amount_handler(_request: Request, _exception: InvalidAmountError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Amount must be greater than zero"})


@app.exception_handler(InsufficientFundsError)
async def insufficient_funds_handler(_request: Request, _exception: InsufficientFundsError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": "Insufficient funds"})

@app.exception_handler(EmailAlreadyExistsError)
async def email_already_exists_handler(_request: Request, _exception: EmailAlreadyExistsError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": "An account with this email already exists"})


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
def create_account(account_data: AccountOpenRequest, service: Service, current_user: CurrentUser) -> Account:
    if not isinstance(current_user, Customer):
        raise HTTPException(
            status_code=403,
            detail="Only customers can open accounts for themselves",
        )
    return service.create_account(
        AccountCreate(owner_id=current_user.user_id, account_type=account_data.account_type)
    )


@app.patch("/api/accounts/{account_id}", response_model=Account, tags=["accounts"])
def update_account(
    account_id: int, account_data: AccountUpdate, service: Service, current_user: CurrentUser,
) -> Account:
    if "balance" in account_data.model_fields_set:
        require_admin(current_user)
        if account_data.balance is None:
            raise HTTPException(status_code=422, detail="Balance cannot be null")
    return service.update_account(account_id, account_data)


@app.delete("/api/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["accounts"])
def delete_account(account_id: int, service: Service, admin: AdminUser) -> Response:
    service.delete_account(account_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _authorize_transaction(account_id: int, current_user: CurrentUser, service: AccountService) -> None:
    if isinstance(current_user, Admin):
        return
    if not isinstance(current_user, Customer):
        raise HTTPException(status_code=403, detail="Authentication required")
    account = service.get_account(account_id)
    if account.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only manage your own account")


@app.post("/api/accounts/{account_id}/deposit", response_model=Account, tags=["transactions"])
def deposit(account_id: int, request: MoneyRequest, service: Service, current_user: CurrentUser) -> Account:
    _authorize_transaction(account_id, current_user, service)
    return service.deposit(account_id, request.amount)


@app.post("/api/accounts/{account_id}/withdraw", response_model=Account, tags=["transactions"])
def withdraw(account_id: int, request: MoneyRequest, service: Service, current_user: CurrentUser) -> Account:
    _authorize_transaction(account_id, current_user, service)
    return service.withdraw(account_id, request.amount)
