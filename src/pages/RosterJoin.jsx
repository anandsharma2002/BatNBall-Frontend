import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { Shield, CheckCircle, AlertTriangle, User, Calendar, MapPin, Users } from 'lucide-react';

const RosterJoin = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [match, setMatch] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isSub, setIsSub] = useState(false);

  // Floating Toast State (2 seconds auto-dismiss)
  const [toast, setToast] = useState({ show: false, message: '' });
  const toastTimerRef = useRef(null);

  const triggerToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2000);
  };

  // Status/loading
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Enforce Login Redirect for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      const targetUrl = location.pathname + location.search;
      sessionStorage.setItem('redirectAfterLogin', targetUrl);
      navigate(`/login?redirect=${encodeURIComponent(targetUrl)}`, { replace: true });
    }
  }, [isAuthenticated, location.pathname, location.search, navigate]);

  // Fetch logged in user's player profile
  useEffect(() => {
    if (user && user.associated_player_id) {
      const pId = user.associated_player_id._id || user.associated_player_id;
      axios.get(`${API_BASE_URL}/players/${pId}`)
        .then(res => setPlayerProfile(res.data))
        .catch(err => console.error('Failed to fetch player profile:', err));
    }
  }, [user]);

  // Fetch match details & setup Socket connection
  useEffect(() => {
    if (!matchId) return;

    axios.get(`${API_BASE_URL}/matches/${matchId}`)
      .then(res => {
        setMatch(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('This match link is invalid or was discarded by the creator. Redirecting to dashboard...');
        setLoading(false);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      });

    const socket = io(SOCKET_URL);
    socket.emit('join_match_room', matchId);

    const handleMatchDiscarded = (data) => {
      if (!data || data.matchId === matchId || data.matchId?.toString() === matchId?.toString()) {
        sessionStorage.setItem('flash_toast', JSON.stringify({
          title: 'MATCH DISCARDED',
          message: 'This match has been removed or cancelled by the creator.',
          type: 'warning'
        }));
        const currentPath = window.location.pathname;
        const prefix = currentPath.startsWith('/BatNBall-Frontend') ? '/BatNBall-Frontend' : '';
        window.location.href = window.location.origin + prefix + '/dashboard';
      }
    };


    socket.on('match_discarded', handleMatchDiscarded);
    socket.on('global_match_discarded', handleMatchDiscarded);

    socket.on('player_moved', (data) => {
      if (data.match) setMatch(data.match);

      const currentUserPlayerId = (user?.associated_player_id?._id || user?.associated_player_id)?.toString();
      const guestPlayerId = sessionStorage.getItem(`joined_player_${matchId}`);
      const targetPlayerId = data.playerId?.toString();

      const isTargetPlayer = (currentUserPlayerId && currentUserPlayerId === targetPlayerId) ||
                             (guestPlayerId && guestPlayerId === targetPlayerId);

      if (isTargetPlayer && data.targetTeamName) {
        triggerToast(`Your team has been changed to ${data.targetTeamName}`);
      }
    });

    return () => socket.close();
  }, [matchId, user, navigate]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    if (!selectedTeamId) {
      setError('Please select a team to join');
      setActionLoading(false);
      return;
    }

    const displayNameToUse = playerProfile?.display_name || user?.phone_number || 'Player';
    const firstNameToUse = playerProfile?.first_name || 'Player';
    const lastNameToUse = playerProfile?.last_name || '';

    try {
      const response = await axios.post(`${API_BASE_URL}/matches/${matchId}/join`, {
        first_name: firstNameToUse,
        last_name: lastNameToUse,
        display_name: displayNameToUse,
        team_id: selectedTeamId,
        is_substitute: isSub
      });
      
      setMatch(response.data.match);
      
      // Save joined player ID in session
      const updatedMatch = response.data.match;
      const joinedPlayer = [...(updatedMatch.playing_xi_team_first || []), ...(updatedMatch.playing_xi_team_second || []), ...(updatedMatch.substitutes_team_first || []), ...(updatedMatch.substitutes_team_second || [])]
        .find(p => p.display_name === displayNameToUse.trim());

      if (joinedPlayer) {
        sessionStorage.setItem(`joined_player_${matchId}`, joinedPlayer._id);
      }

      const selectedTeamName = selectedTeamId === match.team_first_id?._id ? match.team_first_id?.team_name : match.team_second_id?.team_name;
      setSuccess(`Successfully joined squad for ${selectedTeamName}!`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join match squad.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading match details...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '1.5rem' }}>
      {/* Floating Toast Notification for 2 Seconds */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: 'var(--secondary-color)',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: '4px solid var(--accent-color)',
          fontSize: '0.9rem',
          fontWeight: '600'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔄</span>
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.9 }}>Team Changed</div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{toast.message}</div>
          </div>
        </div>
      )}

      <div className="glass" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem 2rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <Shield size={28} style={{ color: 'var(--secondary-color)' }} />
          <span style={{ fontWeight: '800', fontSize: '1.25rem' }}>BatNBall Squad Join</span>
        </div>

        {/* Match Header Info */}
        {match && (
          <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: '800', color: 'var(--secondary-color)' }}>
              <span>{match.team_first_id?.team_short_name}</span>
              <span>vs</span>
              <span>{match.team_second_id?.team_short_name}</span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', textAlign: 'center', margin: '0.25rem 0' }}>
              {match.team_first_id?.team_name} vs {match.team_second_id?.team_name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span><MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />{match.venue}</span>
              <span><Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />{new Date(match.match_date_time).toLocaleString()}</span>
              <span><Users size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />Overs: {match.total_overs_per_innings} | Bowler Limit: {match.max_overs_per_bowler}</span>
            </div>
          </div>
        )}

        {/* User Identity Info */}
        {user && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(29, 79, 42, 0.05)', borderRadius: '8px', border: '1px solid rgba(29, 79, 42, 0.2)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={16} style={{ color: 'var(--secondary-color)' }} />
            <span>Joining as: <strong>{playerProfile?.display_name || user?.phone_number || 'Logged In Player'}</strong></span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(29, 79, 42, 0.1)', border: '1px solid rgba(29, 79, 42, 0.3)', borderRadius: '8px', color: 'var(--secondary-color)', fontSize: '0.85rem' }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(217, 83, 79, 0.1)', border: '1px solid rgba(217, 83, 79, 0.3)', borderRadius: '8px', color: '#D9534F', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form with Team Selection Cards (No text inputs, no dropdown) */}
        {!success && match && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-color)' }}>Select Team to Join *</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {/* Team First Option */}
                <div 
                  onClick={() => setSelectedTeamId(match.team_first_id?._id)}
                  style={{
                    flex: 1,
                    padding: '1.25rem 1rem',
                    borderRadius: '12px',
                    border: selectedTeamId === match.team_first_id?._id ? '2px solid var(--secondary-color)' : '1px solid var(--border-color)',
                    backgroundColor: selectedTeamId === match.team_first_id?._id ? 'rgba(29, 79, 42, 0.08)' : 'rgba(0,0,0,0.01)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--secondary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem' }}>
                    {match.team_first_id?.team_short_name}
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-color)' }}>
                    {match.team_first_id?.team_name}
                  </div>
                </div>

                {/* Team Second Option */}
                <div 
                  onClick={() => setSelectedTeamId(match.team_second_id?._id)}
                  style={{
                    flex: 1,
                    padding: '1.25rem 1rem',
                    borderRadius: '12px',
                    border: selectedTeamId === match.team_second_id?._id ? '2px solid var(--secondary-color)' : '1px solid var(--border-color)',
                    backgroundColor: selectedTeamId === match.team_second_id?._id ? 'rgba(29, 79, 42, 0.08)' : 'rgba(0,0,0,0.01)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.9rem' }}>
                    {match.team_second_id?.team_short_name}
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-color)' }}>
                    {match.team_second_id?.team_name}
                  </div>
                </div>
              </div>
            </div>

            {match?.match_rules?.allow_substitutes === true && (

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isSub} 
                    onChange={(e) => setIsSub(e.target.checked)} 
                    style={{ width: '16px', height: '16px' }}
                  />
                  Joining as substitute player
                </label>
              </div>
            )}

            <button type="submit" disabled={actionLoading || !selectedTeamId} className="btn btn-primary" style={{ padding: '0.85rem', width: '100%', fontWeight: '700', display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              {actionLoading ? 'Joining Roster...' : 'Join Squad'}
            </button>
          </form>
        )}

        {success && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/dashboard" style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', fontWeight: '700' }}>
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RosterJoin;

