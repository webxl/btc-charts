export const appName = 'BTC Charts';
export const powerLawIntercept = 2.777e-17;
export const powerLawSlope = 5.71;
export const powerLawStdResiduals = 0.7305045048910941;

  /*
    # python fitting

    def log_power_law(log_x, log_a, b):
        return log_a + b * log_x

    def linear_func(x, m, c):
        return m * x + c

    # using pd.read_csv, get date & price then for each point, index the difference in days from genesis:

    numDays = (data['date'][0] - datetime(2009, 1, 3)).days
    data['date_index'] = [numDays + i for i in range(len(data))]

    x = data['date_index'].values
    y = data['price'].values

    log_x = np.log(x)
    log_y = np.log(y)

    popt, pcov = curve_fit(linear_func, log_x, log_y)

    # Extract parameters
    m, c = popt
    a = np.exp(c)  # Intercept in original scale
    b = m          # Slope remains the same

    # Generate prediction data
    x_pred = np.logspace(np.log10(x.min()), np.log10(x.max()), 100)
    y_pred = power_law(x_pred, a, b)

    # Calculate 1 and 2 standard deviation bands of y values
    residuals = np.log(y) - linear_func(log_x, *popt)
    std_residuals = np.std(residuals)

    upper_2std = np.exp(linear_func(np.log(x_pred), *popt) + 2*std_residuals)
    upper_1std = np.exp(linear_func(np.log(x_pred), *popt) + std_residuals)
    lower_1std = np.exp(linear_func(np.log(x_pred), *popt) - std_residuals)
    lower_2std = np.exp(linear_func(np.log(x_pred), *popt) - 2*std_residuals)
   */

  // https://www.porkopolis.io/thechart/ a=1.39e-17 b=5.79
  // https://www.desmos.com/calculator/y9lg886azr