import { DailyPriceDatum } from './calc';
import dayjs from 'dayjs';

const apiUrl = (import.meta.env.VITE_API_URL as string) || '/api';

export const fetchData = async (callback: (data: DailyPriceDatum[]) => void) => {
  try {
    const data: DailyPriceDatum[] = await fetch(`${apiUrl}/timeseries`)
      .then(r => {
        if (!r.ok) {
          throw new Error('Invalid network response');
        }
        return r.json() as Promise<DailyPriceDatum[]>;
      })
      .then(data => {
        let _lastDate = dayjs(data[0].date);
        const _dailyPriceData = [...data];
        for (let i = 0; i < data.length; i++) {
          const currentDate = dayjs(data[i].date);
          const numDays = currentDate.diff(_lastDate, 'day');
          if (numDays > 1) {
            console.log(
              'Missing data between',
              _lastDate.format('YYYY-MM-DD'),
              'and',
              currentDate.format('YYYY-MM-DD')
            );
            // fill missing points
            for (let j = 0; j < numDays; j++) {
              _dailyPriceData.splice(i + j, 0, {
                date: _lastDate.add(j + 1, 'day').format('YYYY-MM-DD'),
                price: _dailyPriceData[i].price
              });
            }
          }
          _lastDate = currentDate;
        }

        return _dailyPriceData;
      });
    callback(data);
  } catch (e) {
    console.error(e);
  }
};

export const fetchLatestPrice = async () => {
  const response = await fetch(`${apiUrl}/latestprice`);
  const data = await response.json();
  return data.price;
};
