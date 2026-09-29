from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AccountType = Literal["checking", "savings"]

class User:
    def __init__(self, userId, name, email, address):
        self.userId = userId
        self.name = name
        self.email = email
        self.address = address
    def to_dict(self):
        return {
            "user_id": self.userId,
            "name": self.name,
            "email": self.email,
            "address" : self.address
        }

class Customer(User):
    def __init__(self, userId, name, accountNumber, balance):
        super().__init__(userId, name)
        self.accountNumber = accountNumber
        self.balance = balance
        self.admin = False

    def to_dict(self):
        response = super().to_dict()
        response["account_number"] = self.accountNumber
        response["balance"] = self.balance
        response["admin"] = self.admin

        return response
        
class Admin(User):
    def __init__(self, userId, name):
        super().__init__(userId, name)
        self.admin = True

    def to_dict(self):
        response =  super().to_dict()
        response["admin"] = self.admin

        return response

class CustomerCreate(BaseModel):
    name: str
    email: str
    password: str
    account_number: str
    balance: float = 0.0

class AccountBase(BaseModel):
    owner_name: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    balance: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)


class AccountCreate(AccountBase):
    account_number: str = Field(min_length=4, max_length=20)


class AccountUpdate(BaseModel):
    owner_name: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: AccountType | None = None
    balance: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class Account(AccountCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
