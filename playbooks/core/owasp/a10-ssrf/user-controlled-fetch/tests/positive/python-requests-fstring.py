# Fixture: requests.get with f-string from request data. Should flag.
import requests

def proxy(request):
    resp = requests.get(f"{request.data.url}/data")
    return resp.json()
