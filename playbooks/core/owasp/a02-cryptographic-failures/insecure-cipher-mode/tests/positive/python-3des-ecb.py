# Fixture: 3DES in ECB mode. Should flag.
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def build_cipher(key: bytes) -> Cipher:
    cipher = Cipher(algorithms.TripleDES(key), modes.ECB())
    return cipher
