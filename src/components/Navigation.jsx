import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Home, User, Users, LogOut, Calendar, Menu, X, Trophy, Settings as SettingsIcon, UserPlus } from 'lucide-react';

const Navigation = () => {
  const { logout, user, role } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home size={18} /> },
    { name: 'New Match', path: '/matches/new', icon: <Calendar size={18} /> },
    { name: 'Leaderboard', path: '/leaderboard', icon: <Trophy size={18} /> },
    { name: 'Teams', path: '/teams', icon: <Users size={18} /> }
  ];

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const closeDropdown = () => setDropdownOpen(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [dropdownOpen]);

  return (
    <nav className="nav-container glass">
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Shield size={24} style={{ color: 'var(--secondary-color)' }} />
        <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '-0.2px' }}>
          Bat<span style={{ color: 'var(--accent-color)' }}>N</span>Ball
        </span>
      </div>

      {/* Desktop Links */}
      <div className="nav-links-desktop">
        {user && navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: isActive ? 'var(--secondary-color)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'rgba(29, 79, 42, 0.08)' : 'transparent',
                transition: 'var(--transition)'
              }}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Right User Actions (Profile Dropdown / Sign In) */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {user ? (
          <>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(!dropdownOpen);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  padding: 0
                }}
              >
                {user.profile_picture_url ? (
                  <img 
                    src={user.profile_picture_url} 
                    alt="Avatar" 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--accent-color)' }}
                  />
                ) : (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-color)',
                    color: 'var(--dominant-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.8rem'
                  }}>
                    {user.phone_number ? user.phone_number.slice(-2) : 'U'}
                  </div>
                )}
              </button>

              {/* Profile Dropdown Menu */}
              {dropdownOpen && (
                <div 
                  className="glass"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    minWidth: '180px',
                    borderRadius: '8px',
                    padding: '0.5rem 0',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <Link
                    to="/profile"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color)',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <User size={14} />
                    Edit Profile
                  </Link>

                  <Link
                    to="/my-matches"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color)',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Trophy size={14} />
                    My Matches
                  </Link>

                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-color)',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <SettingsIcon size={14} />
                    Settings
                  </Link>

                  {role === 'SUPER_ADMIN' && (
                    <Link
                      to="/create-user"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-color)',
                        fontWeight: '600'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <UserPlus size={14} />
                      Create Account
                    </Link>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.4rem 0' }} />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      color: '#dc2626',
                      fontWeight: '750',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={14} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <Link 
            to="/login" 
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '700',
              color: '#fff',
              backgroundColor: 'var(--secondary-color)',
              textDecoration: 'none',
              transition: 'var(--transition)'
            }}
          >
            Sign In
          </Link>
        )}

        {/* Mobile Menu Hamburger Toggle */}
        {user && (
          <button 
            className="nav-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}
      </div>

      {/* Mobile Links Dropdown Drawer */}
      {user && (
        <div className={`nav-links-mobile ${menuOpen ? 'open' : ''}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={handleLinkClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: isActive ? 'var(--secondary-color)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(29, 79, 42, 0.08)' : 'transparent',
                  transition: 'var(--transition)'
                }}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navigation;
