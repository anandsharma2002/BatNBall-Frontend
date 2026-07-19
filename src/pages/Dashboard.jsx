import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Shield, Calendar, MapPin, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import Navigation from '../components/Navigation';
import { API_BASE_URL as API } from '../config';

const Dashboard = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load matches list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'LIVE':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            color: '#22c55e',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            animation: 'pulseGlow 2s infinite'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            Live
          </span>
        );
      case 'PAUSED':
      case 'RAIN_DELAY':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            {status.replace('_', ' ')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: 'rgba(29, 79, 42, 0.1)',
            color: 'var(--secondary-color)',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase'
          }}>
            <CheckCircle size={10} />
            Completed
          </span>
        );
      case 'ABANDONED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: '#dc2626',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase'
          }}>
            <AlertCircle size={10} />
            Abandoned
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--text-muted)',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase'
          }}>
            Upcoming
          </span>
        );
    }
  };

  const getMatchResultText = (match) => {
    if (match.match_status !== 'COMPLETED') return '';
    if (!match.winner_team_id) {
      return match.result_type === 'TIE' ? 'Match Tied' : 'No Result / Draw';
    }
    const winnerName = match.winner_team_id.team_name || 'Winner';
    const margin = match.win_margin || 0;
    const resType = match.result_type ? match.result_type.toLowerCase() : 'runs';
    return `${winnerName} won by ${margin} ${resType}`;
  };

  const formatMatchOvers = (legal_balls) => {
    const overs = Math.floor(legal_balls / 6);
    const balls = legal_balls % 6;
    return `${overs}.${balls}`;
  };

  return (
    <>
      <Navigation />
      
      {/* CSS Animation Keyframes for live pulse */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseGlow {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}} />

      <div style={{
        maxWidth: '900px',
        margin: '2rem auto',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem'
      }}>
        {/* Matches Overview */}
        <section style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={22} style={{ color: 'var(--accent-color)' }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-color)', margin: 0 }}>
                Tournament Match Fixtures
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginLeft: '0.5rem' }}>
                ({matches.length} Total)
              </span>
            </div>
            {role === 'SUPER_ADMIN' && (
              <Link to="/matches/new" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                New Match
              </Link>
            )}
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(217, 83, 79, 0.1)',
              border: '1px solid rgba(217, 83, 79, 0.3)',
              borderRadius: '8px',
              color: '#D9534F',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>{error}</div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading match details...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="glass" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No matches have been configured yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {matches.map((match) => {
                const isLive = ['LIVE', 'PAUSED', 'RAIN_DELAY'].includes(match.match_status);
                const isCompleted = match.match_status === 'COMPLETED';
                
                return (
                  <div
                    key={match._id}
                    className="glass"
                    onClick={() => navigate(`/matches/${match._id}/live`)}
                    style={{
                      padding: '1.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'transform 0.2s ease, border-color 0.2s ease',
                      border: isLive ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                      boxShadow: isLive ? '0 0 15px rgba(198,165,103,0.15)' : 'var(--shadow)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'var(--accent-color)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = isLive ? 'var(--accent-color)' : 'var(--border-color)';
                    }}
                  >
                    {/* Card Top: Date/Venue & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={12} />
                          {new Date(match.match_date_time).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={12} />
                          {match.venue}
                        </div>
                      </div>
                      {getStatusBadge(match.match_status)}
                    </div>

                    {/* Card Middle: Teams and Score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {/* Team 1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                          {match.team_first_id?.team_name}
                        </span>
                        {match.innings1 && (match.innings1.total_legal_balls > 0 || match.innings1.score > 0) && (
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--secondary-color)', marginTop: '0.2rem' }}>
                            {match.innings1.score}/{match.innings1.wickets}
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginLeft: '0.3rem' }}>
                              ({formatMatchOvers(match.innings1.total_legal_balls)} ov)
                            </span>
                          </span>
                        )}
                      </div>

                      {/* VS separator or Live match icon */}
                      <div style={{ 
                        color: 'var(--accent-color)', 
                        fontWeight: '800', 
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)'
                      }}>
                        VS
                      </div>

                      {/* Team 2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, minWidth: '120px', textAlign: 'right' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                          {match.team_second_id?.team_name}
                        </span>
                        {match.innings2 && (match.innings2.total_legal_balls > 0 || match.innings2.score > 0) && (
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--secondary-color)', marginTop: '0.2rem' }}>
                            {match.innings2.score}/{match.innings2.wickets}
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', marginLeft: '0.3rem' }}>
                              ({formatMatchOvers(match.innings2.total_legal_balls)} ov)
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom: Result text if completed */}
                    {isCompleted && (
                      <div style={{ 
                        borderTop: '1px dashed var(--border-color)', 
                        paddingTop: '0.75rem', 
                        fontSize: '0.85rem', 
                        color: 'var(--secondary-color)', 
                        fontWeight: '750',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{getMatchResultText(match)}</span>
                        <ChevronRight size={16} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default Dashboard;
