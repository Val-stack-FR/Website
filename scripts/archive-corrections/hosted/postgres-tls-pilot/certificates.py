"""Ephemeral, invented D7 PKI. No OS trust-store writes or downloads."""
import datetime as dt
import hashlib
import ipaddress
import json
import pathlib
import sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

run = pathlib.Path(sys.argv[1]).resolve()
if not run.name.startswith("d7-tls-") or run.parent.name != ".archive-corrections-private":
    raise SystemExit("Assigned new D7 private run required")
preflight = json.loads((run / "preflight.json").read_text(encoding="utf-8-sig"))
if not preflight["passed"] or preflight["database_already_started"]:
    raise SystemExit("Successful pre-operation preflight required")
now = dt.datetime.now(dt.timezone.utc)
expiry = now + dt.timedelta(hours=24)
def write_new(name, data):
    with (run / name).open("xb") as file:
        file.write(data)
def name(label):
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, label)])
def key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)
def authority(label):
    private = key()
    subject = name(label)
    certificate = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
        .public_key(private.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1)).not_valid_after(expiry)
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(x509.KeyUsage(True, False, False, False, False, True, True, False, False), critical=True)
        .sign(private, hashes.SHA256()))
    return private, certificate
ca_key, ca = authority("D7 invented ephemeral CA")
_, wrong_ca = authority("D7 invented unrelated CA")
server_key = key()
def leaf(label, alternatives):
    return (x509.CertificateBuilder().subject_name(name(label)).issuer_name(ca.subject)
        .public_key(server_key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=1)).not_valid_after(expiry)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName(alternatives), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.KeyUsage(True, False, True, False, False, False, False, False, False), critical=True)
        .sign(ca_key, hashes.SHA256()))
server = leaf("localhost", [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))])
wrong_name = leaf("wrong-name.invalid", [x509.DNSName("wrong-name.invalid")])
public = {"ca.pem": ca, "wrong-ca.pem": wrong_ca, "server.pem": server, "wrong-name.pem": wrong_name}
pins = []
for filename, cert in public.items():
    data = cert.public_bytes(serialization.Encoding.PEM)
    write_new(filename, data)
    pins.append({"file": filename, "sha256": hashlib.sha256(data).hexdigest(),
                 "certificate_sha256": cert.fingerprint(hashes.SHA256()).hex()})
for filename, private in [("ca-key.private.pem", ca_key), ("server-key.private.pem", server_key)]:
    write_new(filename, private.private_bytes(serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
proof = {"version": "d7-certificate-proof/v1", "simulation": True, "created_at": now.isoformat(),
    "expires_at": expiry.isoformat(), "server_san": ["DNS:localhost", "IP:127.0.0.1"],
    "wrong_name_san": ["DNS:wrong-name.invalid"], "private_keys_excluded": True,
    "system_trust_store_changed": False, "public_certificate_pins": pins}
write_new("certificate-proof.json", (json.dumps(proof, indent=2) + "\n").encode())
print(json.dumps({"certificates_created": True, "validity_hours": 24, "system_trust_store_changed": False}))
