import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Shield, CheckCircle, AlertTriangle, User, Calendar, MapPin, Users } from 'lucide-react';

const RosterJoin = () => {
  const { matchId } = useParams();

  const [match, setMatch] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isSub, setIsSub] = useState(false);

  // Status/loading
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch match details
  useEffect(() => {
    if (!matchId) return;

    axios.get(`${API_BASE_URL}/matches/${matchId}`)
      .then(res => {
        setMatch(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Match invite details not found or expired.');
        setLoading(false);
      });
  }, [matchId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    if (!displayName || !selectedTeamId) {
      setError('Display name and Team selection are required');
      setActionLoading(false);
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/matches/${matchId}/join`, {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        team_id: selectedTeamId,
        is_substitute: isSub
      });
      
      setSuccess('You have successfully joined the match squad! The scoring dashboard has been updated.');
      setDisplayName('');
      setFirstName('');
      setLastName('');
      setSelectedTeamId('');
      setIsSub(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join match squad.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading match invite details...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '1.5rem' }}>
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

        {/* Form */}
        {!success && match && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Display Name *</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="e.g. V. Kohli" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>First Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Virat" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Last Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Kohli" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Select Your Team *</label>
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} required>
                <option value="">Choose Team</option>
                <option value={match.team_first_id?._id}>{match.team_first_id?.team_name}</option>
                <option value={match.team_second_id?._id}>{match.team_second_id?.team_name}</option>
              </select>
            </div>

            {match?.match_rules?.allow_substitutes !== false && (
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

            <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '0.85rem', width: '100%', fontWeight: '700', display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              {actionLoading ? 'Joining Roster...' : 'Join Squad'}
            </button>
          </form>
        )}

        {success && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Link to="/login" style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', fontWeight: '700' }}>
              Log in to BatNBall Portal
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RosterJoin;
