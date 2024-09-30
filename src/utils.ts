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

// export const formatCurrency = (val: number) => numberFormat.format(val);
export const formatCurrency = (val: number) =>
  `${val <= -1 ? '-' : ''}` + currencyFormat.format(val);

export const formatCurrencyWithCents = (val: number) => currencyFormatWithCents.format(val);

export const formatPercentage = (val: number) => percentageFormat.format(val);
