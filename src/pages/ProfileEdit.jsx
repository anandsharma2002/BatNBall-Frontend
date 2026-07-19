import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { User, CheckCircle, AlertTriangle, Save, Upload, Award } from 'lucide-react';
import StatsRadarChart from '../components/StatsRadarChart';
import RunsTimelineChart from '../components/RunsTimelineChart';

const ProfileEdit = () => {
  const { user } = useAuth();
  const playerId = user?.associated_player_id;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [battingStyle, setBattingStyle] = useState('RIGHT_HAND');
  const [bowlingStyle, setBowlingStyle] = useState('NONE');
  const [roles, setRoles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState('');

  // Fetch player details
  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    axios.get(`http://localhost:5000/api/v1/players/${playerId}`)
      .then(response => {
        const player = response.data;
        setFirstName(player.first_name || '');
        setLastName(player.last_name || '');
        setDisplayName(player.display_name || '');
        setUsername(player.username || '');
        setBattingStyle(player.batting_style || 'RIGHT_HAND');
        setBowlingStyle(player.bowling_style || 'NONE');
        setRoles(player.player_roles || []);
        setPreviewUrl(player.profile_picture_url || '');
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching player profile:', err);
        setError('Failed to load player details');
        setLoading(false);
      });
  }, [playerId]);

  // Fetch player chart stats
  useEffect(() => {
    if (!playerId) {
      setChartLoading(false);
      return;
    }

    axios.get(`http://localhost:5000/api/v1/players/${playerId}/stats/charts`)
      .then(response => {
        setChartData(response.data);
        setChartLoading(false);
      })
      .catch(err => {
        console.error('Error fetching player charts:', err);
        setChartError('Could not load career charts');
        setChartLoading(false);
      });
  }, [playerId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRoleToggle = (role) => {
    setRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!playerId) return;

    setError('');
    setSuccess('');
    setSaveLoading(true);

    if (!firstName || !lastName || !displayName || !username) {
      setError('First name, Last name, Display name, and Username are required');
      setSaveLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('display_name', displayName);
    formData.append('username', username.trim().toLowerCase());
    formData.append('batting_style', battingStyle);
    formData.append('bowling_style', bowlingStyle);
    formData.append('player_roles', roles.join(','));

    if (selectedFile) {
      formData.append('profile_picture', selectedFile);
    }

    try {
      const response = await axios.put(`http://localhost:5000/api/v1/players/${playerId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const updatedPlayer = response.data.player;
      setSuccess('Profile updated successfully!');
      
      // Update local storage user image reference if it changed
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      savedUser.profile_picture_url = updatedPlayer.profile_picture_url;
      localStorage.setItem('user', JSON.stringify(savedUser));
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
          <div>Loading player details...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div style={{
        maxWidth: '700px',
        margin: '2rem auto',
        padding: '0 1.5rem',
        width: '100%'
      }}>
        <div className="glass" style={{ padding: '2.5rem 2rem', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <User size={28} style={{ color: 'var(--secondary-color)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Edit Player Profile</h2>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(217, 83, 79, 0.1)',
              border: '1px solid rgba(217, 83, 79, 0.3)',
              borderRadius: '8px',
              color: '#D9534F',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(29, 79, 42, 0.1)',
              border: '1px solid rgba(29, 79, 42, 0.3)',
              borderRadius: '8px',
              color: 'var(--secondary-color)',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Avatar upload & Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-color)' }}
                  />
                ) : (
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--dominant-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '2rem'
                  }}>
                    {firstName.slice(0, 1) || 'P'}
                  </div>
                )}
                <label htmlFor="avatar-file" style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'var(--secondary-color)',
                  color: '#ffffff',
                  padding: '0.4rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  <Upload size={14} />
                  <input 
                    id="avatar-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click to upload profile photo</span>
            </div>

            {/* Form grid */}
            <div className="profile-form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>First Name *</label>
                <input 
                  type="text" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Last Name *</label>
                <input 
                  type="text" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Display Name (Scoreboard Display) *</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Username (Unique) *</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Batting Style *</label>
                <select value={battingStyle} onChange={(e) => setBattingStyle(e.target.value)}>
                  <option value="RIGHT_HAND">Right Hand Batsman</option>
                  <option value="LEFT_HAND">Left Hand Batsman</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Bowling Style</label>
                <select value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)}>
                  <option value="NONE">None</option>
                  <option value="RIGHT_ARM_FAST">Right Arm Fast</option>
                  <option value="RIGHT_ARM_MED">Right Arm Medium</option>
                  <option value="LEFT_ARM_FAST">Left Arm Fast</option>
                  <option value="LEFT_ARM_SPIN">Left Arm Spin</option>
                  <option value="RIGHT_ARM_OFF_BREAK">Right Arm Off Break</option>
                  <option value="RIGHT_ARM_LEG_BREAK">Right Arm Leg Break</option>
                  <option value="LEFT_ARM_UNORTHODOX">Left Arm Unorthodox</option>
                </select>
              </div>
            </div>

            {/* Roles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Player Roles</span>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'].map((role) => (
                  <label key={role} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={roles.includes(role)} 
                      onChange={() => handleRoleToggle(role)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {role.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: '1rem' }}>
              <button 
                type="submit" 
                disabled={saveLoading}
                className="btn btn-primary"
                style={{
                  padding: '0.85rem 2.5rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Save size={18} />
                {saveLoading ? 'Saving Profile...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Visual Career Analytics Section */}
        {playerId && chartData && (
          <div className="glass" style={{ padding: '2.5rem 2rem', marginTop: '2rem', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary-color)' }}>
              <Award size={22} style={{ color: 'var(--accent-color)' }} />
              Career Stats & Visual Analytics
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

export default ProfileEdit;
