from datetime import datetime, timedelta, timezone
import os
from secrets import token_urlsafe

import pytest
from fastapi.testclient import TestClient
from pymongo.database import Database

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ["MONGODB_DATABASE"] = "banking_test"

from app import auth
from app.main import get_account_store
from app.mongo_store import MongoAccountStore, MongoUserStore, get_database
from app.models import Admin, AdminCreate, CustomerCreate
from app.mongo_store import get_user_store

from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("BANK_ADMIN_PASSWORD_HASH", raising=False)
    database: Database = get_database()
    database.client.drop_database(database.name)
    store = MongoAccountStore(database)
    user_store = MongoUserStore(database)
    user_store.create_admin(AdminCreate(
        name="Test Admin", email="test-admin@example.com", password="test-password", address="Test address",
    ))
    user_store.create_customer(CustomerCreate(
        name="Test Customer", email="customer@example.com", password="test-password", address="Test address",
    ))
    previous_overrides = app.dependency_overrides.copy()
    previous_sessions = auth.sessions.copy()
    app.dependency_overrides[get_account_store] = lambda: store
    app.dependency_overrides[get_user_store] = lambda: user_store
    auth.sessions.clear()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        auth.sessions.clear()
        auth.sessions.update(previous_sessions)


def login_headers(client, email="test-admin@example.com", password="test-password"):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_list_accounts_returns_seed_data(client) -> None:
    response = client.get("/api/accounts")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_account_crud_flow(client) -> None:
    client.headers.update(login_headers(client))
    create_response = client.post(
        "/api/accounts",
        json={
            "account_number": "10000003",
            "owner_id": 1,
            "account_type": "checking",
        },
    )

    assert create_response.status_code == 201
    account_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/accounts/{account_id}",
        json={"account_type": "savings"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["account_type"] == "savings"

    delete_response = client.delete(f"/api/accounts/{account_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/api/accounts/{account_id}").status_code == 404


def test_missing_account_returns_not_found(client) -> None:
    response = client.get("/api/accounts/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found"}


def test_deposit_and_withdraw(client) -> None:
    client.headers.update(login_headers(client))
    deposit_response = client.post(
        "/api/accounts/1/deposit",
        json={"amount": "100.00"},
    )
    assert deposit_response.status_code == 200
    assert deposit_response.json()["balance"] == "1350.00"

    withdraw_response = client.post(
        "/api/accounts/1/withdraw",
        json={"amount": "50.00"},
    )
    assert withdraw_response.status_code == 200
    assert withdraw_response.json()["balance"] == "1300.00"


def test_withdraw_rejects_insufficient_funds(client) -> None:
    client.headers.update(login_headers(client))
    response = client.post(
        "/api/accounts/2/withdraw",
        json={"amount": "10000.00"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Insufficient funds"}


@pytest.mark.parametrize("method,path,payload", [
    ("DELETE", "/api/accounts/1", None),
    ("PATCH", "/api/accounts/1", {"balance": "0.00"}),
    ("POST", "/api/accounts/1/deposit", {"amount": "10.00"}),
    ("POST", "/api/accounts/1/withdraw", {"amount": "10.00"}),
])
def test_balance_mutations_and_deletion_require_admin(client, method, path, payload):
    before = client.get("/api/accounts/1").json()
    response = client.request(method, path, json=payload)
    assert response.status_code == 401
    headers = login_headers(client, "customer@example.com")
    response = client.request(method, path, json=payload, headers=headers)
    assert response.status_code == 403
    assert client.get("/api/accounts/1").json() == before


def test_admin_can_set_balance_to_zero(client):
    response = client.patch("/api/accounts/1", json={"balance": "0.00"}, headers=login_headers(client))
    assert response.status_code == 200
    assert response.json()["balance"] == "0.00"


@pytest.mark.parametrize("balance", [None, "-1.00", "1.001"])
def test_invalid_balance_does_not_change_account(client, balance):
    before = client.get("/api/accounts/1").json()
    response = client.patch("/api/accounts/1", json={"balance": balance}, headers=login_headers(client))
    assert response.status_code == 422
    assert client.get("/api/accounts/1").json() == before


def test_customer_can_update_account_type(client):
    response = client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=login_headers(client, "customer@example.com"))
    assert response.status_code == 200


@pytest.mark.parametrize("email,password", [
    ("test-admin@example.com", "wrong-password"),
    ("missing@example.com", "test-password"),
])
def test_invalid_login(client, email, password):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 401
    assert not auth.sessions


@pytest.mark.parametrize("session_kind", ["unknown", "expired", "missing_user"])
def test_invalid_sessions(client, session_kind):
    token = token_urlsafe(32)
    if session_kind == "expired":
        auth.sessions[token] = (4, datetime.now(timezone.utc) - timedelta(minutes=1))
    elif session_kind == "missing_user":
        auth.sessions[token] = (999, datetime.now(timezone.utc) + timedelta(minutes=1))
    response = client.delete("/api/accounts/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert client.get("/api/accounts/1").status_code == 200


def test_creation_cannot_set_balance(client):
    response = client.post("/api/accounts", json={
        "owner_id": 102, "account_type": "checking", "account_number": "10000099", "balance": "1000.00",
    })
    assert response.status_code == 422
    assert len(client.get("/api/accounts").json()) == 2


@pytest.mark.parametrize("operation", ["deposit", "withdraw"])
def test_transaction_validation_and_missing_account(client, operation):
    headers = login_headers(client)
    response = client.post(f"/api/accounts/1/{operation}", json={"amount": "0"}, headers=headers)
    assert response.status_code == 422
    response = client.post(f"/api/accounts/999/{operation}", json={"amount": "1.00"}, headers=headers)
    assert response.status_code == 404


def test_registered_customer_can_login_and_own_account(client):
    response = client.post("/api/customers", json={
        "name": "New Customer", "email": "new@example.com", "password": "test-password", "address": "Delhi",
    })
    assert response.status_code == 201
    customer = response.json()
    assert "password" not in customer
    assert "password_hash" not in customer
    assert "admin" not in customer
    headers = login_headers(client, "new@example.com")
    response = client.post("/api/accounts", json={
        "owner_id": customer["user_id"], "account_number": "10000020", "account_type": "checking",
    })
    assert response.status_code == 201
    assert response.json()["balance"] == "0.00"
    account_id = response.json()["id"]
    assert client.delete(f"/api/accounts/{account_id}", headers=headers).status_code == 403
    assert client.get(f"/api/accounts/{account_id}").status_code == 200
    assert any(user["user_id"] == customer["user_id"] for user in client.get("/api/customers").json())


def test_only_admin_can_create_admin_and_new_admin_can_login(client):
    payload = {"name": "Second Admin", "email": "second-admin@example.com", "password": "test-password", "address": "Delhi"}
    assert client.post("/api/admins", json=payload).status_code == 401
    customer_headers = login_headers(client, "customer@example.com")
    assert client.post("/api/admins", json=payload, headers=customer_headers).status_code == 403
    response = client.post("/api/admins", json=payload, headers=login_headers(client))
    assert response.status_code == 201
    assert response.json()["admin"] is True
    assert "password" not in response.json()
    new_admin_headers = login_headers(client, "second-admin@example.com")
    assert client.delete("/api/accounts/1", headers=new_admin_headers).status_code == 204
    assert any(user["user_id"] == response.json()["user_id"] for user in client.get("/api/admins").json())


@pytest.mark.parametrize("owner_id", [999, 3])
def test_account_requires_existing_customer(client, owner_id):
    response = client.post("/api/accounts", json={
        "owner_id": owner_id, "account_number": "10000030", "account_type": "checking",
    })
    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


def test_bootstrap_admin_uses_configured_hash(monkeypatch):
    from pwdlib import PasswordHash

    password_hash = PasswordHash.recommended().hash("bootstrap-test-password")
    monkeypatch.setenv("BANK_ADMIN_PASSWORD_HASH", password_hash)
    database = get_database()
    database.client.drop_database(database.name)
    store = MongoUserStore(database)
    user = store.authenticate("admin@example.com", "bootstrap-test-password")
    assert isinstance(user, Admin)
    assert user.user_id == 3
    assert user.admin is True
    assert store.get_customer(1) is not None
    assert store.authenticate("admin@example.com", "wrong-password") is None


def test_seed_users_without_passwords_cannot_login(client):
    for email in ("admin@example.com", "aarav@example.com", "maya@example.com"):
        response = client.post("/api/login", json={"email": email, "password": "test-password"})
        assert response.status_code == 401


def test_customer_view_update_and_admin_delete(client) -> None:
    create_response = client.post(
        "/api/customers",
        json={
            "name": "Delete Me",
            "email": "delete@example.com",
            "password": "training-password",
            "address": "Delhi",
        },
    )
    customer_id = create_response.json()["user_id"]

    get_response = client.get(f"/api/customers/{customer_id}")
    assert get_response.status_code == 200

    update_response = client.patch(
        f"/api/customers/{customer_id}",
        json={"address": "Bengaluru"},
        headers=login_headers(client, "delete@example.com", "training-password"),
    )
    assert update_response.status_code == 200
    assert update_response.json()["address"] == "Bengaluru"

    assert client.delete(f"/api/customers/{customer_id}").status_code == 401
    assert client.delete(f"/api/customers/{customer_id}", headers=login_headers(client, "customer@example.com")).status_code == 403
    assert client.delete(f"/api/customers/{customer_id}", headers=login_headers(client)).status_code == 204


def test_customer_with_accounts_cannot_be_deleted(client) -> None:
    response = client.delete("/api/customers/1", headers=login_headers(client))

    assert response.status_code == 409
    assert response.json() == {"detail": "Customer still owns accounts"}


def test_customer_accounts_endpoint(client) -> None:
    response = client.get("/api/customers/1/accounts")

    assert response.status_code == 200
    assert all(account["owner_id"] == 1 for account in response.json())


def test_customer_accounts_endpoint_rejects_unknown_customer(client) -> None:
    response = client.get("/api/customers/999/accounts")

    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}




def test_customer_delete_rejects_unverified_user_id_header(client):
    response = client.delete("/api/customers/5", headers={"X-User-Id": "3"})
    assert response.status_code == 401
    assert client.get("/api/customers/5").status_code == 200


def test_customer_password_update_works_with_login(client):
    response = client.patch(
        "/api/customers/5",
        json={"password": "updated-password"},
        headers=login_headers(client, "customer@example.com"),
    )
    assert response.status_code == 200
    assert "password" not in response.json()
    assert client.post("/api/login", json={
        "email": "customer@example.com", "password": "test-password",
    }).status_code == 401
    response = client.post("/api/login", json={
        "email": "customer@example.com", "password": "updated-password",
    })
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=headers).status_code == 200
    assert client.delete("/api/accounts/1", headers=headers).status_code == 403


def test_deleted_customer_cannot_reuse_session(client):
    headers = login_headers(client, "customer@example.com")
    assert client.delete("/api/customers/5", headers=login_headers(client)).status_code == 204
    assert client.patch("/api/accounts/1", json={"account_type": "savings"}, headers=headers).status_code == 401
    assert client.post("/api/login", json={
        "email": "customer@example.com", "password": "test-password",
    }).status_code == 401

def test_signup_customer_can_login_but_cannot_create_admin(client):
    signup_data = {
        "name": "Signup Customer",
        "email": "signup@example.com",
        "password": "signup-test-password",
        "address": "Delhi",
    }

    response = client.post("/api/signup", json=signup_data)

    assert response.status_code == 201
    customer = response.json()
    assert customer["email"] == signup_data["email"]
    assert "password" not in customer
    assert "password_hash" not in customer
    assert "admin" not in customer

    headers = login_headers(
        client,
        email=signup_data["email"],
        password=signup_data["password"],
    )

    response = client.patch(
        f"/api/customers/{customer['user_id']}",
        json={"address": "Mumbai"},
        headers=headers,
    )
    assert response.status_code == 200

    response = client.post(
        "/api/admins",
        json={
            "name": "Attempted Admin",
            "email": "attempted-admin@example.com",
            "password": "another-test-password",
            "address": "Delhi",
        },
        headers=headers,
    )
    assert response.status_code == 403

def test_signup_rejects_duplicate_email(client):
    data = {
        "name": "Signup Customer",
        "email": "unique@example.com",
        "password": "signup-test-password",
        "address": "Delhi",
    }

    assert client.post("/api/signup", json=data).status_code == 201

    data["email"] = "UNIQUE@example.com"
    response = client.post("/api/signup", json=data)

    assert response.status_code == 409


@pytest.mark.parametrize("method", ["GET", "PATCH", "DELETE"])
def test_missing_customer_returns_not_found(client, method):
    response = client.request(method, "/api/customers/999", headers=login_headers(client),
                              json={"address": "Delhi"} if method == "PATCH" else None)
    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}
