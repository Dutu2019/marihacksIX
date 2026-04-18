import { CoordinatorAgent } from '../harness/coordinator.js';
import { cache, getCacheKey } from '../utils/cache.js';
import { log, logError } from '../utils/logger.js';
import yahooFinance from 'yahoo-finance2';
import { getHistoricalPrices } from '../agents/price-agent.js';
import { fetch_news_articles } from '../agents/news-agent.js';
import { get_analyst_ratings } from '../agents/analyst-ratings-agent.js';
import { calculate_metrics } from '../agents/math-agent.js';

// Direct research execution (bypasses coordinator for more reliable results)
async function executeDirectResearch(intent, onProgress) {
  const agentTrace = [];
  const assets = [];

  const { type, tickers, sector } = intent.resolved;

  // Determine which tickers to research
  let researchTickers = tickers;
  let sectorOverview = null;

  if (type === 'sector_scan' && sector) {
    onProgress?.({ agent: 'sector_scanner', status: 'running' });
    const sectorStart = Date.now();

    // Import dynamically to avoid circular deps
    const { scan_sector } = await import('../agents/sector-scanner-agent.js');
    const sectorResult = await scan_sector(sector);

    agentTrace.push({
      agent: 'sector_scanner',
      status: sectorResult.status,
      duration_ms: Date.now() - sectorStart
    });

    if (sectorResult.status === 'success') {
      researchTickers = sectorResult.data.tickers.slice(0, 5).map(t => t.ticker);
      sectorOverview = `Top ${sectorResult.data.tickers.length} companies in ${sectorResult.data.sector} sector`;
    }
  }

  // If no tickers identified, use defaults
  if (!researchTickers || researchTickers.length === 0) {
    researchTickers = ['AAPL'];
  }

  // Research each ticker
  for (const ticker of researchTickers) {
    log(`Researching: ${ticker}`);
    const assetData = await researchTicker(ticker, agentTrace, onProgress);
    if (assetData) {
      assets.push(assetData);
    }
  }

  return {
    query_summary: intent.raw_query,
    report_type: type,
    generated_at: new Date().toISOString(),
    assets,
    sector_overview: sectorOverview,
    macro_context: null,
    overall_sentiment: calculateOverallSentiment(assets),
    confidence_score: 0.85,
    data_sources: ['Yahoo Finance', 'DuckDuckGo'],
    agent_trace: agentTrace
  };
}

async function researchTicker(ticker, agentTrace, onProgress) {
  try {
    // Price data
    onProgress?.({ agent: 'price_agent', status: 'running', ticker });
    const priceStart = Date.now();
    const { get_yahoo_finance } = await import('../agents/price-agent.js');
    const priceResult = await get_yahoo_finance(ticker);
    agentTrace.push({ agent: 'price_agent', status: priceResult.status, duration_ms: Date.now() - priceStart });

    if (priceResult.status === 'failed') return null;

    // Historical prices for technicals
    onProgress?.({ agent: 'historical_prices', status: 'running', ticker });
    const prices = await getHistoricalPrices(ticker, '3mo');

    // Technical metrics
    onProgress?.({ agent: 'math_agent', status: 'running', ticker });
    const mathStart = Date.now();
    const mathResult = await calculate_metrics(prices, ticker);
    agentTrace.push({ agent: 'math_agent', status: mathResult.status, duration_ms: Date.now() - mathStart });

    // News
    onProgress?.({ agent: 'news_agent', status: 'running', ticker });
    const newsStart = Date.now();
    const newsResult = await fetch_news_articles(ticker, 5);
    agentTrace.push({ agent: 'news_agent', status: newsResult.status, duration_ms: Date.now() - newsStart });

    // Analyst ratings
    onProgress?.({ agent: 'analyst_ratings', status: 'running', ticker });
    const ratingsStart = Date.now();
    const ratingsResult = await get_analyst_ratings(ticker);
    agentTrace.push({ agent: 'analyst_ratings', status: ratingsResult.status, duration_ms: Date.now() - ratingsStart });

    // Generate AI summary
    const aiSummary = generateAISummary(priceResult.data, mathResult.data, ratingsResult.data);
    const { keyRisks, keyCatalysts } = generateRisksAndCatalysts(priceResult.data, newsResult.data);

    return {
      ticker,
      company_name: priceResult.data.company_name,
      current_price: priceResult.data.current_price,
      price_change_pct_1d: parseFloat(priceResult.data.price_change_pct_1d?.toFixed(2)) || 0,
      market_cap: formatMarketCap(priceResult.data.market_cap),
      pe_ratio: priceResult.data.pe_ratio ? parseFloat(priceResult.data.pe_ratio.toFixed(1)) : null,
      week52_high: priceResult.data.week52_high,
      week52_low: priceResult.data.week52_low,
      analyst_consensus: ratingsResult.data?.consensus || 'Hold',
      analyst_price_target: ratingsResult.data?.price_target?.mean,
      technicals: {
        rsi_14: mathResult.data?.rsi_14 || 50,
        ma_50: mathResult.data?.ma_50,
        ma_200: mathResult.data?.ma_200,
        volatility_30d: mathResult.data?.volatility_30d
      },
      news: newsResult.data || [],
      ai_summary: aiSummary,
      key_risks: keyRisks,
      key_catalysts: keyCatalysts
    };
  } catch (error) {
    logError(`Error researching ${ticker}:`, error.message);
    return null;
  }
}

