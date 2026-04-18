import { ExternalLink } from 'lucide-react';
import { getSentimentBg, getSentimentColor, formatDate } from '../lib/formatters';

export default function NewsItem({ article, compact = false }) {
  const { headline, source, published_at, url, sentiment, sentiment_score } = article;

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        <div className={`p-2 rounded-lg border ${getSentimentBg(sentiment)} hover:border-gray-600 transition-all`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-gray-300 line-clamp-2 flex-1 group-hover:text-gray-100">
              {headline}
            </p>
            <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span className={getSentimentColor(sentiment)}>{sentiment}</span>
            <span>•</span>
            <span>{source}</span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className={`p-4 rounded-xl border ${getSentimentBg(sentiment)} hover:border-gray-600 transition-all`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="text-gray-100 font-medium group-hover:text-emerald transition-colors line-clamp-2">
            {headline}
          </h4>
          <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1" />
        </div>

        {article.snippet && (
          <p className="text-gray-500 text-sm line-clamp-2 mb-3">{article.snippet}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className={`font-medium ${getSentimentColor(sentiment)}`}>
            {sentiment} {sentiment_score && `(${(sentiment_score * 100).toFixed(0)})`}
          </span>
          <span>•</span>
          <span>{source}</span>
          <span>•</span>
          <span>{formatDate(published_at)}</span>
        </div>
      </div>
    </a>
  );
}
