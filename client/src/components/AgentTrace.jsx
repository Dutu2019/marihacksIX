import { useState } from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';

export default function AgentTrace({ trace }) {
  const [expanded, setExpanded] = useState(false);

  if (!trace || trace.length === 0) return null;

  const totalTime = trace.reduce((sum, t) => sum + (t.duration_ms || 0), 0);

  return (
    <div className="mt-8 border-t border-gray-800 pt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Activity className="w-4 h-4" />
        <span className="font-mono">Agent Trace</span>
        <span className="text-gray-600">({trace.length} agents, {totalTime}ms total)</span>
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {trace.map((item, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border font-mono text-xs ${
                item.status === 'success' || item.status === 'completed'
                  ? 'bg-emerald/10 border-emerald/20 text-emerald'
                  : item.status === 'failed'
                  ? 'bg-rose/10 border-rose/20 text-rose'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{item.agent}</span>
                <span className="text-gray-500">{item.duration_ms}ms</span>
              </div>
              <div className="text-gray-500 mt-1">Status: {item.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
