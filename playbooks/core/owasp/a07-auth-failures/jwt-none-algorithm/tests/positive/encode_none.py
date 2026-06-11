# Fixture: PyJWT encode with algorithm="none". Should flag.
import jwt


def forge(payload, key):
    encoded = jwt.encode(payload, key, algorithm="none")
    return encoded
