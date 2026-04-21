# Fixture: Django DEBUG behind env var. Must NOT flag.
import os

DEBUG = os.environ.get("DJANGO_DEBUG", "").lower() == "true"
ALLOWED_HOSTS = ["example.com"]
