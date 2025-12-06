import axios from 'axios';

let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 Hours

export const getExchangeRate = async (targetCurrency) => {
  try {
    // Handle null/undefined currency
    if (!targetCurrency) return 1;
    
    const target = targetCurrency.toString().toUpperCase();
    if (target === 'USD') return 1;

    const now = Date.now();
    
    // Check if we need to fetch new rates
    if (!cachedRates || (now - lastFetchTime > CACHE_DURATION)) {
      console.log('📊 Fetching fresh exchange rates...');
      
      try {
        const response = await axios.get('https://open.er-api.com/v6/latest/USD', {
          timeout: 5000 // 5 second timeout
        });
        
        if (response.data && response.data.rates) {
          cachedRates = response.data.rates;
          lastFetchTime = now;
          console.log('✅ Exchange rates updated successfully');
        } else {
          console.warn('⚠️ Invalid response structure from exchange rate API');
          if (!cachedRates) cachedRates = { USD: 1 }; // Initialize with default
        }
      } catch (fetchError) {
        console.error('❌ Failed to fetch exchange rates:', fetchError.message);
        // If we have cached rates, use them even if expired
        if (!cachedRates) {
          cachedRates = { USD: 1 }; // Fallback rates
        }
      }
    }
    
    // Return the rate or fallback to 1
    const rate = cachedRates[target];
    
    if (!rate) {
      console.warn(`⚠️ No exchange rate found for ${target}, using 1`);
      return 1;
    }
    
    console.log(`💱 Exchange rate: 1 USD = ${rate} ${target}`);
    return rate;
    
  } catch (error) {
    console.error('❌ Error in getExchangeRate:', error);
    return 1; // Always fallback to 1 on any error
  }
};

// Optional: Add a function to manually refresh rates
export const refreshExchangeRates = async () => {
  lastFetchTime = 0; // Force refresh
  return await getExchangeRate('EUR'); // Trigger a fetch
};

// Optional: Get all available currencies
export const getAvailableCurrencies = () => {
  if (cachedRates) {
    return Object.keys(cachedRates);
  }
  return ['USD']; // Default fallback
};

// Optional: Check if rates are stale
export const areRatesStale = () => {
  const now = Date.now();
  return !cachedRates || (now - lastFetchTime > CACHE_DURATION);
};