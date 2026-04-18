import { useState } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { useAnimatedPlaceholder } from '../lib/hooks';

const PLACEHOLDER_EXAMPLES = [
  'Try: AAPL, clean energy stocks, investment-grade bonds...',
  'NVDA',
  'renewable energy ETFs',
  'transport sector stocks',
  'BTC-USD vs ETH-USD',
  'dividend aristocrats'
];

export default function SearchBar({ onSearch, showTrending = false, trending = [] }) {
  const [query, setQuery] = useState('');
  const placeholder = useAnimatedPlaceholder(PLACEHOLDER_EXAMPLES);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleTrendingClick = (ticker) => {
    onSearch(ticker);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald/20 to-emerald/5 rounded-2xl blur-xl group-hover:from-emerald/30 group-hover:to-emerald/10 transition-all" />
          <div className="relative flex items-center bg-surface border border-gray-800 rounded-2xl overflow-hidden focus-within:border-emerald/50 focus-within:ring-2 focus-within:ring-emerald/20 transition-all">
            <Search className="w-5 h-5 ml-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent px-4 py-4 text-gray-100 placeholder-gray-500 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="mr-2 px-4 py-2 bg-emerald hover:bg-emerald-dark text-white rounded-lg font-medium transition-colors"
            >
              Research
            </button>
          </div>
        </div>
      </form>

      {showTrending && trending.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
            <TrendingUp className="w-4 h-4" />
            <span>Trending</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trending.map((item, i) => (
              <button
                key={item.ticker}
                onClick={() => handleTrendingClick(item.ticker)}
                className="px-3 py-1.5 bg-surfaceHighlight border border-gray-800 rounded-lg hover:border-emerald/50 hover:text-emerald transition-all text-sm font-mono"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {item.ticker}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
