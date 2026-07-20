import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { SOCKET_URL } from '../config';
import { Shield, Home, User, Users, LogOut, Calendar, Menu, X, Trophy, Settings as SettingsIcon, UserPlus } from 'lucide-react';

const Navigation = () => {
  const { logout, user, role } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Floating Toast State (2 seconds auto-dismiss)
  const [toast, setToast] = useState({ show: false, title: '', message: '', type: 'info' });
  const toastTimerRef = useRef(null);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home size={18} /> },
    { name: 'New Match', path: '/matches/new', icon: <Calendar size={18} /> },
    { name: 'Leaderboard', path: '/leaderboard', icon: <Trophy size={18} /> },
    { name: 'Teams', path: '/teams', icon: <Users size={18} /> }
  ];

  const navRef = useRef(null);
  const profileRef = useRef(null);

  const handleLinkClick = () => {
    setMenuOpen(false);
  };

  // Close profile dropdown & mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Read flash toast stored in sessionStorage upon redirect
  useEffect(() => {
    const flash = sessionStorage.getItem('flash_toast');
    if (flash) {
      try {
        const parsed = JSON.parse(flash);
        sessionStorage.removeItem('flash_toast');
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({
          show: true,
          title: parsed.title || 'MATCH CANCELLED',
          message: parsed.message || 'This match has been removed or cancelled.',
          type: parsed.type || 'warning'
        });
        toastTimerRef.current = setTimeout(() => {
          setToast({ show: false, title: '', message: '', type: 'info' });
        }, 3000);
      } catch (e) {
        sessionStorage.removeItem('flash_toast');
      }
    }
  }, [location.pathname]);

  // Global socket listener for team change & player drop notifications
  useEffect(() => {
    const socket = io(SOCKET_URL);

    const checkIsTargetPlayer = (data) => {
      if (!data || !data.playerId) return false;
      const userPlayerId = (user?.associated_player_id?._id || user?.associated_player_id)?.toString();
      const guestPlayerId = sessionStorage.getItem('joined_player') || (data.matchId ? sessionStorage.getItem(`joined_player_${data.matchId}`) : null);
      const targetPlayerId = data.playerId.toString();
      const isNameMatch = user?.display_name && data.playerName && user.display_name.trim().toLowerCase() === data.playerName.trim().toLowerCase();

      return (userPlayerId && userPlayerId === targetPlayerId) ||
             (guestPlayerId && guestPlayerId === targetPlayerId) ||
             isNameMatch;
    };

    const handlePlayerMoved = (data) => {
      if (checkIsTargetPlayer(data) && data.targetTeamName) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({
          show: true,
          title: 'TEAM CHANGED',
          message: `Your team has been changed to ${data.targetTeamName}`,
          type: 'info'
        });
        toastTimerRef.current = setTimeout(() => {
          setToast({ show: false, title: '', message: '', type: 'info' });
        }, 2000);
      }
    };

    const handlePlayerDropped = (data) => {
      if (checkIsTargetPlayer(data)) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({
          show: true,
          title: 'REMOVED FROM SQUAD',
          message: 'You have been removed from the match squad',
          type: 'warning'
        });
        toastTimerRef.current = setTimeout(() => {
          setToast({ show: false, title: '', message: '', type: 'info' });
        }, 2000);
      }
    };

    const handleMatchDiscarded = (data) => {
      const currentPath = window.location.pathname;
      const matchIdInPath = data?.matchId && currentPath.includes(data.matchId);

      if (matchIdInPath || currentPath.includes('/join')) {
        sessionStorage.setItem('flash_toast', JSON.stringify({
          title: 'MATCH DISCARDED',
          message: 'This match has been removed or cancelled by the creator.',
          type: 'warning'
        }));
        const prefix = currentPath.startsWith('/BatNBall-Frontend') ? '/BatNBall-Frontend' : '';
        window.location.href = window.location.origin + prefix + '/dashboard';
      }
    };

    socket.on('global_player_moved', handlePlayerMoved);
    socket.on('player_moved', handlePlayerMoved);
    socket.on('global_player_dropped', handlePlayerDropped);
    socket.on('player_dropped', handlePlayerDropped);
    socket.on('global_match_discarded', handleMatchDiscarded);
    socket.on('match_discarded', handleMatchDiscarded);

    return () => {
      socket.disconnect();
    };
  }, [user]);


  return (
    <>
      {/* Floating Global Toast Notification for 2 Seconds */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: toast.type === 'warning' ? '#D9534F' : 'var(--secondary-color)',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderLeft: `4px solid ${toast.type === 'warning' ? '#ff8c00' : 'var(--accent-color)'}`,
          fontSize: '0.9rem',
          fontWeight: '600'
        }}>
          <span style={{ fontSize: '1.2rem' }}>{toast.type === 'warning' ? '🚫' : '🔄'}</span>
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.9 }}>
              {toast.title}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{toast.message}</div>
          </div>
        </div>
      )}


      <nav ref={navRef} className="nav-container glass">

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
            <div ref={profileRef} style={{ position: 'relative' }}>
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

              {/* Profile Dropdown Menu (Solid Opaque Background) */}
              {dropdownOpen && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    minWidth: '190px',
                    borderRadius: '10px',
                    padding: '0.5rem 0',
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-color)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--dominant-color)',
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
                    Profile
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
  </>
  );
};

export default Navigation;

