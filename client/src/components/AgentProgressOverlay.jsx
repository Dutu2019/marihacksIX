import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Loader2, Activity, Newspaper, Search, TrendingUp, Calculator, Star } from 'lucide-react';

const agentIcons = {
  price_agent: Activity,
  news_agent: Newspaper,
  web_search: Search,
  sector_scanner: TrendingUp,
  math_agent: Calculator,
  analyst_ratings: Star,
  historical_prices: TrendingUp,
  fundamentals: Calculator
};

const agentLabels = {
  price_agent: 'Price Agent',
  news_agent: 'News Agent',
  web_search: 'Web Search',
  sector_scanner: 'Sector Scanner',
  math_agent: 'Quant Agent',
  analyst_ratings: 'Analyst Ratings',
  historical_prices: 'Historical Data',
  fundamentals: 'Fundamentals'
};

export default function AgentProgressOverlay({ isVisible, progress = [] }) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    if (progress.length > 0) {
      setAgents(prev => {
        const updated = [...prev];
        const lastProgress = progress[progress.length - 1];

        const existingIndex = updated.findIndex(a => a.agent === lastProgress.agent);
        if (existingIndex >= 0) {
          updated[existingIndex] = { ...updated[existingIndex], ...lastProgress };
        } else {
          updated.push(lastProgress);
        }
        return updated;
      });
    }
  }, [progress]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surfaceHighlight border border-gray-800 mb-4">
            <Loader2 className="w-8 h-8 text-emerald animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            Researching your query
          </h2>
          <p className="text-gray-500 font-mono text-sm loading-dots">
            AI agents gathering data
          </p>
        </div>

        <div className="bg-surface border border-gray-800 rounded-xl p-4 space-y-3">
          {agents.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Initializing agents...
            </div>
          ) : (
            agents.map((item, i) => {
              const Icon = agentIcons[item.agent] || Activity;
              const label = agentLabels[item.agent] || item.agent;
              const isRunning = item.status === 'running';
              const isComplete = item.status === 'success' || item.status === 'completed';
              const isFailed = item.status === 'failed';

              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isComplete ? 'bg-emerald/20 text-emerald' :
                    isRunning ? 'bg-emerald/10 text-emerald animate-pulse' :
                    isFailed ? 'bg-rose/20 text-rose' :
                    'bg-gray-800 text-gray-500'
                  }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4" /> :
                     isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> :
                     <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`flex-1 font-mono text-sm ${
                    isComplete ? 'text-gray-300' :
                    isRunning ? 'text-emerald' :
                    isFailed ? 'text-rose' :
                    'text-gray-500'
                  }`}>
                    {label}
                  </span>
                  {item.duration_ms && (
                    <span className="text-xs text-gray-600 font-mono">
                      {item.duration_ms}ms
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
