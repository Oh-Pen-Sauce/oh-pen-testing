# Fixture: logging.info leaking access_token. Should flag.
import logging

def track_auth(user_id: str, access_token: str):
    logging.info(f"auth ok for {user_id} access_token={access_token}")
