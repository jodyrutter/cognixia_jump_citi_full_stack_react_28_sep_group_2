# Banking API

A FastAPI banking service backed by MongoDB. It supports CRUD operations for bank accounts, customers, and administrators.

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
$env:MONGODB_URI = "mongodb://localhost:27017"
$env:MONGODB_DATABASE = "banking"
$env:BANK_JWT_SECRET = "replace-with-a-long-random-secret"
uvicorn app.main:app --reload
```

MongoDB must be running before the API handles its first request. You can either install MongoDB Community Edition locally, run MongoDB with Docker, or use a MongoDB Atlas connection string. The API creates its collections and indexes and seeds the sample users and accounts on first use. Set `BANK_ADMIN_PASSWORD_HASH` to give the seeded admin a login password.

The default MongoDB connection is `mongodb://localhost:27017` and the default database is `banking`. Override them with `MONGODB_URI` and `MONGODB_DATABASE`.

The API is available at `http://127.0.0.1:8000`. Interactive documentation is at `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /api/accounts` - list accounts (admin only)
- `GET /api/accounts/{account_id}` - get one account (owner or admin)
- `POST /api/accounts` - create an account
- `PATCH /api/accounts/{account_id}` - update an account (owner or admin; only admins can change balances)
- `DELETE /api/accounts/{account_id}` - delete an account
- `POST /api/accounts/{account_id}/deposit` - deposit money (owner or admin)
- `POST /api/accounts/{account_id}/withdraw` - withdraw money (owner or admin)
- `GET /api/me` - get the signed-in user's profile and role
- `PATCH /api/me` - update the signed-in customer's profile
- `GET /api/me/accounts` - list the signed-in customer's accounts
- `GET /api/customers` - list customers (admin only)
- `POST /api/customers` - create a customer
- `GET /api/customers/{customer_id}` - get one customer (admin only)
- `PATCH /api/customers/{customer_id}` - update a customer
- `DELETE /api/customers/{customer_id}` - delete a customer as an admin
- `GET /api/customers/{customer_id}/accounts` - list accounts owned by a customer
- `GET /api/admins` - list admins (admin only)
- `POST /api/admins` - create an admin

Run the tests with:

```powershell
py -m pytest
```

The tests use MongoDB and require the Docker MongoDB container to be running. They always reset the `banking_test` database before each test, so do not use that database for data you want to keep. Run tests from a terminal with:

```powershell
$env:MONGODB_URI = "mongodb://localhost:27017"
$env:MONGODB_DATABASE = "banking_test"
$env:BANK_JWT_SECRET = "test-only-long-random-secret"
python -m pytest
```
