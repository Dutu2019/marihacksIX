import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import AssetCard from '../components/AssetCard';
import AgentProgressOverlay from '../components/AgentProgressOverlay';
import AgentTrace from '../components/AgentTrace';
import SentimentBadge from '../components/SentimentBadge';
import { parseQuery, research } from '../lib/api';
import { formatDate } from '../lib/formatters';

export default function Results({ query, initialResult, onResultsLoaded, onBack }) {
  const [loading, setLoading] = useState(!initialResult);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!initialResult && query) {
      executeResearch(query);
    }
  }, [query]);

  const executeResearch = async (searchQuery) => {
    setLoading(true);
    setProgress([]);
    setError(null);

    try {
      // Step 1: Parse the query
      setProgress(prev => [...prev, { agent: 'nlp_parser', status: 'running', message: 'Parsing query intent...' }]);
      const parsed = await parseQuery(searchQuery);

      setProgress(prev => [...prev, { agent: 'nlp_parser', status: 'success', message: `Intent: ${parsed.resolved.type}` }]);

      // Step 2: Execute research
      setProgress(prev => [...prev, { agent: 'coordinator', status: 'running', message: 'Dispatching agents...' }]);
      const researchResult = await research(parsed);

      setResult(researchResult);
      setProgress(prev => [...prev, { agent: 'coordinator', status: 'success', message: 'Research complete' }]);
      onResultsLoaded?.(researchResult);
    } catch (err) {
      setError(err.message || 'Failed to execute research');
      setProgress(prev => [...prev, { agent: 'error', status: 'failed', message: err.message }]);
    } finally {
      setLoading(false);
    };
  };

  const handleRetry = () => {
    if (query) executeResearch(query);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            <div className="flex-1 max-w-lg mx-4">
              <SearchBar onSearch={executeResearch} />
            </div>

            <button
              onClick={handleRetry}
              className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald/10 mb-4">
              <RefreshCw className="w-6 h-6 text-emerald animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">
              Researching "{query}"
            </h2>
            <p className="text-gray-500">AI agents are gathering data...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose/10 mb-4">
              <RefreshCw className="w-6 h-6 text-rose" />
            </div>
            <h2 className="text-xl font-semibold text-gray-100 mb-2">
              Research Failed
            </h2>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-emerald hover:bg-emerald-dark text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : result ? (
          <>
            {/* Results Header */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <h1 className="text-2xl font-bold text-gray-100 capitalize">
                  {result.query_summary}
                </h1>
                <SentimentBadge sentiment={result.overall_sentiment} />
                <span className="text-xs text-gray-500 font-mono">
                  Confidence: {(result.confidence_score * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(result.generated_at)}
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald" />
                  {result.data_sources.join(', ')}
                </div>
              </div>

              {result.sector_overview && (
                <p className="mt-3 text-gray-400">{result.sector_overview}</p>
              )}
            </div>

            {/* Assets Grid */}
            {result.assets && result.assets.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.assets.map((asset, i) => (
                    <AssetCard key={asset.ticker} asset={asset} index={i} />
                  ))}
                </div>

                {/* Agent Trace */}
                <AgentTrace trace={result.agent_trace} />
              </>
            ) : (
              <div className="text-center py-20 text-gray-500">
                No results found. Try a different query.
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Progress Overlay */}
      <AgentProgressOverlay isVisible={loading} progress={progress} />
    </div>
  );
}
