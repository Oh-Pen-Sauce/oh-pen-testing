# Fixture: hashlib.sha1 on tokens. Should flag.
import hashlib

def make_session_token(seed: str) -> str:
    return hashlib.sha1(seed.encode()).hexdigest()
