import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend
} from 'recharts';

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

  const srPacers = ballsVsPacers > 0 ? (runsVsPacers / ballsVsPacers) * 100 : 0;
  const srSpinners = ballsVsSpinners > 0 ? (runsVsSpinners / ballsVsSpinners) * 100 : 0;

  const avgPacers = outsVsPacers > 0 ? runsVsPacers / outsVsPacers : runsVsPacers;
  const avgSpinners = outsVsSpinners > 0 ? runsVsSpinners / outsVsSpinners : runsVsSpinners;

  // We scale the data parameters so they look balanced on a radar plot.
  // Since SR can be ~140 and Dismissals ~2, we map them onto the same relative chart scale.
  const data = [
    { subject: 'Runs', Pacers: runsVsPacers, Spinners: runsVsSpinners },
    { subject: 'Balls Faced', Pacers: ballsVsPacers, Spinners: ballsVsSpinners },
    { subject: 'Average', Pacers: Math.round(avgPacers), Spinners: Math.round(avgSpinners) },
    { subject: 'Strike Rate', Pacers: Math.round(srPacers), Spinners: Math.round(srSpinners) },
    { subject: 'Dismissals', Pacers: outsVsPacers * 10, Spinners: outsVsSpinners * 10 } // scaled by 10 for visibility
  ];

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--border-color)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-color)', fontSize: 11, fontWeight: '600' }} />
          <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
          <Radar name="Pacers" dataKey="Pacers" stroke="var(--secondary-color)" fill="var(--secondary-color)" fillOpacity={0.25} />
          <Radar name="Spinners" dataKey="Spinners" stroke="var(--accent-color)" fill="var(--accent-color)" fillOpacity={0.25} />
          <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-color)' }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsRadarChart;
