from copy import deepcopy
import os

from pwdlib import PasswordHash

from .models import Admin, AdminCreate, Customer, CustomerCreate, User


class UserStore:
    def __init__(self) -> None:
        self._users: dict[int, Customer | Admin] = {
            1: Customer(user_id=1, name="Aarav Sharma", email="aarav@example.com", address="Pune"),
            2: Customer(user_id=2, name="Maya Patel", email="maya@example.com", address="Mumbai"),
            3: Admin(user_id=3, name="System Admin", email="admin@example.com", address="Pune"),
        }
        self._password_hashes: dict[int, str] = {}
        self._next_id = 4
        self._password_hasher = PasswordHash.recommended()
        admin_hash = os.getenv("BANK_ADMIN_PASSWORD_HASH")
        if admin_hash:
            self._password_hashes[3] = admin_hash

    def list_customers(self) -> list[Customer]:
        return deepcopy([user for user in self._users.values() if isinstance(user, Customer)])

    def list_admins(self) -> list[Admin]:
        return deepcopy([user for user in self._users.values() if isinstance(user, Admin)])

    def get(self, user_id: int) -> User | None:
        return deepcopy(self._users.get(user_id))

    def get_customer(self, user_id: int) -> Customer | None:
        user = self._users.get(user_id)
        return deepcopy(user) if isinstance(user, Customer) else None

    def authenticate(self, email: str, password: str) -> User | None:
        email = email.strip().casefold()
        user = next((user for user in self._users.values() if user.email.strip().casefold() == email), None)
        password_hash = self._password_hashes.get(user.user_id) if user else None
        if password_hash is None or not self._password_hasher.verify(password, password_hash):
            return None
        return deepcopy(user)

    def create_customer(self, user_data: CustomerCreate) -> Customer:
        customer = Customer(user_id=self._next_id, **user_data.model_dump(exclude={"password"}))
        password_hash = self._password_hasher.hash(user_data.password)
        self._users[customer.user_id] = customer
        self._password_hashes[customer.user_id] = password_hash
        self._next_id += 1
        return deepcopy(customer)

    def create_admin(self, user_data: AdminCreate) -> Admin:
        admin = Admin(user_id=self._next_id, **user_data.model_dump(exclude={"password"}))
        password_hash = self._password_hasher.hash(user_data.password)
        self._users[admin.user_id] = admin
        self._password_hashes[admin.user_id] = password_hash
        self._next_id += 1
        return deepcopy(admin)


user_store = UserStore()


def get_user_store() -> UserStore:
    return user_store
