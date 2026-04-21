# Fixture: yaml.load without SafeLoader. Should flag.
import yaml

def parse_config(raw: str):
    return yaml.load(raw)
