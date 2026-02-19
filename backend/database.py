import sqlite3
import os

DB_NAME = "local_data.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data TEXT
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        conn.commit()
    finally:
        conn.close()

def save_file_metadata(filename, data_json_str):
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('INSERT INTO files (filename, data) VALUES (?, ?)', (filename, data_json_str))
        conn.commit()
        return True
    except Exception as e:
        print(f"DB Error: {e}")
        return False
    finally:
        conn.close()

# Ensure DB is created on import
if not os.path.exists(DB_NAME):
    init_db()
