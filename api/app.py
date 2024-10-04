import sqlite3
import requests
from datetime import date
from flask import Flask, jsonify, request
from db_util import init_db, save_price_to_db
from stats import compute_stats

app = Flask(__name__)

DB_NAME = 'bitcoin_prices.db'

def get_price_from_db(date):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('SELECT price FROM prices WHERE date = ?', (date,))
    result = c.fetchone()
    conn.close()
    return result[0] if result else None

def get_prices_from_db(start=None, end=None):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if start and end:
        c.execute('SELECT date, price FROM prices WHERE date BETWEEN? AND?', (start, end))
    elif start:
        c.execute('SELECT date, price FROM prices WHERE date >=?', (start,))
    elif end:
        c.execute('SELECT date, price FROM prices WHERE date <=?', (end,))
    else:
        c.execute('SELECT date, price FROM prices')
    results = c.fetchall()
    conn.close()
    # return as list of date & price dictionary
    return [dict(zip(('date', 'price'), result)) for result in results]

@app.route('/stats')
def fetch_power_law_stats():
    return compute_stats()


def fetch_bitcoin_price():
    url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
    params = {'symbol': 'BTC'}
    headers = {'X-CMC_PRO_API_KEY': 'ce35c76e-1bea-4f8c-91d9-ff9d591ca0ae'}
    response = requests.get(url, params=params, headers=headers)
    data = response.json()
    return data['data']['BTC']['quote']['USD']['price']

@app.route('/today')
def daily_price():
    today = date.today().isoformat()
    price = get_price_from_db(today)

    if price is None:
        price = fetch_bitcoin_price()
        save_price_to_db(today, price)

    return jsonify({'date': today, 'price': price})

@app.route('/timeseries')
def time_series():
    start = request.args.get('start')
    end = request.args.get('end')
    prices = get_prices_from_db(start, end)
    return jsonify(prices)

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
