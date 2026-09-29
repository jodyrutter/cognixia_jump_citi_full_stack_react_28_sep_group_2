from ..models import Admin, AdminCreate, Customer, CustomerCreate
from ..user_store import UserStore


class UserService:
    def __init__(self, store: UserStore) -> None:
        self._store = store

    def list_customers(self) -> list[Customer]:
        return self._store.list_customers()

    def list_admins(self) -> list[Admin]:
        return self._store.list_admins()

    def create_customer(self, user_data: CustomerCreate) -> Customer:
        return self._store.create_customer(user_data)

    def create_admin(self, user_data: AdminCreate) -> Admin:
        return self._store.create_admin(user_data)
