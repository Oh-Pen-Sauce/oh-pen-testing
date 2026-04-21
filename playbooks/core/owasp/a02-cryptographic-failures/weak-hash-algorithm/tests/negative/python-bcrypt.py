# Fixture: bcrypt for passwords. Must NOT flag.
import bcrypt

def hash_password(pw: str) -> bytes:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt())
