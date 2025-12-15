import sqlite3
import os
from datetime import datetime

DB_NAME = "local_data.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Files table to store metadata about generated PDFs
    c.execute('''
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data TEXT
        )
    ''')
    
    # Users table (simple)
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

def save_file_metadata(filename, data_json_str):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('INSERT INTO files (filename, data) VALUES (?, ?)', (filename, data_json_str))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"DB Error: {e}")
        return False

# Ensure DB is created on import
if not os.path.exists(DB_NAME):
    init_db()
