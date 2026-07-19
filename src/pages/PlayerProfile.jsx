import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { API_BASE_URL, SOCKET_URL } from '../config';
import { User, Award, Shield, ArrowLeft, BarChart2 } from 'lucide-react';
import StatsRadarChart from '../components/StatsRadarChart';
import RunsTimelineChart from '../components/RunsTimelineChart';

const PlayerProfile = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState('');

  const [activeTab, setActiveTab] = useState('batting');

  useEffect(() => {
    if (!playerId) return;

    setLoading(true);
    setError('');

    // Fetch player profile details
    axios.get(`${API_BASE_URL}/players/${playerId}`)
      .then(res => {
        setPlayer(res.data);
        setStats(res.data.career_stats || null);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch player profile details');
        setLoading(false);
      });

    // Fetch visual charts
    setChartLoading(true);
    axios.get(`${API_BASE_URL}/players/${playerId}/stats/charts`)
      .then(res => {
        setChartData(res.data);
        setChartLoading(false);
      })
      .catch(err => {
        console.error(err);
        setChartError('Could not load career charts');
        setChartLoading(false);
      });
  }, [playerId]);

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{ padding: '3rem', textAlign: 'center' }}>Loading player profile...</div>
      </>
    );
  }

  if (error || !player) {
    return (
      <>
        <Navigation />
        <div style={{ padding: '3rem', textAlign: 'center', color: '#D9534F' }}>
          <p>{error || 'Player profile not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </>
    );
  }

  // Calculate Batting Average and Strike Rate
  const batStats = stats?.batting || {};
  const inningsBatted = batStats.innings_batted || 0;
  const dismissals = inningsBatted - (batStats.not_outs || 0);
  const batAvg = dismissals === 0 ? '-' : (batStats.total_runs / dismissals).toFixed(2);
  const batSR = batStats.balls_faced === 0 ? '0.00' : ((batStats.total_runs / batStats.balls_faced) * 100).toFixed(1);

  // Calculate Bowling Economy and strike rate
  const bowlStats = stats?.bowling || {};
  const oversBowled = (bowlStats.balls_bowled || 0) / 6;
  const bowlEco = oversBowled === 0 ? '0.00' : (bowlStats.runs_conceded / oversBowled).toFixed(2);
  const bowlAvg = bowlStats.wickets_taken === 0 ? '-' : (bowlStats.runs_conceded / bowlStats.wickets_taken).toFixed(2);
  const bowlSR = bowlStats.wickets_taken === 0 ? '-' : (bowlStats.balls_bowled / bowlStats.wickets_taken).toFixed(1);

  return (
    <>
      <Navigation />
      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem', boxSizing: 'border-box' }}>
        
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)} 
          className="btn" 
          style={{ 
            marginBottom: '1.5rem', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-color)',
            fontSize: '0.85rem'
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Player Header Card */}
        <div className="glass" style={{ padding: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '2rem' }}>
          {player.profile_picture_url ? (
            <img 
              src={`${SOCKET_URL}${player.profile_picture_url}`} 
              alt={player.display_name} 
              style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
            />
          ) : (
            <div style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(29,79,42,0.1)', 
              color: 'var(--secondary-color)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '2.5rem'
            }}>
              {player.first_name?.[0] || 'P'}
            </div>
          )}

          <div style={{ flex: 1, minWidth: '250px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {player.first_name} {player.last_name}
              <Shield size={20} style={{ color: 'var(--accent-color)' }} />
            </h1>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--secondary-color)', margin: '0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{player.display_name}</span>
              {player.username && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>@{player.username}</span>}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {player.player_roles?.map(r => (
                <span key={r} style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  padding: '0.25rem 0.6rem', 
                  backgroundColor: 'var(--border-color)', 
                  borderRadius: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {r.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
            <div><strong>Batting Style:</strong> {player.batting_style?.replace('_', ' ')}</div>
            <div><strong>Bowling Style:</strong> {player.bowling_style?.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Career Stats Grid Table */}
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.25rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={22} style={{ color: 'var(--accent-color)' }} />
            Career Stats Summary
          </h3>

          {/* Stats Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            {['batting', 'bowling', 'fielding'].map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: activeTab === t ? 'var(--secondary-color)' : 'var(--text-muted)',
                  borderBottom: activeTab === t ? '3px solid var(--secondary-color)' : '3px solid transparent',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {!stats ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No matches or stats recorded yet for this player.
            </div>
          ) : (
            <div>
              {/* Batting Tab */}
              {activeTab === 'batting' && (
                <div className="profile-form-grid" style={{ gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Matches Played</span>
                      <strong>{batStats.matches_played ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Innings Batted</span>
                      <strong>{batStats.innings_batted ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Not Outs</span>
                      <strong>{batStats.not_outs ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total Runs</span>
                      <strong>{batStats.total_runs ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Highest Score</span>
                      <strong>{batStats.highest_score?.runs ?? 0}{batStats.highest_score?.is_not_out ? '*' : ''}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Batting Average</span>
                      <strong>{batAvg}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Strike Rate</span>
                      <strong>{batSR}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Centuries (100s) / 50s</span>
                      <strong>{batStats.centuries_100s ?? 0} / {batStats.half_centuries_50s ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Ducks / Golden Ducks</span>
                      <strong>{batStats.ducks_total ?? 0} / {batStats.golden_ducks ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Boundaries (4s / 6s)</span>
                      <strong>{batStats.fours_count ?? 0} / {batStats.sixes_count ?? 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Bowling Tab */}
              {activeTab === 'bowling' && (
                <div className="profile-form-grid" style={{ gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Innings Bowled</span>
                      <strong>{bowlStats.innings_bowled ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Overs Bowled</span>
                      <strong>{( (bowlStats.balls_bowled || 0) / 6 ).toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Runs Conceded</span>
                      <strong>{bowlStats.runs_conceded ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Wickets Taken</span>
                      <strong>{bowlStats.wickets_taken ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Best Bowling</span>
                      <strong>{bowlStats.best_bowling_figures?.wickets ?? 0}/{bowlStats.best_bowling_figures?.runs ?? 0}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Economy Rate</span>
                      <strong>{bowlEco}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bowling Average</span>
                      <strong>{bowlAvg}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Bowling Strike Rate</span>
                      <strong>{bowlSR}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Maiden Overs</span>
                      <strong>{bowlStats.maidens_overs ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Extras Conceded (WD/NB)</span>
                      <strong>{bowlStats.wides_conceded ?? 0} / {bowlStats.no_balls_conceded ?? 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Fielding Tab */}
              {activeTab === 'fielding' && (
                <div className="profile-form-grid" style={{ gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Catches Taken</span>
                      <strong>{stats.fielding?.catches_total ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Stumpings</span>
                      <strong>{stats.fielding?.stumpings ?? 0}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Run Outs Assisted</span>
                      <strong>{stats.fielding?.run_outs_assisted ?? 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Run Outs (Direct Hits)</span>
                      <strong>{stats.fielding?.run_outs_unassisted ?? 0}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visual Charts Section */}
        {chartData && (
          <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary-color)' }}>
              <BarChart2 size={22} style={{ color: 'var(--accent-color)' }} />
              Form Timelines & Match Splits
            </h3>
            {chartLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading visual statistics...</div>
            ) : chartError ? (
              <div style={{ color: '#D9534F', fontSize: '0.85rem' }}>{chartError}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-color)' }}>Form Timeline</h4>
                  <RunsTimelineChart timeline={chartData.timeline} />
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '1.25rem', color: 'var(--text-color)' }}>Pace vs Spin Split (Batting)</h4>
                  <StatsRadarChart splits={chartData.splits} />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default PlayerProfile;
