# Fixture: RSA generated at 4096 bits. Must NOT flag.
from cryptography.hazmat.primitives.asymmetric import rsa


def make_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=4096)
