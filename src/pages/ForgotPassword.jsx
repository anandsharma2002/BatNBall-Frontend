import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Phone, Key, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1 = Phone request, 2 = OTP verify & reset
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!phone) {
      setError('Please enter your phone number');
      setLoading(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/v1/auth/forgot-password/request', {
        phone_number: phone.trim()
      });
      setSuccess('Verification OTP code has been logged to the Backend console!');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request OTP. Check if number is registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!otp || !newPassword || !confirmPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/v1/auth/forgot-password/verify', {
        phone_number: phone.trim(),
        otp: otp.trim(),
        new_password: newPassword
      });
      setSuccess('Password reset successfully! You can now log in.');
      setStep(3); // success state
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify OTP or update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '1.5rem'
    }}>
      <div className="glass" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '2.5rem 2rem',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: 'var(--accent-color)',
          color: 'var(--dominant-color)'
        }}>
          <Shield size={32} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-color)', marginBottom: '0.25rem' }}>
            Password Recovery
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {step === 1 && 'Enter your phone number to receive a verification OTP code'}
            {step === 2 && 'Enter the verification OTP and your new password'}
            {step === 3 && 'Account recovery complete!'}
          </p>
        </div>

        {/* Error Alert */}
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
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
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
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* STEP 1: Phone Request */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="phone" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="phone"
                  type="text"
                  placeholder="+918888888888"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    paddingLeft: '2.75rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-accent"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                display: 'flex',
                justifyContent: 'center',
                fontWeight: '700'
              }}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verify & Reset */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* OTP Code */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="otp" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                Verification OTP (Check Backend Logs)
              </label>
              <div style={{ position: 'relative' }}>
                <Key size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{
                    paddingLeft: '2.75rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* New Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="newPassword" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="newPassword"
                  type="password"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    paddingLeft: '2.75rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="confirmPassword" style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-color)' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    paddingLeft: '2.75rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                display: 'flex',
                justifyContent: 'center',
                fontWeight: '700'
              }}
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* STEP 3: Success Navigation */}
        {step === 3 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontWeight: '700', textAlign: 'center' }}>
              Return to Login
            </Link>
          </div>
        )}

        {/* Back Link */}
        {step !== 3 && (
          <Link to="/login" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            Back to Login
          </Link>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
