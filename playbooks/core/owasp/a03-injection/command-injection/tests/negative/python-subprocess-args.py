# Fixture: subprocess with args list, no shell. Must NOT flag.
import subprocess

def backup(name: str):
    subprocess.run(["tar", "czf", f"/tmp/{name}.tar.gz", "/data"], check=True)
