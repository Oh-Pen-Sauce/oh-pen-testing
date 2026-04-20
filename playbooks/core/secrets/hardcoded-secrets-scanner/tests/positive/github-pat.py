# Fixture: contains a GitHub PAT-shaped dummy token. Scanner must flag.

GITHUB_PAT = "ghp_1234567890abcdef1234567890abcdef1234"


def authenticated_client():
    return {"Authorization": f"token {GITHUB_PAT}"}
