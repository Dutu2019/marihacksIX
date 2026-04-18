import yahooFinance from 'yahoo-finance2';

export async function get_yahoo_finance(ticker) {
  const startTime = Date.now();
  try {
    const quote = await yahooFinance.quote(ticker);
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics'] });

    return {
      status: 'success',
      data: {
        ticker: quote.symbol,
        company_name: quote.shortName || quote.longName,
        current_price: quote.regularMarketPrice,
        price_change_pct_1d: quote.regularMarketChangePercent,
        market_cap: quote.marketCap,
        pe_ratio: summary?.financialData?.currentPrice?.raw ? quote.trailingPE : null,
        week52_high: quote.fiftyTwoWeekHigh,
        week52_low: quote.fiftyTwoWeekLow,
        volume: quote.regularMarketVolume,
        avg_volume: quote.averageDailyVolume10Day,
        open: quote.regularMarketOpen,
        previous_close: quote.regularMarketPreviousClose
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

export async function getHistoricalPrices(ticker, period = '3mo') {
  try {
    const result = await yahooFinance.chart(ticker, { period });
    return result.quotes.map(q => ({
      date: q.date.toISOString().split('T')[0],
      close: q.close,
      high: q.high,
      low: q.low,
      open: q.open,
      volume: q.volume
    }));
  } catch {
    return [];
  }
}
