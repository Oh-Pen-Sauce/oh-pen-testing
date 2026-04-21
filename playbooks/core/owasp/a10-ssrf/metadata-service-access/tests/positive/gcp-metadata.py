# Fixture: GCP metadata hostname in code. Should flag.
import requests

def get_gcp_token():
    r = requests.get(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        headers={"Metadata-Flavor": "Google"},
    )
    return r.json()["access_token"]
