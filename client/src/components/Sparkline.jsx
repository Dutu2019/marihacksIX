import { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function Sparkline({ ticker, data: propData, color = '#10b981' }) {
  const [data, setData] = useState(propData || []);

  useEffect(() => {
    if (propData) {
      setData(propData);
      return;
    }

    // Fetch historical data for sparkline
    const fetchSparkline = async () => {
      try {
        const response = await fetch(`/api/sparkline/${ticker}`);
        if (response.ok) {
          const result = await response.json();
          setData(result.data || []);
        }
      } catch {
        // Generate mock data if fetch fails
        setData(generateMockData());
      }
    };

    fetchSparkline();
  }, [ticker, propData]);

  // Generate mock sparkline data if no real data
  function generateMockData() {
    const points = 20;
    const basePrice = 100;
    let current = basePrice;
    return Array.from({ length: points }, (_, i) => {
      current *= (1 + (Math.random() - 0.5) * 0.02);
      return { date: i, value: current };
    });
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full bg-surfaceHighlight rounded-lg animate-pulse" />
    );
  }

  const chartData = data.slice(-20).map((d, i) => ({
    ...d,
    value: d.close || d.value || d
  }));

  const isPositive = chartData.length > 1 &&
    chartData[chartData.length - 1].value >= chartData[0].value;
  const lineColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
