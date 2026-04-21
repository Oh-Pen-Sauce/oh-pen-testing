# Fixture: random.randint for OTPs. Should flag.
import random

def generate_otp() -> str:
    code = str(random.randint(100000, 999999))
    return code
