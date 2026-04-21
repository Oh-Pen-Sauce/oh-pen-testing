# Fixture: subprocess with shell=True. Should flag.
import subprocess

def backup(name: str):
    subprocess.run(f"tar czf /tmp/{name}.tar.gz /data", shell=True, check=True)
