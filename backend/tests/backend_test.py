"""Backend API tests for Budget App"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://kelola-budget.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def cleanup_expenses(session):
    yield
    # cleanup TEST_ expenses
    try:
        r = session.get(f"{API}/expenses", timeout=30)
        for e in r.json():
            if e.get("keterangan", "").startswith("TEST_"):
                session.delete(f"{API}/expenses/{e['id']}", timeout=30)
    except Exception:
        pass


class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()


class TestBudget:
    def test_set_budget(self, session):
        r = session.post(f"{API}/budget", json={"amount": 10000000}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["amount"] == 10000000
        assert "id" in data

    def test_get_budget(self, session):
        r = session.get(f"{API}/budget", timeout=30)
        assert r.status_code == 200
        assert r.json()["amount"] == 10000000

    def test_update_budget(self, session):
        r = session.post(f"{API}/budget", json={"amount": 15000000}, timeout=30)
        assert r.status_code == 200
        r2 = session.get(f"{API}/budget", timeout=30)
        assert r2.json()["amount"] == 15000000


class TestExpenseCRUD:
    expense_id = None

    def test_create_expense(self, session, cleanup_expenses):
        payload = {
            "tanggal": "2026-01-15",
            "nominal": 50000,
            "kategori": "Makanan & Minuman",
            "keterangan": "TEST_lunch",
        }
        r = session.post(f"{API}/expenses", json=payload, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["nominal"] == 50000
        assert data["kategori"] == "Makanan & Minuman"
        assert "id" in data
        TestExpenseCRUD.expense_id = data["id"]

    def test_get_expenses(self, session):
        r = session.get(f"{API}/expenses", timeout=30)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestExpenseCRUD.expense_id in ids

    def test_update_expense(self, session):
        eid = TestExpenseCRUD.expense_id
        r = session.put(f"{API}/expenses/{eid}", json={"nominal": 75000, "keterangan": "TEST_updated"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["nominal"] == 75000
        # verify persistence
        r2 = session.get(f"{API}/expenses", timeout=30)
        found = [e for e in r2.json() if e["id"] == eid][0]
        assert found["nominal"] == 75000
        assert found["keterangan"] == "TEST_updated"

    def test_delete_expense(self, session):
        eid = TestExpenseCRUD.expense_id
        r = session.delete(f"{API}/expenses/{eid}", timeout=30)
        assert r.status_code == 200
        r2 = session.get(f"{API}/expenses", timeout=30)
        ids = [e["id"] for e in r2.json()]
        assert eid not in ids


class TestDashboard:
    def test_dashboard_stats(self, session, cleanup_expenses):
        # set budget
        session.post(f"{API}/budget", json={"amount": 1000000}, timeout=30)
        # create expense
        r1 = session.post(f"{API}/expenses", json={
            "tanggal": "2026-01-10", "nominal": 200000,
            "kategori": "Transport", "keterangan": "TEST_dash"
        }, timeout=30)
        eid = r1.json()["id"]
        r = session.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["budget_awal"] == 1000000
        assert data["total_pengeluaran"] >= 200000
        assert data["saldo_tersisa"] == data["budget_awal"] - data["total_pengeluaran"]
        assert data["persentase_terpakai"] > 0
        session.delete(f"{API}/expenses/{eid}", timeout=30)


class TestStats:
    def test_expense_stats(self, session, cleanup_expenses):
        r1 = session.post(f"{API}/expenses", json={
            "tanggal": "2026-02-10", "nominal": 100000,
            "kategori": "Belanja", "keterangan": "TEST_stats"
        }, timeout=30)
        eid = r1.json()["id"]
        r = session.get(f"{API}/expenses/stats", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "monthly" in data
        assert "by_category" in data
        assert any(m["bulan"] == "2026-02" for m in data["monthly"])
        assert any(c["kategori"] == "Belanja" for c in data["by_category"])
        session.delete(f"{API}/expenses/{eid}", timeout=30)


class TestExports:
    def test_export_excel(self, session):
        r = session.get(f"{API}/export/excel", timeout=60)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_export_pdf(self, session):
        r = session.get(f"{API}/export/pdf", timeout=60)
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


class TestUpload:
    def test_upload_file(self, session):
        # Create tiny PNG
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = session.post(f"{API}/upload", files=files, timeout=60)
        assert r.status_code == 200, f"Upload failed: {r.text}"
        data = r.json()
        assert "path" in data
        assert data["filename"] == "test.png"
