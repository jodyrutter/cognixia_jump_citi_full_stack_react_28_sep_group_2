from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from app import auth
from app.main import app, get_account_store
from app.models import Admin, Customer
from app.store import AccountStore


client = TestClient(app)


def test_list_accounts_returns_seed_data() -> None:
    response = client.get("/api/accounts")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_account_crud_flow() -> None:
    create_response = client.post(
        "/api/accounts",
        json={
            "account_number": "10000003",
            "owner_id": 3,
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


def test_missing_account_returns_not_found() -> None:
    response = client.get("/api/accounts/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found"}

def test_only_admin_can_delete_account() -> None:
    test_store = AccountStore()

    admin = Admin(
        userId=101,
        name="Test Admin",
        email="admin@example.com",
        address="Test address",
    )

    customer = Customer(
        userId=102,
        name="Test Customer",
        email="customer@example.com",
        address="Test address",
        accountNumber="10000001",
        balance=0,
        accountType="checking",
    )

    admin_token = token_urlsafe(32)
    customer_token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    previous_users = auth.users.copy()
    previous_sessions = auth.sessions.copy()
    previous_overrides = app.dependency_overrides.copy()

    try:
        auth.users[admin.userId] = admin
        auth.users[customer.userId] = customer
        auth.sessions[admin_token] = (admin.userId, expires_at)
        auth.sessions[customer_token] = (customer.userId, expires_at)

        app.dependency_overrides[get_account_store] = lambda: test_store
        response = client.delete("/api/accounts/1")
        assert response.status_code == 401
        assert test_store.get(1) is not None

        response = client.delete(
            "/api/accounts/1",
            headers={
                "Authorization": f"Bearer {customer_token}",
            },
        )
        assert response.status_code == 403
        assert test_store.get(1) is not None

        response = client.delete(
            "/api/accounts/1",
            headers={
                "Authorization": f"Bearer {admin_token}",
            },
        )
        assert response.status_code == 204
        assert test_store.get(1) is None

    finally:
        auth.users.clear()
        auth.users.update(previous_users)
        auth.sessions.clear()
        auth.sessions.update(previous_sessions)
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
