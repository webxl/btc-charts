from datetime import datetime
import sqlite3

DB_NAME = 'bitcoin_prices.db'

def save_price_to_db(conn, date, price):
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO prices (date, price) VALUES (?, ?)', (date, price))


def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS prices
                 (date TEXT PRIMARY KEY, price REAL)''')
    conn.commit()
    conn.close()