# Fixture: recursively merging untrusted request JSON into an existing dict. Should flag.
def deep_merge(target, source):
    for key, value in source.items():
        if isinstance(value, dict):
            deep_merge(target.setdefault(key, {}), value)
        else:
            target[key] = value
    return target


def apply_settings(config, request):
    return deep_merge(config, request.json)
