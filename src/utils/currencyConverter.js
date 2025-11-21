import axios from 'axios';

let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 Hours

export const getExchangeRate = async (targetCurrency) => {
  const target = targetCurrency.toUpperCase();
  if (target === 'USD') return 1;

  const now = Date.now();
  if (!cachedRates || (now - lastFetchTime > CACHE_DURATION)) {
    try {
      const response = await axios.get('https://open.er-api.com/v6/latest/USD');
      if (response.data && response.data.rates) {
        cachedRates = response.data.rates;
        lastFetchTime = now;
      }
    } catch (error) {
      console.error('Failed to fetch rates:', error.message);
      return 1; // Fallback to USD
    }
  }
  return cachedRates[target] || 1;
};