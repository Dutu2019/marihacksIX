import { TrendingUp, TrendingDown, Star, AlertTriangle, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { formatPrice, formatPercent, getChangeColor, getRSIColor, getRSILabel } from '../lib/formatters';
import Sparkline from './Sparkline';
import SentimentBadge from './SentimentBadge';
import NewsItem from './NewsItem';

export default function AssetCard({ asset, index = 0 }) {
  const isPositive = asset.price_change_pct_1d >= 0;

  return (
    <div
      className="bg-surface border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all animate-stagger"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-100 font-mono">{asset.ticker}</h3>
            <span className="text-xs px-2 py-0.5 bg-surfaceHighlight rounded-full text-gray-400">
              {asset.analyst_consensus}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">{asset.company_name}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono">{formatPrice(asset.current_price)}</div>
          <div className={`flex items-center justify-end gap-1 font-mono text-sm ${getChangeColor(asset.price_change_pct_1d)}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {formatPercent(asset.price_change_pct_1d)}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-16 mb-4 -mx-2">
        <Sparkline ticker={asset.ticker} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Metric label="Market Cap" value={asset.market_cap} />
        <Metric label="P/E Ratio" value={asset.pe_ratio?.toFixed(1) ?? 'N/A'} />
        <Metric label="52W High" value={formatPrice(asset.week52_high)} />
        <Metric label="52W Low" value={formatPrice(asset.week52_low)} />
        <Metric label="Price Target" value={formatPrice(asset.analyst_price_target)} />
        <Metric label="RSI (14)" value={asset.technicals?.rsi_14?.toFixed(1) ?? 'N/A'} rsi={asset.technicals?.rsi_14} />
      </div>

      {/* AI Summary */}
      {asset.ai_summary && (
        <div className="mb-4 p-3 bg-gradient-to-r from-emerald/10 to-transparent border-l-2 border-emerald rounded-r-lg">
          <p className="text-sm text-gray-300">{asset.ai_summary}</p>
        </div>
      )}

      {/* Risks & Catalysts */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {asset.key_risks?.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-rose text-xs font-medium mb-2">
              <AlertTriangle className="w-3 h-3" />
              Risks
            </div>
            <div className="space-y-1">
              {asset.key_risks.slice(0, 2).map((risk, i) => (
                <span key={i} className="inline-block px-2 py-1 bg-rose/10 border border-rose/20 rounded text-xs text-rose/80 mr-1 mb-1">
                  {risk}
                </span>
              ))}
            </div>
          </div>
        )}
        {asset.key_catalysts?.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-emerald text-xs font-medium mb-2">
              <Zap className="w-3 h-3" />
              Catalysts
            </div>
            <div className="space-y-1">
              {asset.key_catalysts.slice(0, 2).map((cat, i) => (
                <span key={i} className="inline-block px-2 py-1 bg-emerald/10 border border-emerald/20 rounded text-xs text-emerald/80 mr-1 mb-1">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* News */}
      {asset.news?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <Star className="w-3 h-3" />
            Recent News
          </div>
          <div className="space-y-2">
            {asset.news.slice(0, 2).map((article, i) => (
              <NewsItem key={i} article={article} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, rsi }) {
  return (
    <div className="p-2 bg-surfaceHighlight rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-mono font-semibold ${rsi !== undefined ? getRSIColor(rsi) : 'text-gray-100'}`}>
        {value}
      </div>
      {rsi !== undefined && (
        <div className={`text-xs ${getRSIColor(rsi)}`}>{getRSILabel(rsi)}</div>
      )}
    </div>
  );
}
