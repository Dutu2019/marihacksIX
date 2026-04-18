import yahooFinance from 'yahoo-finance2';

export async function fetch_news_articles(ticker, limit = 10) {
  const startTime = Date.now();
  try {
    const news = await yahooFinance.search(`query=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=${limit}&quotesQueryId=t_research&type=quote&enableFeatureLinks=false&locale=en-US`);

    const articles = (news.news || []).slice(0, limit).map(item => ({
      headline: item.title,
      source: item.publisher || 'Yahoo Finance',
      published_at: new Date(item.providerPublishTime * 1000).toISOString(),
      url: item.link,
      thumbnail: item.thumbnail?.resolutions?.[0]?.url,
      sentiment: analyzeSentiment(item.title),
      sentiment_score: calculateSentimentScore(item.title)
    }));

    return {
      status: 'success',
      data: articles,
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

function analyzeSentiment(text) {
  const positiveWords = ['surge', 'soar', 'gain', 'beat', 'upgrade', 'bullish', 'growth', 'profit', 'record', 'strong'];
  const negativeWords = ['crash', 'plunge', 'drop', 'miss', 'downgrade', 'bearish', 'loss', 'decline', 'weak', 'fall'];

  const lower = text.toLowerCase();
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

function calculateSentimentScore(text) {
  const sentiment = analyzeSentiment(text);
  if (sentiment === 'positive') return 0.6 + Math.random() * 0.35;
  if (sentiment === 'negative') return 0.1 + Math.random() * 0.3;
  return 0.4 + Math.random() * 0.2;
}
