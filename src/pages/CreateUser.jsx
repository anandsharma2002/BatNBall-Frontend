import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';

const CreateUser = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  // Redirect standard USERs away from this admin page
  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN') {
      navigate('/dashboard');
    }
  }, [role, navigate]);

  // Form states
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [battingStyle, setBattingStyle] = useState('RIGHT_HAND');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!phone || !pass || !username) {
      setError('Phone number, Password, and Username are required');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/v1/admin/users/create', {
        phone_number: phone.trim(),
        password: pass,
        username: username.trim().toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        batting_style: battingStyle
      });
      
      setSuccess(response.data.message || 'User created successfully!');
      
      // Reset form
      setPhone('');
      setPass('');
      setUsername('');
      setFirstName('');
      setLastName('');
      setDisplayName('');
      setBattingStyle('RIGHT_HAND');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user account.');
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <>
      <Navigation />
      <div style={{
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div className="glass" style={{ padding: '2.5rem 2rem', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <UserPlus size={26} style={{ color: 'var(--secondary-color)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Create New User Account</h2>
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

          <form onSubmit={handleCreateUser} className="profile-form-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Phone Number *</label>
              <input 
                type="text" 
                placeholder="+919876543210" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Password *</label>
              <input 
                type="password" 
                placeholder="Temporary Password" 
                value={pass} 
                onChange={(e) => setPass(e.target.value)} 
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Username (Unique) *</label>
              <input 
                type="text" 
                placeholder="e.g. viratkohli18" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required
              />
            </div>

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Display Name</label>
              <input 
                type="text" 
                placeholder="e.g. V. Kohli" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Batting Style</label>
              <select value={battingStyle} onChange={(e) => setBattingStyle(e.target.value)} style={{ width: '100%' }}>
                <option value="RIGHT_HAND">Right Hand Batsman</option>
                <option value="LEFT_HAND">Left Hand Batsman</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.85rem 2.5rem', fontWeight: '750', width: '100%' }}>
                {loading ? 'Creating User Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreateUser;
