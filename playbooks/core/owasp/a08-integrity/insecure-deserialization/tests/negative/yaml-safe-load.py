# Fixture: yaml.safe_load. Must NOT flag.
import yaml

def parse_config(raw: str):
    return yaml.safe_load(raw)
