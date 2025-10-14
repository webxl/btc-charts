import dayjs from 'dayjs';
import { powerLawIntercept, powerLawSlope, powerLawStdResiduals } from './const';
export type AnalysisFormData = {
  analysisStart: string;
  analysisEnd: string;
  dataStart?: string;
  dataEnd?: string;
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

export function getPowerLawDelta(price: number) {
  const daysSinceGenesis = dayjs().diff('2009-01-03', 'day');
  const powerLawPrice = powerLawIntercept * Math.pow(daysSinceGenesis, powerLawSlope);
  return (price - powerLawPrice) / powerLawPrice;
}

export function generatePriceBands(
  startDate: Date,
  endDate: Date,
  dailyPriceData: DailyPriceDatum[],
  latestPrice: number,
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

  const intercept = powerLawIntercept;
  const slope = powerLawSlope;
  const std_residuals = powerLawStdResiduals;
  const c = Math.log(intercept);

  const start = dayjs(startDate);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const daysSinceGenesis = dayjs(start).diff('2009-01-03', 'day');

  const getPowerLawPrice = (x: number) => {
    return intercept * Math.pow(x + daysSinceGenesis, slope);
  };

  const getLinearLog = (x: number) => {
    return slope * Math.log(x + daysSinceGenesis) + c;
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

  if (!dailyPriceData.length) return priceBands;

  const firstPriceDate = dayjs(dailyPriceData[0].date);

  function populateBands(currentDate: dayjs.Dayjs, xDays: number, priceOverride?: number) {
    const dailyPriceIndex = currentDate.diff(firstPriceDate, 'day');
    const historicalPrice = dailyPriceData[dailyPriceIndex];
    priceBands.price.push({
      date: currentDate.format('YYYY-MM-DD'),
      price: historicalPrice?.price || (priceOverride ? priceOverride : 0)
    });
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

  let lastDate = dayjs();

  // sample numPoints points
  for (let i = 0; i < numPoints; i++) {
    const dayOffset = Math.round(useXLog ? logScale(i) : linearScale(i));
    const currentDate = start.add(dayOffset, 'day');

    if (currentDate.isSame(lastDate)) continue;

    // include first and last prices
    if (firstPriceDate.isAfter(dayjs(lastDate)) && firstPriceDate.isBefore(currentDate))
      populateBands(firstPriceDate, firstPriceDate.diff(start, 'day'));

    lastDate = currentDate;

    // Ensure we don't exceed the end date
    if (currentDate.isAfter(end)) {
      break;
    }

    populateBands(currentDate, currentDate.diff(start, 'day'));
  }
  const today = dayjs().startOf('day');

  if (latestPrice && today.isBefore(end) && today.isAfter(start)) {
    const idx = priceBands.price.findIndex(p => p.date === today.format('YYYY-MM-DD'));
    if (idx !== -1) {
      priceBands.price[idx].price = latestPrice;
    } else {
      const xDays = today.diff(start, 'day');
      if (xDays >= 0) {
        const insertIndex = priceBands.price.findIndex(p => dayjs(p.date).isAfter(today));
        const targetIndex = insertIndex === -1 ? priceBands.price.length : insertIndex;
        const todayStr = today.format('YYYY-MM-DD');
        priceBands.price.splice(targetIndex, 0, { date: todayStr, price: latestPrice });
        priceBands.posTwoSigma.splice(targetIndex, 0, {
          date: todayStr,
          price: getSigma(xDays, 2)
        });
        priceBands.posOneSigma.splice(targetIndex, 0, {
          date: todayStr,
          price: getSigma(xDays, 1)
        });
        priceBands.powerLaw.splice(targetIndex, 0, {
          date: todayStr,
          price: getPowerLawPrice(xDays)
        });
        priceBands.negOneSigma.splice(targetIndex, 0, {
          date: todayStr,
          price: getSigma(xDays, -1)
        });
        priceBands.negTwoSigma.splice(targetIndex, 0, {
          date: todayStr,
          price: getSigma(xDays, -2)
        });
      }
    }
  }

  return priceBands;
}
