import psycopg2
import os
import dotenv

DB_URL = os.getenv('POSTGRES_URL')

if not DB_URL:
    dotenv_path = os.path.abspath('./.env.local')

    if os.path.exists(dotenv_path):
        dotenv.load_dotenv(dotenv_path=dotenv_path)
        DB_URL = os.getenv('POSTGRES_URL')
        print(DB_URL)
    else:
        print(f"Error: The file {dotenv_path} does not exist.")

def save_price_to_db(conn, date, price):
    with conn.cursor() as c:
        c.execute('INSERT INTO prices (date, price) VALUES (%s, %s) ON CONFLICT (date) DO UPDATE SET price = EXCLUDED.price;', (date, price))


def init_db():
    print(DB_URL)
    conn = psycopg2.connect(DB_URL)
    with conn.cursor() as c:
        c.execute('''CREATE TABLE IF NOT EXISTS prices
                     (date TEXT PRIMARY KEY, price REAL)''')
        conn.commit()
