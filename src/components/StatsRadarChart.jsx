import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--dominant-color)',
        border: '1px solid var(--border-color)',
        padding: '0.6rem 0.8rem',
        borderRadius: '8px',
        fontSize: '0.8rem',
        boxShadow: 'var(--shadow)'
      }}>
        <div style={{ fontWeight: '800', marginBottom: '0.3rem', color: 'var(--accent-color)' }}>{data.subject}</div>
        <div style={{ color: '#ea580c', fontWeight: '600' }}>⚡ Pacers: <strong>{data.rawPacers}</strong></div>
        <div style={{ color: '#a855f7', fontWeight: '600' }}>🌀 Spinners: <strong>{data.rawSpinners}</strong></div>
      </div>
    );
  }
  return null;
};

const StatsRadarChart = ({ splits }) => {
  if (!splits) return <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No split stats available</p>;

  const {
    runsVsPacers = 0,
    ballsVsPacers = 0,
    outsVsPacers = 0,
    runsVsSpinners = 0,
    ballsVsSpinners = 0,
    outsVsSpinners = 0
  } = splits;

  const totalBalls = ballsVsPacers + ballsVsSpinners;
  if (totalBalls === 0) {
    return (
      <div className="glass" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No batting statistics faced against pace or spin bowlers yet.
      </div>
    );
  }

  const srPacers = ballsVsPacers > 0 ? (runsVsPacers / ballsVsPacers) * 100 : 0;
  const srSpinners = ballsVsSpinners > 0 ? (runsVsSpinners / ballsVsSpinners) * 100 : 0;

  const avgPacers = outsVsPacers > 0 ? runsVsPacers / outsVsPacers : (ballsVsPacers > 0 ? runsVsPacers : 0);
  const avgSpinners = outsVsSpinners > 0 ? runsVsSpinners / outsVsSpinners : (ballsVsSpinners > 0 ? runsVsSpinners : 0);

  // Normalize data (0-100 scale) for Radar visual representation so all 5 axes scale proportionally
  const maxRuns = Math.max(runsVsPacers, runsVsSpinners, 1);
  const maxBalls = Math.max(ballsVsPacers, ballsVsSpinners, 1);
  const maxSr = Math.max(srPacers, srSpinners, 100);
  const maxAvg = Math.max(avgPacers, avgSpinners, 30);
  const maxOuts = Math.max(outsVsPacers, outsVsSpinners, 1);

  const data = [
    {
      subject: 'Runs',
      Pacers: Math.round((runsVsPacers / maxRuns) * 100),
      Spinners: Math.round((runsVsSpinners / maxRuns) * 100),
      rawPacers: runsVsPacers,
      rawSpinners: runsVsSpinners
    },
    {
      subject: 'Balls Faced',
      Pacers: Math.round((ballsVsPacers / maxBalls) * 100),
      Spinners: Math.round((ballsVsSpinners / maxBalls) * 100),
      rawPacers: ballsVsPacers,
      rawSpinners: ballsVsSpinners
    },
    {
      subject: 'Average',
      Pacers: Math.min(100, Math.round((avgPacers / maxAvg) * 100)),
      Spinners: Math.min(100, Math.round((avgSpinners / maxAvg) * 100)),
      rawPacers: outsVsPacers === 0 && ballsVsPacers > 0 ? `${runsVsPacers}*` : avgPacers.toFixed(1),
      rawSpinners: outsVsSpinners === 0 && ballsVsSpinners > 0 ? `${runsVsSpinners}*` : avgSpinners.toFixed(1)
    },
    {
      subject: 'Strike Rate',
      Pacers: Math.min(100, Math.round((srPacers / maxSr) * 100)),
      Spinners: Math.min(100, Math.round((srSpinners / maxSr) * 100)),
      rawPacers: srPacers.toFixed(1),
      rawSpinners: srSpinners.toFixed(1)
    },
    {
      subject: 'Dismissals',
      Pacers: Math.round((outsVsPacers / maxOuts) * 100),
      Spinners: Math.round((outsVsSpinners / maxOuts) * 100),
      rawPacers: outsVsPacers,
      rawSpinners: outsVsSpinners
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Radar Chart */}
      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="var(--border-color)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-color)', fontSize: 11, fontWeight: '700' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Radar name="Pacers ⚡" dataKey="Pacers" stroke="#ea580c" fill="#ea580c" fillOpacity={0.3} />
            <Radar name="Spinners 🌀" dataKey="Spinners" stroke="#a855f7" fill="#a855f7" fillOpacity={0.3} />
            <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-color)', fontWeight: '600' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* Pacers Card */}
        <div className="glass" style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid rgba(234, 88, 12, 0.3)',
          background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.05) 0%, var(--card-bg) 100%)'
        }}>
          <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#ea580c', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ⚡ vs Pacers
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Runs:</span> <strong>{runsVsPacers}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Balls:</span> <strong>{ballsVsPacers}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Avg:</span> <strong>{outsVsPacers === 0 && ballsVsPacers > 0 ? `${runsVsPacers}*` : avgPacers.toFixed(1)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SR:</span> <strong>{srPacers.toFixed(1)}</strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Dismissals:</span> <strong>{outsVsPacers}</strong>
            </div>
          </div>
        </div>

        {/* Spinners Card */}
        <div className="glass" style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, var(--card-bg) 100%)'
        }}>
          <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#a855f7', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🌀 vs Spinners
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Runs:</span> <strong>{runsVsSpinners}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Balls:</span> <strong>{ballsVsSpinners}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Avg:</span> <strong>{outsVsSpinners === 0 && ballsVsSpinners > 0 ? `${runsVsSpinners}*` : avgSpinners.toFixed(1)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SR:</span> <strong>{srSpinners.toFixed(1)}</strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Dismissals:</span> <strong>{outsVsSpinners}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsRadarChart;
