def serve_file(request):
    with open(f"/var/data/{request.query.name}", "rb") as f:
        return f.read()
