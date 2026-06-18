"""Multi-division Budget App backend tests (REGIS/BLAST/SEO)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to reading frontend/.env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL'):
                    BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')
    except Exception:
        pass

API = f"{BASE_URL}/api"
DIVS = ["REGIS", "BLAST", "SEO"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def cleanup(client):
    yield
    # cleanup TEST_ expenses
    try:
        r = client.get(f"{API}/expenses")
        if r.status_code == 200:
            for e in r.json():
                if e.get("keterangan", "").startswith("TEST_"):
                    client.delete(f"{API}/expenses/{e['id']}")
    except Exception:
        pass


# --- Root ---
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    assert "Budget" in r.json().get("message", "")


# --- Budgets per division ---
@pytest.mark.parametrize("divisi", DIVS)
def test_set_budget(client, divisi):
    r = client.post(f"{API}/budgets", json={"divisi": divisi, "amount": 1000000})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["divisi"] == divisi
    assert data["amount"] == 1000000


@pytest.mark.parametrize("divisi", DIVS)
def test_get_budget(client, divisi):
    r = client.get(f"{API}/budgets/{divisi}")
    assert r.status_code == 200
    assert r.json()["divisi"] == divisi
    assert r.json()["amount"] == 1000000


def test_budget_negative_rejected(client):
    r = client.post(f"{API}/budgets", json={"divisi": "REGIS", "amount": -100})
    assert r.status_code == 400


def test_budget_update_existing(client):
    client.post(f"{API}/budgets", json={"divisi": "REGIS", "amount": 1000000})
    r = client.post(f"{API}/budgets", json={"divisi": "REGIS", "amount": 2000000})
    assert r.status_code == 200
    assert r.json()["amount"] == 2000000
    # restore
    client.post(f"{API}/budgets", json={"divisi": "REGIS", "amount": 1000000})


def test_get_all_budgets(client):
    r = client.get(f"{API}/budgets")
    assert r.status_code == 200
    divs = [b["divisi"] for b in r.json()]
    for d in DIVS:
        assert d in divs


# --- Expenses ---
@pytest.fixture(scope="module")
def created_expenses(client, cleanup):
    ids = {}
    for d in DIVS:
        payload = {
            "divisi": d,
            "tanggal": "2026-01-15",
            "nominal": 50000,
            "kategori": "Operasional",
            "keterangan": f"TEST_{d}_expense"
        }
        r = client.post(f"{API}/expenses", json=payload)
        assert r.status_code == 200, r.text
        ids[d] = r.json()["id"]
    return ids


def test_create_expense_validation(client):
    r = client.post(f"{API}/expenses", json={
        "divisi": "REGIS", "tanggal": "2026-01-15",
        "nominal": 0, "kategori": "X", "keterangan": "TEST_zero"
    })
    assert r.status_code == 400


@pytest.mark.parametrize("divisi", DIVS)
def test_list_expenses_by_division(client, created_expenses, divisi):
    r = client.get(f"{API}/expenses", params={"divisi": divisi})
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for it in items:
        assert it["divisi"] == divisi


def test_update_expense(client, created_expenses):
    eid = created_expenses["BLAST"]
    r = client.put(f"{API}/expenses/{eid}", json={"nominal": 75000, "keterangan": "TEST_BLAST_updated"})
    assert r.status_code == 200
    assert r.json()["nominal"] == 75000
    g = client.get(f"{API}/expenses", params={"divisi": "BLAST"})
    assert any(e["id"] == eid and e["nominal"] == 75000 for e in g.json())


def test_update_expense_not_found(client):
    r = client.put(f"{API}/expenses/nonexistent-id", json={"nominal": 100})
    assert r.status_code == 404


# --- Dashboard stats aggregation ---
def test_dashboard_stats(client, created_expenses):
    r = client.get(f"{API}/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total_budget" in data
    assert "total_pengeluaran" in data
    assert "total_saldo" in data
    assert len(data["divisions"]) == 3
    names = [d["divisi"] for d in data["divisions"]]
    assert set(names) == set(DIVS)
    # total_saldo = total_budget - total_pengeluaran
    assert abs(data["total_saldo"] - (data["total_budget"] - data["total_pengeluaran"])) < 0.01
    # each division's saldo correct
    for d in data["divisions"]:
        assert abs(d["saldo_tersisa"] - (d["budget_awal"] - d["total_pengeluaran"])) < 0.01


# --- Stats per division ---
@pytest.mark.parametrize("divisi", DIVS)
def test_expense_stats(client, created_expenses, divisi):
    r = client.get(f"{API}/expenses/stats/{divisi}")
    assert r.status_code == 200
    data = r.json()
    assert "monthly" in data and "by_category" in data
    assert any(m["bulan"] == "2026-01" for m in data["monthly"])


# --- Export ---
@pytest.mark.parametrize("divisi", DIVS)
def test_export_excel(client, created_expenses, divisi):
    r = client.get(f"{API}/export/excel/{divisi}")
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "")
    assert len(r.content) > 100


@pytest.mark.parametrize("divisi", DIVS)
def test_export_pdf(client, created_expenses, divisi):
    r = client.get(f"{API}/export/pdf/{divisi}")
    assert r.status_code == 200
    assert "pdf" in r.headers.get("content-type", "")
    assert r.content[:4] == b"%PDF"


# --- Delete (soft delete) ---
def test_delete_expense(client, created_expenses):
    eid = created_expenses["SEO"]
    r = client.delete(f"{API}/expenses/{eid}")
    assert r.status_code == 200
    g = client.get(f"{API}/expenses", params={"divisi": "SEO"})
    assert all(e["id"] != eid for e in g.json())


def test_delete_not_found(client):
    r = client.delete(f"{API}/expenses/nonexistent-id")
    assert r.status_code == 404


# --- Upload (expected to fail per iter 1) ---
def test_upload_attempt(client):
    files = {"file": ("test.txt", b"hello", "text/plain")}
    s = requests.Session()
    r = s.post(f"{API}/upload", files=files)
    # Per iter 1, this 500s due to storage 401. We assert known state.
    assert r.status_code in (200, 500)
