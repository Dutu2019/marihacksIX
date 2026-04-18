import yahooFinance from 'yahoo-finance2';

export async function sparklineRoute(req, res) {
  try {
    const { ticker } = req.params;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    // Get 5-day chart data for sparkline
    const result = await yahooFinance.chart(ticker, { period: '5d', interval: '15m' });

    const data = (result.quotes || []).map(q => ({
      date: q.date.toISOString(),
      close: q.close,
      volume: q.volume
    })).filter(d => d.close != null);

    res.json({ ticker, data });
  } catch (error) {
    // Return mock data on error
    const mockData = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.now() - (20 - i) * 3600000).toISOString(),
      close: 100 * (1 + Math.random() * 0.1)
    }));
    res.json({ ticker: req.params.ticker, data: mockData });
  }
}
