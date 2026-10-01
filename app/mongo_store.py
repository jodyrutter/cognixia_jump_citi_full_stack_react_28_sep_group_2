from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
import os
from typing import Any, cast
import secrets

from bson.decimal128 import Decimal128
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash

from .models import (
    Account,
    AccountCreate,
    AccountUpdate,
    Admin,
    AdminCreate,
    Customer,
    CustomerCreate,
    CustomerUpdate,
    Transaction,
    User,
)

_client: MongoClient[dict[str, Any]] | None = None
_database: Database[dict[str, Any]] | None = None


def get_database() -> Database[dict[str, Any]]:
    global _client, _database
    if _database is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        database_name = os.getenv("MONGODB_DATABASE", "banking")
        _client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        _database = _client[database_name]
    return _database


def _user_from_document(document: dict[str, Any]) -> User:
    user_data = {
        "user_id": document["user_id"],
        "name": document["name"],
        "email": document["email"],
        "address": document["address"],
    }
    return Admin(**user_data) if document.get("admin", False) else Customer(**user_data)


def _account_from_document(document: dict[str, Any]) -> Account:
    return Account(
        id=document["id"],
        account_number=document["account_number"],
        owner_id=document["owner_id"],
        account_type=document["account_type"],
        balance=Decimal(str(document["balance"].to_decimal())),
    )


def _transaction_from_document(document: dict[str, Any]) -> Transaction:
    created_at = document["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return Transaction(
        id=document["id"],
        account_id=document["account_id"],
        account_number=document["account_number"],
        owner_id=document["owner_id"],
        type=document["type"],
        amount=Decimal(str(document["amount"].to_decimal())),
        balance_after=Decimal(str(document["balance_after"].to_decimal())),
        counterparty_account_number=document.get("counterparty_account_number"),
        counterparty_name=document.get("counterparty_name"),
        created_at=created_at,
    )

class EmailAlreadyExistsError(Exception):
    pass


