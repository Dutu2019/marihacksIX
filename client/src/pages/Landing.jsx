import { useEffect, useState } from 'react';
import SearchBar from '../components/SearchBar';
import { TrendingUp, Zap, Shield, Globe } from 'lucide-react';

export default function Landing({ onSearch }) {
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    fetch('/api/trending')
      .then(r => r.json())
      .then(data => setTrending(data.trending || []))
      .catch(() => {
        // Fallback trending data
        setTrending([
          { ticker: 'AAPL', name: 'Apple Inc.' },
          { ticker: 'NVDA', name: 'NVIDIA Corp' },
          { ticker: 'TSLA', name: 'Tesla Inc' },
          { ticker: 'MSFT', name: 'Microsoft' },
          { ticker: 'AMZN', name: 'Amazon.com' },
          { ticker: 'GOOGL', name: 'Alphabet Inc' },
          { ticker: 'META', name: 'Meta Platforms' },
          { ticker: 'BTC-USD', name: 'Bitcoin' }
        ]);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald/10 border border-emerald/20 rounded-full text-emerald text-xs font-medium mb-4">
            <Zap className="w-3 h-3" />
            Powered by Gemma 4 AI
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
            Stock Research
          </h1>
          <p className="text-gray-500 text-lg max-w-md">
            AI-powered market intelligence. Enter a ticker or describe what you're looking for.
          </p>
        </div>

        <SearchBar onSearch={onSearch} showTrending trending={trending} />

        {/* Feature Pills */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <FeatureCard
            icon={<Globe className="w-5 h-5" />}
            title="Natural Language"
            description="Search with plain English"
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="Multi-Agent Analysis"
            description="7 specialized AI agents"
          />
          <FeatureCard
            icon={<TrendingUp className="w-5 h-5" />}
            title="Real-Time Data"
            description="Live market intelligence"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-gray-600">
          <span>Built with Gemma 4 + Yahoo Finance</span>
          <span>Data delayed 15 min</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-4 bg-surface border border-gray-800 rounded-xl hover:border-gray-700 transition-all">
      <div className="text-emerald mb-2">{icon}</div>
      <h3 className="text-gray-100 font-medium text-sm mb-1">{title}</h3>
      <p className="text-gray-500 text-xs">{description}</p>
    </div>
  );
}
