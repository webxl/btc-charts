from datetime import datetime
import requests
import csv
import sys
import psycopg2
from db_util import init_db, save_price_to_db, DB_URL
import dotenv
import os


dotenv_path = os.path.abspath('./.env.local')

if os.path.exists(dotenv_path):
    dotenv.load_dotenv(dotenv_path=dotenv_path)
    DB_URL = os.getenv('POSTGRES_URL')
    print(DB_URL)
else:
    print(f"Error: The file {dotenv_path} does not exist.")


def insert_csv_data(csv_file):
    conn = psycopg2.connect(DB_URL)
    with conn.cursor() as c:

        with open(csv_file, 'r') as file:
            csv_reader = csv.reader(file, delimiter='\t')
            next(csv_reader)  # Skip header row

            for row in csv_reader:
                date, price = row
                # Remove quotes from date and ensure ISO format
                date = date.strip('"')
                try:
                    # Attempt to parse the date and convert it to ISO format
                    parsed_date = datetime.strptime(date, "%Y-%m-%d")
                    iso_date = parsed_date.date().isoformat()
                except ValueError:
                    print(f"Skipping invalid date: {date}")
                    continue
                
                save_price_to_db(conn, iso_date, float(price))

    conn.commit()
    conn.close()


def update_daily_series_from_cmc():
    conn = psycopg2.connect(DB_URL)
    with conn.cursor() as c:
        c.execute('SELECT MAX(date) FROM prices')
        last_update = c.fetchone()[0] + 'T23:59:00'

    url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range"

    headers = {
        "accept": "application/json",
        "x-cg-demo-api-key": "CG-Zbrb3pwc8k5L1e26J2vKjGUD"
    }
    params = {'from': datetime.fromisoformat(last_update).timestamp(), 'vs_currency': 'usd', 'to': datetime.now().timestamp()}
    response = requests.get(url, params=params, headers=headers)
    data = response.json()

    for date_price in data['prices']:
        date = datetime.fromtimestamp(date_price[0] / 1000).isoformat().split('T')[0]
        price = date_price[1]
        save_price_to_db(conn, date, price)

    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()

    if sys.argv[1] == '-u':
        update_daily_series_from_cmc()
        sys.exit(0)

    if len(sys.argv) < 2:
        print("Please provide the CSV file path as an argument.")
        sys.exit(1)

    csv_file = sys.argv[1]
    insert_csv_data(csv_file)
    print(f"Data from {csv_file} has been inserted into the database.")
