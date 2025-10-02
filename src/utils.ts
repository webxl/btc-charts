import { format } from 'd3-format';

const userLocale = navigator.language;

const currencyFormat = new Intl.NumberFormat(userLocale, {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'never',
  maximumFractionDigits: 0
});

const currencyFormatWithCents = new Intl.NumberFormat(userLocale, {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'never',
  maximumFractionDigits: 2
});

const percentageFormat = new Intl.NumberFormat(userLocale, {
  style: 'percent',
  maximumFractionDigits: 2
});

export const formatCurrency = (val: number) =>
  `${val <= -1 ? '-' : ''}` + currencyFormat.format(val);

export const formatCurrencyForAxis = (val: number) =>
  val >= 1 ? format('>-$,.1s')(val) : format('$,.2f')(val);

export const formatCurrencyWithCents = (val: number) => currencyFormatWithCents.format(val);

export const formatPercentage = (val: number) => percentageFormat.format(val);

export const convertToRomanNumeral = (num: number) => {
  const romanNumerals = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1
  };
  let roman = '';
  for (let key of Object.keys(romanNumerals)) {
    let matches = Math.floor(num / romanNumerals[key as keyof typeof romanNumerals]);
    roman += key.repeat(matches);
    num -= matches * romanNumerals[key as keyof typeof romanNumerals];
  }
  return roman;
};
