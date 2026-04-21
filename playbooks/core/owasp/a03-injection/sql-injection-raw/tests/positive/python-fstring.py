# Fixture: f-string SQL. Should flag.
def find_user(cursor, email):
    cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")
    return cursor.fetchone()
