import { get_yahoo_finance, getHistoricalPrices } from '../agents/price-agent.js';
import { fetch_news_articles } from '../agents/news-agent.js';
import { web_search } from '../agents/web-search-agent.js';
import { get_financials } from '../agents/fundamentals-agent.js';
import { scan_sector } from '../agents/sector-scanner-agent.js';
import { calculate_metrics } from '../agents/math-agent.js';
import { get_analyst_ratings } from '../agents/analyst-ratings-agent.js';

export const toolRegistry = {
  get_yahoo_finance: {
    description: 'Fetch OHLCV price data, market cap, P/E ratio, and 52-week range for a ticker',
    parameters: { ticker: 'string' },
    handler: get_yahoo_finance
  },
  get_historical_prices: {
    description: 'Fetch historical price data for technical analysis',
    parameters: { ticker: 'string', period: 'string (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)' },
    handler: async ({ ticker, period }) => ({ status: 'success', data: await getHistoricalPrices(ticker, period), duration_ms: 0 })
  },
  fetch_news_articles: {
    description: 'Fetch recent news articles with sentiment analysis for a ticker',
    parameters: { ticker: 'string', limit: 'number (default 10)' },
    handler: fetch_news_articles
  },
  web_search: {
    description: 'Search the web for general information and context',
    parameters: { query: 'string', limit: 'number (default 5)' },
    handler: web_search
  },
  get_financials: {
    description: 'Fetch income statement, balance sheet, cash flow, and key financial metrics',
    parameters: { ticker: 'string' },
    handler: get_financials
  },
  scan_sector: {
    description: 'Scan a sector and return top 10 tickers with basic metrics',
    parameters: { sector: 'string', asset_class: 'string (stocks, etfs, crypto)' },
    handler: scan_sector
  },
  calculate_metrics: {
    description: 'Calculate technical indicators: RSI, moving averages, volatility, Sharpe ratio',
    parameters: { ticker: 'string', prices: 'array of {date, close, high, low, open, volume}' },
    handler: async ({ ticker, prices }) => calculate_metrics(prices, ticker)
  },
  get_analyst_ratings: {
    description: 'Fetch analyst consensus ratings and price targets',
    parameters: { ticker: 'string' },
    handler: get_analyst_ratings
  }
};

export function getToolDefinitions() {
  return Object.entries(toolRegistry).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

export async function executeTool(name, args) {
  const tool = toolRegistry[name];
  if (!tool) {
    return { status: 'failed', error: `Unknown tool: ${name}` };
  }
  try {
    return await tool.handler(args);
  } catch (error) {
    return { status: 'failed', error: error.message };
  }
}
