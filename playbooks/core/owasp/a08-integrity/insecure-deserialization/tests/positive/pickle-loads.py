# Fixture: pickle.loads. Should flag.
import pickle

def load_state(blob: bytes):
    return pickle.loads(blob)
