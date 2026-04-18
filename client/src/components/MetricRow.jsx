export default function MetricRow({ label, value, subValue, highlight = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="text-right">
        <div className={`font-mono font-medium ${highlight ? 'text-emerald' : 'text-gray-100'}`}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-gray-600">{subValue}</div>
        )}
      </div>
    </div>
  );
}
