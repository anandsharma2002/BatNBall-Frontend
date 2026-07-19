import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { Lock, AlertTriangle, CheckCircle } from 'lucide-react';

const Settings = () => {
  const { changePassword } = useAuth();

  // Password change state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    setPassLoading(true);

    if (!oldPass || !newPass || !confirmNewPass) {
      setPassError('All password fields are required');
      setPassLoading(false);
      return;
    }

    try {
      await changePassword(oldPass, newPass, confirmNewPass);
      setPassSuccess('Password updated successfully!');
      setOldPass('');
      setNewPass('');
      setConfirmNewPass('');
    } catch (err) {
      setPassError(err.message);
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <>
      <Navigation />
      <div style={{
        maxWidth: '600px',
        margin: '2rem auto',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div className="glass" style={{ padding: '2.5rem 2rem', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <Lock size={26} style={{ color: 'var(--secondary-color)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Account Settings</h2>
          </div>

          <form onSubmit={handleChangePassword} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
              Change Password
            </h3>

            {passError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(217, 83, 79, 0.1)',
                border: '1px solid rgba(217, 83, 79, 0.3)',
                borderRadius: '8px',
                color: '#D9534F',
                fontSize: '0.85rem'
              }}>
                <AlertTriangle size={16} />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(29, 79, 42, 0.1)',
                border: '1px solid rgba(29, 79, 42, 0.3)',
                borderRadius: '8px',
                color: 'var(--secondary-color)',
                fontSize: '0.85rem'
              }}>
                <CheckCircle size={16} />
                <span>{passSuccess}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Current Password</label>
              <input 
                type="password" 
                placeholder="Current Password" 
                value={oldPass} 
                onChange={(e) => setOldPass(e.target.value)} 
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>New Password</label>
              <input 
                type="password" 
                placeholder="New Password" 
                value={newPass} 
                onChange={(e) => setNewPass(e.target.value)} 
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Confirm New Password</label>
              <input 
                type="password" 
                placeholder="Confirm New Password" 
                value={confirmNewPass} 
                onChange={(e) => setConfirmNewPass(e.target.value)} 
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button type="submit" disabled={passLoading} className="btn btn-primary" style={{ padding: '0.85rem 2rem', fontWeight: '750' }}>
                {passLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Settings;
