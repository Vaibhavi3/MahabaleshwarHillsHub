import datetime
import time

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.database import Base, engine, SessionLocal
from app import models
from app.utils import firebase_auth

PROJECT = "test-project"


@pytest.fixture(scope="module")
def signer():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(1).not_valid_before(now).not_valid_after(now + datetime.timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    pem_key = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    firebase_auth._cache.update(certs={"k1": cert.public_bytes(serialization.Encoding.PEM).decode()}, expires=time.time() + 3600)

    def make(phone, project=PROJECT, exp_in=3600):
        now_s = int(time.time())
        claims = {"iss": f"https://securetoken.google.com/{project}", "aud": project, "sub": "uid-" + phone,
                  "iat": now_s, "exp": now_s + exp_in, "auth_time": now_s, "phone_number": phone}
        return jwt.encode(claims, pem_key, algorithm="RS256", headers={"kid": "k1"})
    return make


@pytest.fixture(scope="module")
def client(monkeypatch_module):
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture(scope="module")
def monkeypatch_module():
    mp = pytest.MonkeyPatch()
    mp.setenv("FIREBASE_PROJECT_ID", PROJECT)
    yield mp
    mp.undo()


def test_new_number_then_register_then_login(client, signer):
    tok = signer("+919876500001")
    r = client.post("/api/auth/phone/verify", json={"id_token": tok})
    assert r.status_code == 200 and r.json()["new_user"] is True and r.json()["access_token"] is None

    r = client.post("/api/auth/phone/register", json={"id_token": tok, "first_name": "Asha"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["phone"] == "+919876500001" and r.json()["access_token"]

    r = client.post("/api/auth/phone/verify", json={"id_token": signer("+919876500001")})
    assert r.json()["new_user"] is False and r.json()["user"]["first_name"] == "Asha"


def test_existing_user_with_formatted_phone_is_matched(client, signer):
    db = SessionLocal()
    db.add(models.User(username="oldcustomer", email="old@example.com", hashed_password="x", phone="98765 00002", is_active=True))
    db.commit(); db.close()
    r = client.post("/api/auth/phone/verify", json={"id_token": signer("+919876500002")})
    assert r.json()["new_user"] is False and r.json()["user"]["username"] == "oldcustomer"


def test_rejects_wrong_project_and_expired(client, signer):
    assert client.post("/api/auth/phone/verify", json={"id_token": signer("+919876500003", project="other")}).status_code == 401
    assert client.post("/api/auth/phone/verify", json={"id_token": signer("+919876500003", exp_in=-60)}).status_code == 401