class MongoAccountStore:
    def __init__(self, database: Database[dict[str, Any]] | None = None) -> None:
        database = database if database is not None else get_database()
        self._accounts: Collection[dict[str, Any]] = database["accounts"]
        self._counters: Collection[dict[str, Any]] = database["counters"]
        self._transactions: Collection[dict[str, Any]] = database["transactions"]
        self._initialized = False

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        self._transactions.create_index([("owner_id", ASCENDING), ("id", DESCENDING)])
        self._accounts.create_index([("account_number", ASCENDING)], unique=True)
        self._accounts.create_index([("id", ASCENDING)], unique=True)
        self._accounts.create_index([("owner_id", ASCENDING), ("id", ASCENDING)])
        seeds = [
            {
                "id": 1,
                "account_number": "10000001",
                "owner_id": 1,
                "account_type": "checking",
                "balance": Decimal128("1250.00"),
            },
            {
                "id": 2,
                "account_number": "10000002",
                "owner_id": 2,
                "account_type": "savings",
                "balance": Decimal128("4800.50"),
            },
        ]
        for seed in seeds:
            self._accounts.update_one({"id": seed["id"]}, {"$setOnInsert": seed}, upsert=True)
        maximum = self._accounts.find_one(sort=[("id", -1)])
        self._counters.update_one(
            {"_id": "accounts"},
            {"$max": {"value": maximum["id"] if maximum else 0}},
            upsert=True,
        )
        self._initialized = True

    def list_accounts(self) -> list[Account]:
        self._ensure_initialized()
        return [_account_from_document(document) for document in self._accounts.find().sort("id", ASCENDING)]

    def list_for_owner(self, owner_id: int) -> list[Account]:
        self._ensure_initialized()
        return [
            _account_from_document(document)
            for document in self._accounts.find({"owner_id": owner_id}).sort("id", ASCENDING)
        ]

    def get(self, account_id: int) -> Account | None:
        self._ensure_initialized()
        document = self._accounts.find_one({"id": account_id})
        return _account_from_document(document) if document else None

    def get_by_account_number(self, account_number: str) -> Account | None:
        self._ensure_initialized()
        document = self._accounts.find_one({"account_number": account_number})
        return _account_from_document(document) if document else None

    def create(self, account_data: AccountCreate) -> Account:
        self._ensure_initialized()
        counter = self._counters.find_one_and_update(
            {"_id": "accounts"},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if counter is None:
            raise RuntimeError("Failed to allocate an account ID")
        counter = cast(dict[str, Any], counter)

        for _attempt in range(10):
            account_number = str(secrets.randbelow(900_000_000_000) + 100_000_000_000)
            if self._accounts.find_one({"account_number": account_number}) is not None:
                continue
            document = {
                "id": counter["value"],
                **account_data.model_dump(),
                "account_number": account_number,
                "balance": Decimal128("0.00"),
            }
            try:
                self._accounts.insert_one(document)
            except DuplicateKeyError:
                continue
            return _account_from_document(document)
        raise RuntimeError("Failed to generate a unique account number")

    def update(self, account_id: int, account_data: AccountUpdate) -> Account | None:
        self._ensure_initialized()
        updates = account_data.model_dump(exclude_unset=True)
        if "balance" in updates and updates["balance"] is not None:
            updates["balance"] = Decimal128(str(updates["balance"]))
        result = self._accounts.find_one_and_update(
            {"id": account_id}, {"$set": updates}, return_document=ReturnDocument.AFTER
        )
        return _account_from_document(result) if result else None
    

    def save(self, account: Account) -> Account:
        self._ensure_initialized()
        document = {
            "id": account.id,
            "account_number": account.account_number,
            "owner_id": account.owner_id,
            "account_type": account.account_type,
            "balance": Decimal128(str(account.balance)),
        }
        self._accounts.replace_one({"id": account.id}, document, upsert=True)
        return deepcopy(account)

    def delete(self, account_id: int) -> bool:
        self._ensure_initialized()
        return self._accounts.delete_one({"id": account_id}).deleted_count == 1

    def deposit(self, account_id: int, amount: Decimal) -> Account | None:
        self._ensure_initialized()
        document = self._accounts.find_one_and_update({"id": account_id},{"$inc": {"balance": Decimal128(str(amount))}},return_document=ReturnDocument.AFTER)
        if document is None:
            return None
        account = _account_from_document(document)
        self._record_transaction(account, "deposit", amount)
        return account

    def withdraw(self, account_id: int, amount: Decimal) -> Account | None:
        self._ensure_initialized()
        document = self._accounts.find_one_and_update({"id": account_id, "balance": {"$gte": Decimal128(str(amount))}},
                                                      {"$inc": {"balance": Decimal128(str(-amount))}},return_document=ReturnDocument.AFTER)
        if document is None:
            return None
        account = _account_from_document(document)
        self._record_transaction(account, "withdraw", amount)
        return account

    def transfer(
        self, from_account_id: int, to_account_id: int, amount: Decimal,
        from_owner_name: str | None = None, to_owner_name: str | None = None,
    ) -> tuple[Account, Account] | None:
        self._ensure_initialized()
        withdrawn = self._accounts.find_one_and_update(
            {"id": from_account_id, "balance": {"$gte": Decimal128(str(amount))}},
            {"$inc": {"balance": Decimal128(str(-amount))}},
            return_document=ReturnDocument.AFTER,
        )
        if withdrawn is None:
            return None
        deposited = self._accounts.find_one_and_update(
            {"id": to_account_id},
            {"$inc": {"balance": Decimal128(str(amount))}},
            return_document=ReturnDocument.AFTER,
        )
        if deposited is None:
            # Destination vanished mid-transfer — restore the sender's balance.
            self._accounts.find_one_and_update(
                {"id": from_account_id}, {"$inc": {"balance": Decimal128(str(amount))}}
            )
            return None
        from_account = _account_from_document(withdrawn)
        to_account = _account_from_document(deposited)
        self._record_transaction(
            from_account, "transfer_out", amount,
            counterparty_account_number=to_account.account_number, counterparty_name=to_owner_name,
        )
        self._record_transaction(
            to_account, "transfer_in", amount,
            counterparty_account_number=from_account.account_number, counterparty_name=from_owner_name,
        )
        return from_account, to_account

    def _record_transaction(
        self,
        account: Account,
        transaction_type: str,
        amount: Decimal,
        *,
        counterparty_account_number: str | None = None,
        counterparty_name: str | None = None,
    ) -> None:
        counter = self._counters.find_one_and_update(
            {"_id": "transactions"},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if counter is None:
            raise RuntimeError("Failed to allocate a transaction ID")
        self._transactions.insert_one({
            "id": cast(dict[str, Any], counter)["value"],
            "account_id": account.id,
            "account_number": account.account_number,
            "owner_id": account.owner_id,
            "type": transaction_type,
            "amount": Decimal128(str(amount)),
            "balance_after": Decimal128(str(account.balance)),
            "counterparty_account_number": counterparty_account_number,
            "counterparty_name": counterparty_name,
            "created_at": datetime.now(timezone.utc),
        })

    def list_transactions(self) -> list[Transaction]:
        self._ensure_initialized()
        return [_transaction_from_document(document) for document in self._transactions.find().sort("id", DESCENDING)]

    def list_transactions_for_owner(self, owner_id: int) -> list[Transaction]:
        self._ensure_initialized()
        return [
            _transaction_from_document(document)
            for document in self._transactions.find({"owner_id": owner_id}).sort("id", DESCENDING)
        ]

class MongoUserStore:
    def __init__(self, database: Database[dict[str, Any]] | None = None) -> None:
        database = database if database is not None else get_database()
        self._users: Collection[dict[str, Any]] = database["users"]
        self._counters: Collection[dict[str, Any]] = database["counters"]
        self._password_hasher = PasswordHash.recommended()
        self._initialized = False

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        self._users.create_index([("normalized_email", ASCENDING)], unique=True)
        self._users.create_index([("user_id", ASCENDING)], unique=True)
        seeds = [
            {"user_id": 1, "name": "Aarav Sharma", "email": "aarav@example.com", "address": "Pune", "admin": False, "password_hash": self._password_hasher.hash("password")},
            {"user_id": 2, "name": "Maya Patel", "email": "maya@example.com", "address": "Mumbai", "admin": False, "password_hash": self._password_hasher.hash("123")},
            {"user_id": 3, "name": "System Admin", "email": "admin@example.com", "address": "Pune", "admin": True},
        ]
        for seed in seeds:
            seed["normalized_email"] = seed["email"].casefold()
            self._users.update_one({"user_id": seed["user_id"]}, {"$setOnInsert": seed}, upsert=True)
        admin_hash = os.getenv("BANK_ADMIN_PASSWORD_HASH")
        if admin_hash:
            self._users.update_one({"user_id": 3}, {"$set": {"password_hash": admin_hash}})
        maximum = self._users.find_one(sort=[("user_id", -1)])
        self._counters.update_one(
            {"_id": "users"},
            {"$max": {"value": maximum["user_id"] if maximum else 0}},
            upsert=True,
        )
        self._initialized = True

    def list_customers(self) -> list[Customer]:
        self._ensure_initialized()
        return [Customer(**_user_from_document(document).model_dump()) for document in self._users.find({"admin": False}).sort("user_id", ASCENDING)]

    def list_admins(self) -> list[Admin]:
        self._ensure_initialized()
        return [Admin(**_user_from_document(document).model_dump()) for document in self._users.find({"admin": True}).sort("user_id", ASCENDING)]

    def get(self, user_id: int) -> User | None:
        self._ensure_initialized()
        document = self._users.find_one({"user_id": user_id})
        return _user_from_document(document) if document else None

    def get_customer(self, user_id: int) -> Customer | None:
        self._ensure_initialized()
        document = self._users.find_one({"user_id": user_id, "admin": False})
        user = _user_from_document(document) if document else None
        return user if isinstance(user, Customer) else None

    def get_by_email(self, email: str) -> User | None:
        self._ensure_initialized()
        document = self._users.find_one({"normalized_email": email.strip().casefold()})
        return _user_from_document(document) if document else None

    def authenticate(self, email: str, password: str) -> User | None:
        self._ensure_initialized()
        normalized_email = email.strip().casefold()
        document = self._users.find_one({"normalized_email": normalized_email})
        if not document or not document.get("password_hash"):
            return None
        if not self._password_hasher.verify(password, document["password_hash"]):
            return None
        return _user_from_document(document)

    def _create_user(self, user_data: CustomerCreate | AdminCreate, admin: bool) -> User:
        self._ensure_initialized()
        counter = self._counters.find_one_and_update(
            {"_id": "users"},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if counter is None:
            raise RuntimeError("Failed to allocate a user ID")
        counter = cast(dict[str, Any], counter)
        user_id = counter["value"]
        document = {
            "user_id": user_id,
            **user_data.model_dump(exclude={"password"}),
            "normalized_email": user_data.email.strip().casefold(),
            "password_hash": self._password_hasher.hash(user_data.password),
            "admin": admin,
        }
        try:
            self._users.insert_one(document)
        except DuplicateKeyError as exc:
            raise EmailAlreadyExistsError from exc
        return _user_from_document(document)

    def create_customer(self, user_data: CustomerCreate) -> Customer:
        return self._create_user(user_data, admin=False)  # type: ignore[return-value]

    def create_admin(self, user_data: AdminCreate) -> Admin:
        return self._create_user(user_data, admin=True)  # type: ignore[return-value]

    def update_customer(self, user_id: int, user_data: CustomerUpdate) -> Customer | None:
        self._ensure_initialized()
        customer = self.get_customer(user_id)
        if customer is None:
            return None
        updates = user_data.model_dump(exclude_unset=True, exclude={"password"})

        # Ignore placeholder "string" values
        updates = {
            key: value
            for key, value in updates.items()
            if not (isinstance(value, str) and value.casefold() == "string")
        }

        if "email" in updates:
            email = updates["email"].strip()
            updates["email"] = email
            updates["normalized_email"] = email.casefold()

        if user_data.password is not None and user_data.password.casefold() != "string":
            updates["password_hash"] = self._password_hasher.hash(user_data.password)
        result = self._users.find_one_and_update(
            {"user_id": user_id, "admin": False}, {"$set": updates}, return_document=ReturnDocument.AFTER
        )
        return _user_from_document(result) if result else None  # type: ignore[return-value]

    def delete_customer(self, user_id: int) -> bool:
        self._ensure_initialized()
        return self._users.delete_one({"user_id": user_id, "admin": False}).deleted_count == 1


mongo_account_store = MongoAccountStore()
mongo_user_store = MongoUserStore()


def get_user_store() -> MongoUserStore:
    return mongo_user_store