function generateAISummary(priceData, technicals, ratings) {
  const priceChange = priceData.price_change_pct_1d || 0;
  const direction = priceChange >= 0 ? 'gaining' : 'down';
  const rsi = technicals?.rsi_14 || 50;
  const rsiSignal = rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';
  const consensus = ratings?.consensus || 'Hold';

  return `${priceData.company_name} is ${direction} ${Math.abs(priceChange)}% today. RSI at ${rsi} indicates ${rsiSignal} conditions. Analyst consensus: ${consensus}.`;
}

function generateRisksAndCatalysts(priceData, news) {
  const keyRisks = [];
  const keyCatalysts = [];

  // Risks
  if (priceData.pe_ratio > 30) keyRisks.push('High valuation multiples');
  if (priceData.price_change_pct_1d < -3) keyRisks.push('Recent price weakness');
  if (priceData.week52_high && priceData.current_price > priceData.week52_high * 0.95) {
    keyRisks.push('Trading near 52-week highs');
  }

  // Catalysts
  const positiveNews = (news || []).filter(n => n.sentiment === 'positive').slice(0, 2);
  if (positiveNews.length > 0) {
    keyCatalysts.push(positiveNews[0].headline);
  }
  if (priceData.price_change_pct_1d > 3) {
    keyCatalysts.push('Strong momentum');
  }

  return {
    keyRisks: keyRisks.slice(0, 3),
    keyCatalysts: keyCatalysts.slice(0, 3)
  };
}

function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap}`;
}

function calculateOverallSentiment(assets) {
  if (assets.length === 0) return 'neutral';
  const avgChange = assets.reduce((sum, a) => sum + (a.price_change_pct_1d || 0), 0) / assets.length;
  if (avgChange > 1) return 'bullish';
  if (avgChange < -1) return 'bearish';
  return 'neutral';
}

export async function researchRoute(req, res) {
  try {
    const intent = req.body.intent;
    if (!intent) {
      return res.status(400).json({ error: 'Intent is required' });
    }

    // Check cache
    const cacheKey = getCacheKey('research', intent.raw_query);
    const cached = cache.get(cacheKey);
    if (cached) {
      log('Cache hit for:', intent.raw_query);
      return res.json(cached);
    }

    log('Starting research for:', intent.raw_query);

    const agentTrace = [];
    const onProgress = (event) => {
      // For non-streaming, just log
      log(`Progress: ${event.agent} - ${event.status}`);
    };

    const result = await executeDirectResearch(intent, onProgress);

    // Cache the result
    cache.set(cacheKey, result);

    res.json(result);
  } catch (error) {
    logError('Research error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function researchStreamRoute(req, res) {
  try {
    const intent = req.body.intent;
    if (!intent) {
      return res.status(400).json({ error: 'Intent is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({ type: 'start', query: intent.raw_query });

    const agentTrace = [];
    const onProgress = (event) => {
      sendEvent({ type: 'progress', ...event });
    };

    const result = await executeDirectResearch(intent, onProgress);

    sendEvent({ type: 'complete', result });

    res.end();
  } catch (error) {
    logError('Stream error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
}
