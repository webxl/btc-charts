import dayjs from 'dayjs';

export type AnalysisFormData = {
  analysisStart: string;
  analysisEnd: string;
};

export type DailyPriceDatum = {
  date: string;
  price: number;
};

export type priceDatapoint = {
  x: Date;
  y: number;
};

type PriceBands = { [key in PriceBandTypes]: DailyPriceDatum[] };

export enum PriceBandTypes {
  posTwoSigma = 'posTwoSigma',
  posOneSigma = 'posOneSigma',
  price = 'price',
  powerLaw = 'powerLaw',
  negOneSigma = 'negOneSigma',
  negTwoSigma = 'negTwoSigma'
}

export const priceBandLabels: { [key in PriceBandTypes]: string } = {
  posTwoSigma: '+2σ',
  posOneSigma: '+σ',
  price: 'Actual Price',
  powerLaw: 'Power Law',
  negOneSigma: '-1σ',
  negTwoSigma: '-2σ'
};

export function generatePriceBands(
  startDate: Date,
  endDate: Date,
  dailyPriceData: DailyPriceDatum[],
  useXLog: boolean,
  maxPoints: number
): PriceBands {
  const priceBands: PriceBands = {
    posTwoSigma: [],
    posOneSigma: [],
    powerLaw: [],
    price: [],
    negOneSigma: [],
    negTwoSigma: []
  };

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

  const c = -38.16;
  const m = 5.71;

  const intercept = 2.777e-17; // ~= Math.exp(c)
  const slope = 5.71;
  const std_residuals = 0.7305045048910941;

  const start = dayjs(startDate);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const daysSinceGenesis = dayjs(start).diff('2009-01-03', 'day');

  const getPowerLawPrice = (x: number) => {
    return intercept * Math.pow(x + daysSinceGenesis, slope);
  };

  const getLinearLog = (x: number) => {
    return m * Math.log(x + daysSinceGenesis) + c;
  };

  const getSigma = (x: number, sigma?: number) => {
    switch (sigma) {
      case 2:
        return Math.exp(getLinearLog(x) + 2 * std_residuals);
      case 1:
        return Math.exp(getLinearLog(x) + std_residuals);
      case -1:
        return Math.exp(getLinearLog(x) + -1 * std_residuals);
      case -2:
      default:
        return Math.exp(getLinearLog(x) + -2 * std_residuals);
    }
  };

  const end = dayjs(endDate);
  const genesis = dayjs('2009-01-03');
  const totalPoints = end.diff(genesis, 'day');
  const numPoints = Math.min(maxPoints, totalPoints);

  const minp = 0;
  const maxp = numPoints - 1;
  const minv = Math.log(1);
  const maxv = Math.log(days);
  const power = 0.8; // Adjust this value to control the spread (lower values spread more; but reduce resolution)
  const scale = (maxv - minv) / (Math.pow(maxp, power) - Math.pow(minp, power));

  const logScale = (i: number) => {
    return Math.exp(minv + scale * (Math.pow(i, power) - Math.pow(minp, power)));
  };

  const linearScale = (i: number) => {
    return (i / (numPoints - 1)) * days;
  };

  let lastDate = '';

  const firstPriceDate = dayjs(dailyPriceData[0].date);
  const lastPriceDate = dayjs(dailyPriceData[dailyPriceData.length - 1].date);

  function populateBands(currentDate: dayjs.Dayjs, xDays: number) {
    const dailyPriceIndex = currentDate.diff(firstPriceDate, 'day');
    priceBands.price.push(
      dailyPriceData[dailyPriceIndex] || {
        date: currentDate.format('YYYY-MM-DD'),
        price: null
      }
    );
    priceBands.posTwoSigma.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: getSigma(xDays, 2)
    });
    priceBands.posOneSigma.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: getSigma(xDays, 1)
    });
    priceBands.powerLaw.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: getPowerLawPrice(xDays)
    });
    priceBands.negOneSigma.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: getSigma(xDays, -1)
    });
    priceBands.negTwoSigma.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: getSigma(xDays, -2)
    });
  }
  // populateBands(start, 0);

  for (let i = 0; i < numPoints; i++) {
    const dayOffset = Math.round(useXLog ? logScale(i) : linearScale(i));
    const currentDate = start.add(dayOffset, 'day');

    if (lastDate === currentDate.format('YYYY-MM-DD')) continue;

    if (firstPriceDate > dayjs(lastDate) && firstPriceDate < currentDate)
      populateBands(firstPriceDate, firstPriceDate.diff(start, 'day'));

    if (lastPriceDate > dayjs(lastDate) && lastPriceDate < currentDate)
      populateBands(dayjs(lastPriceDate), lastPriceDate.diff(start, 'day'));

    lastDate = currentDate.format('YYYY-MM-DD');

    const xDays = currentDate.diff(start, 'day');

    // Ensure we don't exceed the end date
    if (currentDate.isAfter(end)) {
      break;
    }

    populateBands(currentDate, xDays);
  }
  return priceBands;
}
