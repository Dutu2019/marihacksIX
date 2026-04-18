export async function trendingRoute(req, res) {
  // Popular tickers for landing page
  const trending = [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'NVDA', name: 'NVIDIA Corp' },
    { ticker: 'TSLA', name: 'Tesla Inc' },
    { ticker: 'MSFT', name: 'Microsoft' },
    { ticker: 'AMZN', name: 'Amazon.com' },
    { ticker: 'GOOGL', name: 'Alphabet Inc' },
    { ticker: 'META', name: 'Meta Platforms' },
    { ticker: 'BTC-USD', name: 'Bitcoin' }
  ];

  res.json({ trending });
}
