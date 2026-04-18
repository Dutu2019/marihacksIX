import { Ollama } from 'ollama';
import { log } from '../utils/logger.js';

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434'
});

const MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';

const PARSER_PROMPT = `You are an NLP intent parser for a stock research application.
Analyze the user's query and extract structured intent.

Respond with JSON in this exact format:
{
  "type": "ticker" | "sector_scan" | "asset_class" | "comparison",
  "tickers": ["AAPL"],
  "sector": "technology" | null,
  "asset_class": "stocks" | "bonds" | "etfs" | "crypto" | "commodities" | null,
  "filters": {
    "market_cap": "large" | "mid" | "small" | null,
    "dividend": boolean | null,
    "sector_keywords": []
  }
}

RULES:
1. If query contains a ticker symbol (e.g., AAPL, BTC-USD), set type="ticker" and add to tickers array
2. If query mentions a sector/industry (e.g., "clean energy", "tech stocks"), set type="sector_scan"
3. If query mentions asset class (e.g., "bonds", "ETFs", "crypto"), set asset_class accordingly
4. If query compares multiple assets (e.g., "AAPL vs MSFT"), set type="comparison"
5. Extract any filters like "large cap", "dividend", "growth", etc.

Examples:
- "AAPL" → {type: "ticker", tickers: ["AAPL"], ...}
- "clean energy stocks" → {type: "sector_scan", sector: "clean energy", asset_class: "stocks"}
- "investment grade bonds" → {type: "asset_class", asset_class: "bonds", filters: {quality: "investment_grade"}}
- "AAPL vs MSFT" → {type: "comparison", tickers: ["AAPL", "MSFT"]}`;

export async function parseQueryRoute(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    log(`Parsing query: "${query}"`);

    const response = await ollama.chat({
      model: MODEL,
      messages: [
        { role: 'system', content: PARSER_PROMPT },
        { role: 'user', content: `User query: "${query}"` }
      ],
      format: 'json',
      stream: false
    });

    const parsed = JSON.parse(response.message.content);
    const result = {
      raw_query: query,
      resolved: {
        type: parsed.type || 'ticker',
        tickers: parsed.tickers || [],
        sector: parsed.sector || null,
        asset_class: parsed.asset_class || 'stocks',
        filters: parsed.filters || {}
      }
    };

    log(`Parsed intent: ${result.resolved.type}`);
    res.json(result);
  } catch (error) {
    logError('Parse query error:', error.message);

    // Fallback: try to detect ticker symbols
    const tickerMatch = req.body.query.toUpperCase().match(/\b[A-Z]{1,5}(-USD)?\b/);
    const fallbackResult = {
      raw_query: req.body.query,
      resolved: {
        type: tickerMatch ? 'ticker' : 'sector_scan',
        tickers: tickerMatch ? [tickerMatch[0]] : [],
        sector: null,
        asset_class: 'stocks',
        filters: {}
      }
    };

    res.json(fallbackResult);
  }
}

function logError(...args) {
  console.error(`[${new Date().toISOString().split('T')[1].slice(0, 8)}]`, ...args);
}
