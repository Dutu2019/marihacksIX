import yahooFinance from 'yahoo-finance2';

// Sector to ETF/industry mapping for scanning
const SECTOR_MAP = {
  'technology': ['XLK', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'CRM', 'AMD'],
  'healthcare': ['XLV', 'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY'],
  'financial': ['XLF', 'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP'],
  'consumer': ['XLY', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 'TGT', 'CMG'],
  'energy': ['XLE', 'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY'],
  'utilities': ['XLU', 'NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'SRE', 'XEL', 'ED'],
  'materials': ['XLB', 'LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM', 'DOW', 'DD', 'PPG'],
  'industrials': ['XLI', 'CAT', 'UNP', 'HON', 'UPS', 'RTX', 'LMT', 'BA', 'GE', 'DE'],
  'real estate': ['XLRE', 'AMT', 'PLD', 'CCI', 'EQIX', 'SPG', 'PSA', 'WELL', 'DLR', 'O'],
  'communication': ['XLC', 'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'TMUS', 'CHTR'],
  'clean energy': ['ICLN', 'ENPH', 'SEDG', 'FSLR', 'RUN', 'PLUG', 'BE', 'NEE', 'ORSTED', 'VWDRY'],
  'crypto': ['BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'AVAX-USD', 'DOT-USD', 'DOGE-USD', 'MATIC-USD']
};

export async function scan_sector(sector, assetClass = 'stocks') {
  const startTime = Date.now();
  try {
    let tickers = [];

    // Map sector to known tickers
    const sectorKey = Object.keys(SECTOR_MAP).find(k =>
      sector.toLowerCase().includes(k) || k.includes(sector.toLowerCase())
    );

    if (sectorKey) {
      tickers = SECTOR_MAP[sectorKey];
    } else {
      // Try ETF-based approach for unknown sectors
      tickers = await scanViaETF(sector);
    }

    // Get basic metrics for each ticker
    const results = await Promise.all(
      tickers.slice(0, 10).map(async ticker => {
        try {
          const quote = await yahooFinance.quote(ticker);
          return {
            ticker,
            name: quote.shortName || ticker,
            price: quote.regularMarketPrice,
            change_pct: quote.regularMarketChangePercent,
            market_cap: quote.marketCap,
            volume: quote.regularMarketVolume
          };
        } catch {
          return { ticker, name: ticker, error: 'Data unavailable' };
        }
      })
    );

    return {
      status: 'success',
      data: {
        sector: sectorKey || sector,
        tickers: results.filter(r => !r.error)
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

async function scanViaETF(sector) {
  // Fallback: return major sector ETFs
  const sectorETFs = {
    'tech': 'XLK', 'health': 'XLV', 'finance': 'XLF', 'energy': 'XLE',
    'utility': 'XLU', 'material': 'XLB', 'industrial': 'XLI', 'consumer': 'XLY',
    'real estate': 'XLRE', 'communication': 'XLC'
  };

  for (const [key, etf] of Object.entries(sectorETFs)) {
    if (sector.toLowerCase().includes(key)) {
      return [etf];
    }
  }
  return [];
}
