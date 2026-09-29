from copy import deepcopy
from hashlib import pbkdf2_hmac
from os import urandom

from .models import Admin, AdminCreate, Customer, CustomerCreate, CustomerUpdate, User


class UserStore:
    def __init__(self) -> None:
        self._users: dict[int, Customer | Admin] = {
            1: Customer(user_id=1, name="Aarav Sharma", email="aarav@example.com", address="Pune"),
            2: Customer(user_id=2, name="Maya Patel", email="maya@example.com", address="Mumbai"),
            3: Admin(user_id=3, name="System Admin", email="admin@example.com", address="Pune"),
        }
        self._password_hashes: dict[int, str] = {}
        self._next_id = 4

    def list_customers(self) -> list[Customer]:
        return deepcopy([user for user in self._users.values() if isinstance(user, Customer)])

    def list_admins(self) -> list[Admin]:
        return deepcopy([user for user in self._users.values() if isinstance(user, Admin)])

    def get_customer(self, user_id: int) -> Customer | None:
        user = self._users.get(user_id)
        return deepcopy(user) if isinstance(user, Customer) else None

    def get_user(self, user_id: int) -> User | None:
        return deepcopy(self._users.get(user_id))

    def create_customer(self, user_data: CustomerCreate) -> Customer:
        customer = Customer(user_id=self._next_id, **user_data.model_dump(exclude={"password"}))
        self._users[customer.user_id] = customer
        self._password_hashes[customer.user_id] = self._hash_password(user_data.password)
        self._next_id += 1
        return deepcopy(customer)

    def create_admin(self, user_data: AdminCreate) -> Admin:
        admin = Admin(user_id=self._next_id, **user_data.model_dump(exclude={"password"}))
        self._users[admin.user_id] = admin
        self._password_hashes[admin.user_id] = self._hash_password(user_data.password)
        self._next_id += 1
        return deepcopy(admin)

    def update_customer(self, user_id: int, user_data: CustomerUpdate) -> Customer | None:
        customer = self._users.get(user_id)
        if not isinstance(customer, Customer):
            return None

        updated_customer = customer.model_copy(update=user_data.model_dump(exclude_unset=True, exclude={"password"}))
        self._users[user_id] = updated_customer
        if user_data.password is not None:
            self._password_hashes[user_id] = self._hash_password(user_data.password)
        return deepcopy(updated_customer)

    def delete_customer(self, user_id: int) -> bool:
        user = self._users.get(user_id)
        if not isinstance(user, Customer):
            return False
        del self._users[user_id]
        self._password_hashes.pop(user_id, None)
        return True

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = urandom(16)
        digest = pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
        return f"{salt.hex()}:{digest.hex()}"
