import yahooFinance from 'yahoo-finance2';

export async function get_analyst_ratings(ticker) {
  const startTime = Date.now();
  try {
    const recommendationTrend = await yahooFinance.quoteSummary(ticker, { modules: ['recommendationTrend'] });
    const upgradeDowgradeHistory = await yahooFinance.quoteSummary(ticker, { modules: ['upgradeDowngradeHistory'] });

    const trends = recommendationTrend?.recommendationTrend?.trend || [];
    const currentRatings = trends.find(t => t.period === '0m') || {};

    const strongBuy = currentRatings.strongBuy || 0;
    const buy = currentRatings.buy || 0;
    const hold = currentRatings.hold || 0;
    const sell = currentRatings.sell || 0;
    const strongSell = currentRatings.strongSell || 0;

    const total = strongBuy + buy + hold + sell + strongSell;
    const consensus = calculateConsensus(strongBuy, buy, hold, sell, strongSell);
    const consensusScore = ((strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / total) || 3;

    // Get price targets
    const financialData = await yahooFinance.quoteSummary(ticker, { modules: ['financialData'] });
    const targetMeanPrice = financialData?.financialData?.targetMeanPrice?.raw;
    const targetHigh = financialData?.financialData?.targetHighPrice?.raw;
    const targetLow = financialData?.financialData?.targetLowPrice?.raw;
    const currentPrice = financialData?.financialData?.currentPrice?.raw;

    const recentChanges = (upgradeDowgradeHistory?.upgradeDowngradeHistory?.history || []).slice(0, 5).map(h => ({
      firm: h.firm,
      action: h.action,
      from_grade: h.fromGrade,
      to_grade: h.toGrade,
      date: new Date(h.epochGradeDate * 1000).toISOString()
    }));

    return {
      status: 'success',
      data: {
        consensus,
        consensus_score: parseFloat(consensusScore.toFixed(2)),
        total_analysts: total,
        breakdown: { strongBuy, buy, hold, sell, strongSell },
        price_target: {
          mean: targetMeanPrice,
          high: targetHigh,
          low: targetLow,
          current: currentPrice,
          upside: targetMeanPrice && currentPrice ? ((targetMeanPrice - currentPrice) / currentPrice * 100).toFixed(1) : null
        },
        recent_changes: recentChanges
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

function calculateConsensus(strongBuy, buy, hold, sell, strongSell) {
  const total = strongBuy + buy + hold + sell + strongSell;
  if (total === 0) return 'Hold';

  const score = (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / total;

  if (score >= 4.5) return 'Strong Buy';
  if (score >= 3.5) return 'Buy';
  if (score >= 2.5) return 'Hold';
  if (score >= 1.5) return 'Sell';
  return 'Strong Sell';
}
