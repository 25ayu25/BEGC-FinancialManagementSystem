import { CURRENCIES } from "./constants";

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const currencyInfo = CURRENCIES[currency as keyof typeof CURRENCIES];
  // Round to whole dollars to avoid cent display
  const roundedAmount = Math.round(amount || 0);
  
  if (!currencyInfo) {
    // Return USD format as fallback for unknown currencies
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(roundedAmount);
  }

  if (currency === "USD") {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(roundedAmount);
  }

  return `${currencyInfo.symbol} ${roundedAmount.toLocaleString('en-US')}`;
}

export function parseCurrency(value: string): { amount: number; currency: string } {
  // Remove currency symbols and parse
  const cleanValue = value.replace(/[$,\s]/g, '');
  const amount = parseFloat(cleanValue) || 0;
  
  // Detect currency from symbols
  if (value.includes('$')) {
    return { amount, currency: 'USD' };
  } else if (value.includes('SSP')) {
    return { amount, currency: 'SSP' };
  }
  
  return { amount, currency: 'USD' }; // default
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  // TODO: Implement real currency conversion rates
  // For now, using mock exchange rate
  if (fromCurrency === toCurrency) return amount;
  
  if (fromCurrency === "USD" && toCurrency === "SSP") {
    return amount * 1320; // Mock exchange rate
  }
  
  if (fromCurrency === "SSP" && toCurrency === "USD") {
    return amount / 1320; // Mock exchange rate
  }
  
  return amount;
}
