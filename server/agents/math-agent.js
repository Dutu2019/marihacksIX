export async function calculate_metrics(prices, ticker) {
  const startTime = Date.now();
  try {
    if (!prices || prices.length < 2) {
      return {
        status: 'failed',
        error: 'Insufficient price data',
        duration_ms: Date.now() - startTime
      };
    }

    const closes = prices.map(p => p.close).filter(c => c != null);
    if (closes.length < 14) {
      return {
        status: 'failed',
        error: 'Need at least 14 days of data',
        duration_ms: Date.now() - startTime
      };
    }

    return {
      status: 'success',
      data: {
        rsi_14: calculateRSI(closes, 14),
        ma_50: calculateMA(closes, 50),
        ma_200: calculateMA(closes, 200),
        volatility_30d: calculateVolatility(closes, 30),
        sharpe_ratio: calculateSharpe(closes),
        beta: null // Would need market data
      },
      duration_ms: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error.message,
      duration_ms: Date.now() - startTime
    };
  }
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const rs = losses === 0 ? 100 : gains / losses;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calculateMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return parseFloat((sum / period).toFixed(2));
}

function calculateVolatility(closes, period = 30) {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-period - 1);

  const returns = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualized volatility
  return parseFloat((stdDev * Math.sqrt(252)).toFixed(4));
}

function calculateSharpe(closes, riskFreeRate = 0.05) {
  if (closes.length < 30) return null;

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(closes[i] / closes[i - 1] - 1);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);

  if (stdDev === 0) return null;
  const annualizedReturn = avgReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);

  return parseFloat(((annualizedReturn - riskFreeRate) / annualizedStdDev).toFixed(2));
}
