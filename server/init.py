from datetime import datetime
import sqlite3
import requests
import csv
import sys

from db_util import init_db, save_price_to_db, DB_NAME


def insert_csv_data(csv_file):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

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
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT MAX(date) FROM prices')
    last_update = c.fetchone()[0] + 'T23:59:00'

    url = "https://pro-api.coingecko.com/api/v3/coins/bitcoin/market_chart/range"

    headers = {
        "accept": "application/json",
        "x-cg-pro-api-key": "CG-TNyscaEqG3PAFAvz6ZF6BKqU"
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
