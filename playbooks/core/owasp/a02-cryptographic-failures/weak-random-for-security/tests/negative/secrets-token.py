# Fixture: secrets.token_urlsafe for tokens. Must NOT flag.
import secrets

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)
