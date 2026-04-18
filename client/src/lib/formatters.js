export function formatPrice(price) {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function formatPercent(value) {
  if (value == null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatMarketCap(cap) {
  if (!cap) return 'N/A';
  if (typeof cap === 'string') return cap;
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap}`;
}

export function formatNumber(num) {
  if (num == null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getSentimentColor(sentiment) {
  switch (sentiment) {
    case 'positive': return 'text-emerald';
    case 'negative': return 'text-rose';
    default: return 'text-gray-400';
  }
}

export function getSentimentBg(sentiment) {
  switch (sentiment) {
    case 'positive': return 'bg-emerald/20 border-emerald/30';
    case 'negative': return 'bg-rose/20 border-rose/30';
    default: return 'bg-gray-700/20 border-gray-600/30';
  }
}

export function getChangeColor(value) {
  if (value == null) return 'text-gray-400';
  return value >= 0 ? 'text-emerald' : 'text-rose';
}

export function getRSIColor(rsi) {
  if (rsi == null) return 'text-gray-400';
  if (rsi > 70) return 'text-rose';
  if (rsi < 30) return 'text-emerald';
  return 'text-gray-300';
}

export function getRSILabel(rsi) {
  if (rsi == null) return 'N/A';
  if (rsi > 70) return 'Overbought';
  if (rsi < 30) return 'Oversold';
  return 'Neutral';
}
