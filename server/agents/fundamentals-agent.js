import yahooFinance from 'yahoo-finance2';

export async function get_financials(ticker) {
  const startTime = Date.now();
  try {
    const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
      yahooFinance.quoteSummary(ticker, { modules: ['incomeStatementHistory', 'incomeStatementHistoryQuarterly'] }).catch(() => null),
      yahooFinance.quoteSummary(ticker, { modules: ['balanceSheetHistory', 'balanceSheetHistoryQuarterly'] }).catch(() => null),
      yahooFinance.quoteSummary(ticker, { modules: ['cashflowStatementHistory', 'cashflowStatementHistoryQuarterly'] }).catch(() => null)
    ]);

    return {
      status: 'success',
      data: {
        income_statement: incomeStatement?.incomeStatementHistory?.incomeStatementHistory?.[0] || null,
        balance_sheet: balanceSheet?.balanceSheetHistory?.balanceSheetStatements?.[0] || null,
        cash_flow: cashFlow?.cashflowStatementHistory?.cashflowStatements?.[0] || null,
        key_metrics: await getKeyMetrics(ticker)
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

async function getKeyMetrics(ticker) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['financialData', 'defaultKeyStatistics'] });
    return {
      revenue: summary?.financialData?.totalRevenue?.raw,
      gross_margin: summary?.financialData?.grossMargins?.raw,
      operating_margin: summary?.financialData?.operatingMargins?.raw,
      profit_margin: summary?.financialData?.profitMargins?.raw,
      roe: summary?.defaultKeyStatistics?.returnOnEquity?.raw,
      roa: summary?.defaultKeyStatistics?.returnOnAssets?.raw,
      debt_to_equity: summary?.financialData?.debtToEquity?.raw,
      current_ratio: summary?.financialData?.currentRatio?.raw,
      free_cash_flow: summary?.financialData?.freeCashflow?.raw
    };
  } catch {
    return null;
  }
}
