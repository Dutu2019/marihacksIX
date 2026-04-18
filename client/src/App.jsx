import { useState } from 'react';
import Landing from './pages/Landing';
import Results from './pages/Results';

function App() {
  const [view, setView] = useState('landing');
  const [searchQuery, setSearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setView('loading');
    // Results page will handle the actual API call
  };

  const handleResultsLoaded = (result) => {
    setResearchResult(result);
    setView('results');
  };

  const handleBackToSearch = () => {
    setView('landing');
    setSearchQuery('');
    setResearchResult(null);
  };

  return (
    <div className="min-h-screen bg-background text-gray-100">
      {view === 'landing' && (
        <Landing onSearch={handleSearch} />
      )}
      {view === 'loading' && (
        <Results
          query={searchQuery}
          onResultsLoaded={handleResultsLoaded}
          onBack={handleBackToSearch}
        />
      )}
      {view === 'results' && (
        <Results
          query={searchQuery}
          initialResult={researchResult}
          onBack={handleBackToSearch}
        />
      )}
    </div>
  );
}

export default App;
