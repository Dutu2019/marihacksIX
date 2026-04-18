export default function SentimentBadge({ sentiment, size = 'md' }) {
  const config = {
    bullish: { bg: 'bg-emerald/20', border: 'border-emerald/30', text: 'text-emerald', label: 'Bullish' },
    bearish: { bg: 'bg-rose/20', border: 'border-rose/30', text: 'text-rose', label: 'Bearish' },
    neutral: { bg: 'bg-gray-700/20', border: 'border-gray-600/30', text: 'text-gray-400', label: 'Neutral' },
    mixed: { bg: 'bg-purple/20', border: 'border-purple/30', text: 'text-purple-400', label: 'Mixed' }
  };

  const style = config[sentiment?.toLowerCase()] || config.neutral;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${style.bg} ${style.border} ${style.text} ${sizeClasses[size]}`}>
      {style.label}
    </span>
  );
}
