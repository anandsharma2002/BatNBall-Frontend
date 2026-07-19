import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const RunsTimelineChart = ({ timeline }) => {
  const [metric, setMetric] = useState('batting'); // 'batting' | 'bowling'

  if (!timeline || timeline.length === 0) {
    return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No match timeline data available</p>;
  }

  // Filter matching logs
  const chartData = timeline
    .filter(d => metric === 'batting' ? d.batting !== null : d.bowling !== null)
    .map(d => ({
      name: `${d.date} vs ${d.opponent}`,
      Runs: d.batting?.runs ?? 0,
      Balls: d.batting?.balls ?? 0,
      Wickets: d.bowling?.wickets ?? 0,
      RunsConceded: d.bowling?.runsConceded ?? 0
    }));

  if (chartData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setMetric('batting')}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
              background: metric === 'batting' ? 'var(--secondary-color)' : 'rgba(255,255,255,0.03)',
              color: metric === 'batting' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)'
            }}
          >Batting</button>
          <button
            onClick={() => setMetric('bowling')}
            style={{
              padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
              background: metric === 'bowling' ? 'var(--secondary-color)' : 'rgba(255,255,255,0.03)',
              color: metric === 'bowling' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)'
            }}
          >Bowling</button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No {metric} records logged yet.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setMetric('batting')}
          style={{
            padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
            background: metric === 'batting' ? 'var(--secondary-color)' : 'rgba(255,255,255,0.03)',
            color: metric === 'batting' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)',
            transition: 'all 0.15s ease'
          }}
        >Batting Form</button>
        <button
          onClick={() => setMetric('bowling')}
          style={{
            padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
            background: metric === 'bowling' ? 'var(--secondary-color)' : 'rgba(255,255,255,0.03)',
            color: metric === 'bowling' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-color)',
            transition: 'all 0.15s ease'
          }}
        >Bowling Form</button>
      </div>

      <div style={{ width: '100%', height: '260px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: 'rgba(20,20,20,0.85)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              labelStyle={{ fontWeight: '700', color: 'var(--text-color)', fontSize: '11px' }}
              itemStyle={{ fontSize: '11px' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {metric === 'batting' ? (
              <>
                <Line type="monotone" dataKey="Runs" stroke="var(--secondary-color)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Balls" stroke="var(--accent-color)" strokeWidth={1.5} strokeDasharray="4 4" />
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="Wickets" stroke="var(--accent-color)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="RunsConceded" name="Runs Conceded" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RunsTimelineChart;
