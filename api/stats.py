from datetime import datetime

import numpy as np
import matplotlib.pyplot as plt
# from scipy.optimize import curve_fit
import pandas as pd
import psycopg2
import os

DB_URL = os.getenv('POSTGRES_URL')

def power_law(x, a, b):
    return a * x ** b

# todo: https://medium.com/@fulgur.ventures/bitcoin-power-law-theory-executive-summary-report-837e6f00347e

def get_prices_from_db(start=None, end=None):
    conn = psycopg2.connect(DB_URL)
    with conn.cursor() as c:
        if start and end:
            c.execute('SELECT date, price FROM prices WHERE date BETWEEN? AND?', (start, end))
        elif start:
            c.execute('SELECT date, price FROM prices WHERE date >=?', (start,))
        elif end:
            c.execute('SELECT date, price FROM prices WHERE date <=?', (end,))
        else:
            c.execute('SELECT date, price FROM prices')
        results = c.fetchall()
    # return as list of date & price dictionary
    return [dict(zip(('date', 'price'), result)) for result in results]

def read_data(source, is_csv=True, **kwargs):
    if is_csv:
        return pd.read_csv(source, **kwargs)
    else:
        return pd.read_sql(source, **kwargs)

def process_data(raw_data):
    if raw_data['date'].dtype != 'datetime64[ns]':
        raw_data['date'] = pd.to_datetime(raw_data['date'])
    
    # Filter data up to July 31, 2024
    # data = raw_data[raw_data['date'] < '2024-07-31']
    data = raw_data

    # Calculate the number of days since January 3, 2009
    start_date = datetime(2009, 1, 3)
    data['date_index'] = (data['date'] - start_date).dt.days
    
    return data

def log_power_law(log_x, log_a, b):
    return log_a + b * log_x

# Fit a linear model to the log-transformed data
def linear_func(x, m, c):
    return m * x + c


def compute_stats():
    conn = psycopg2.connect(DB_URL)
    raw_data = pd.read_sql('SELECT date, price FROM prices', conn)

    data = process_data(raw_data)

    x = data['date_index'].values
    y = data['price'].values

    weights = 1 / x

    # Fit model
    # raw_popt, raw_pcov = curve_fit(power_law, x, y, sigma=weights)

    log_x = np.log(x)
    log_y = np.log(y)

    popt, pcov = np.polyfit(log_x, log_y, 2)
    # popt, pcov = curve_fit(linear_func, log_x, log_y)

    # Extract parameters
    m, c = popt
    a = np.exp(c)  # Intercept in original scale
    b = m          # Slope remains the same

    # Generate prediction data
    x_pred = np.logspace(np.log10(x.min()), np.log10(x.max()), 100)

    # Calculate 1 and 2 standard deviation bands of y values
    residuals = np.log(y) - linear_func(log_x, *popt)
    std_residuals = np.std(residuals, ddof=1)

    return {
        "fitted_params": {
            "c": round(c, 3),
            "m": round(m, 3),
            "a": f"{a:.3E}",
            "b": round(b, 3)
        },
        "std_residuals": std_residuals
    }

    


def plot_data(ax, x, y, x_pred, lower_1std, upper_1std, lower_2std, upper_2std):
    # Create a figure with two subplots
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))

    # Plot original data
    ax1.plot(x, y, 'bo', label='Data')
    ax1.fill_between(x_pred, lower_1std, upper_1std, color='gray', alpha=0.3, label='Confidence band')
    ax1.plot(x_pred, y_pred, 'r-', label='Fit')
    ax1.set_xlabel('X')
    ax1.set_ylabel('Y')
    ax1.set_title('Power Law Regression (Original Scale)')
    ax1.legend()
    ax1.grid(True)

    # Create the log-log plot
    ax2.loglog(x, y, 'bo', label='Data')
    ax2.loglog(x_pred, y_pred, 'r-', label='Fit')
    ax2.fill_between(x_pred, lower_1std, upper_1std, color='gray', alpha=0.3, label='Confidence band')
    ax2.fill_between(x_pred, lower_2std, upper_2std, color='lightgray', alpha=0.3, label='Confidence band')
    ax2.set_xlabel('X')
    ax2.set_ylabel('Y')
    ax2.set_title('Power Law Regression (Log-Log Scale)')
    ax2.legend()
    ax2.grid(True)

    plt.tight_layout()
    plt.show()

