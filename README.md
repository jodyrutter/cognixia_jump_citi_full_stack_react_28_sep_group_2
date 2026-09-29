# Banking API

A simple FastAPI banking service with in-memory dummy data. It currently supports CRUD operations for bank accounts and does not require a database or frontend.

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[test]"
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive documentation is at `http://127.0.0.1:8000/docs`.

## Endpoints

- `GET /api/accounts` - list accounts
- `GET /api/accounts/{account_id}` - get one account
- `POST /api/accounts` - create an account
- `PATCH /api/accounts/{account_id}` - update an account
- `DELETE /api/accounts/{account_id}` - delete an account
- `POST /api/accounts/{account_id}/deposit` - deposit money
- `POST /api/accounts/{account_id}/withdraw` - withdraw money
- `GET /api/customers` - list customers
- `POST /api/customers` - create a customer
- `GET /api/customers/{customer_id}` - get one customer
- `PATCH /api/customers/{customer_id}` - update a customer
- `DELETE /api/customers/{customer_id}` - delete a customer as an admin
- `GET /api/customers/{customer_id}/accounts` - list accounts owned by a customer
- `GET /api/admins` - list admins
- `POST /api/admins` - create an admin

Run the tests with:

```powershell
pytest
```
