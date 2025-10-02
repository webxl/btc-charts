export const fetchLatestPrice = async () => {
  const response = await fetch('/api/latestprice');
  const data = await response.json();
  return data.price;
};
