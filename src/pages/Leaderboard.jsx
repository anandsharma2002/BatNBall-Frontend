import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Navigation from '../components/Navigation';
import { Award, Zap, Shield, Trophy, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import virat3Image from '../assets/Virat3.jpg';
import { API_BASE_URL as API, SOCKET_URL } from '../config';

const CapIcon = ({ color }) => (
  <svg viewBox="0 0 24 24" width="32" height="32" style={{ display: 'block' }}>
    {/* Cap Dome */}
    <path
      d="M12 4C7 4 4.5 7.5 4.5 12C6 11 8.5 11 10.5 12.5C11.5 11 13.5 9.5 16 10.5C18.5 11 19.5 12 19.5 12C19.5 7.5 17 4 12 4Z"
      fill={color}
    />
    {/* Cap Brim / Visor */}
    <path
      d="M3 13C6 14.5 9.5 15.5 12 15.5C14.5 15.5 18 14.5 21 13C22 15.5 19 18 12 18C5 18 2 15.5 3 13Z"
      fill={color}
      opacity="0.95"
    />
    {/* Highlight button on top */}
    <circle cx="12" cy="4" r="1.2" fill="#fff" />
  </svg>
);

const LeaderboardSkeleton = () => (
  <div style={{ maxWidth: '850px', margin: '2rem auto', padding: '0 1.5rem', width: '100%', boxSizing: 'border-box' }}>
    <style>{`
      @keyframes skeletonPulse {
        0% { opacity: 0.35; }
        50% { opacity: 0.75; }
        100% { opacity: 0.35; }
      }
      .skeleton-pulse {
        animation: skeletonPulse 1.4s infinite ease-in-out;
      }
    `}</style>
    
    {/* Title & Search Skeleton */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ width: '260px', height: '36px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} className="skeleton-pulse" />
      <div style={{ width: '240px', height: '38px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} className="skeleton-pulse" />
    </div>

    {/* Tabs Skeleton */}
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '150px', height: '44px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} className="skeleton-pulse" />
      <div style={{ flex: 1, minWidth: '150px', height: '44px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} className="skeleton-pulse" />
      <div style={{ flex: 1, minWidth: '150px', height: '44px', backgroundColor: 'var(--border-color)', borderRadius: '8px' }} className="skeleton-pulse" />
    </div>

    {/* Top 3 Podium Cards Skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: '170px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }} className="skeleton-pulse" />
      ))}
    </div>

    {/* Table Rows Skeleton */}
    <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ height: '46px', backgroundColor: 'var(--border-color)', borderRadius: '6px', marginBottom: i === 5 ? 0 : '0.75rem', opacity: 0.5 }} className="skeleton-pulse" />
      ))}
    </div>
  </div>
);

const LS_KEY_CAPS = 'bnb_leaderboard_caps_v1';
const LS_KEY_CHASE = 'bnb_leaderboard_chase_v1';
const LS_STALE_MS = 5 * 60 * 1000; // 5 min — show stale data, refresh silently

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > LS_STALE_MS };
  } catch { return null; }
};

const writeCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  // Seed from localStorage immediately so page is never blank
  const cachedCaps = readCache(LS_KEY_CAPS);
  const cachedChase = readCache(LS_KEY_CHASE);

  const [activeTab, setActiveTab] = useState('orange');
  const [capsData, setCapsData] = useState(cachedCaps?.data || { batters: [], bowlers: [] });
  const [chaseData, setChaseData] = useState(cachedChase?.data || []);
  // Only show skeleton if we have absolutely no cached data
  const [loading, setLoading] = useState(!cachedCaps?.data && !cachedChase?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Player search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError('');

      // Timeout after 12s to avoid hanging forever on cold backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const [capsRes, chaseRes] = await Promise.all([
        axios.get(`${API}/leaderboard/caps`, { ...authHeaders, signal: controller.signal }),
        axios.get(`${API}/leaderboard/chase-masters`, { ...authHeaders, signal: controller.signal })
      ]);
      clearTimeout(timeoutId);

      setCapsData(capsRes.data);
      setChaseData(chaseRes.data);
      writeCache(LS_KEY_CAPS, capsRes.data);
      writeCache(LS_KEY_CHASE, chaseRes.data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        // Timed out — if we already have stale data visible, silently fail
        if (!isBackground) setError('Server is waking up — please retry in a few seconds.');
      } else {
        if (!isBackground) setError(err.response?.data?.error || 'Failed to load leaderboards data.');
      }
      console.error('Error fetching leaderboards:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // If cache exists but is stale, refresh in background silently
    const cacheStale = cachedCaps?.stale || cachedChase?.stale;
    const noCache = !cachedCaps?.data && !cachedChase?.data;
    fetchData(noCache ? false : cacheStale ? true : false);

    const socket = io(SOCKET_URL);
    socket.on('global_leaderboard_updated', () => { fetchData(true); });
    socket.on('match_completed', () => { fetchData(true); });

    return () => { socket.disconnect(); };
  }, []);

  // Player search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      axios.get(`${API}/players/search?q=${searchQuery}`, authHeaders)
        .then(res => {
          setSearchResults(res.data);
          setSearchLoading(false);
        })
        .catch(err => {
          console.error(err);
          setSearchLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getBattingAvg = (runs, innings, notOuts) => {
    const dismissals = innings - notOuts;
    return dismissals > 0 ? (runs / dismissals).toFixed(1) : '-';
  };

  const getBowlingAvg = (runs, wickets) => {
    return wickets > 0 ? (runs / wickets).toFixed(1) : '-';
  };

  const getBowlingEcon = (runs, balls) => {
    return balls > 0 ? (runs / (balls / 6)).toFixed(2) : '0.00';
  };

  if (loading) return (
    <>
      <Navigation />
      <LeaderboardSkeleton />
    </>
  );

  if (error && capsData.batters.length === 0 && chaseData.length === 0) return (
    <>
      <Navigation />
      <div style={{ maxWidth: '850px', margin: '4rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
        <h3 style={{ fontWeight: '700', marginBottom: '0.5rem' }}>Server is waking up...</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          The backend may take 30–60 seconds to start on first visit. Please wait a moment.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => fetchData(false)}
          style={{ fontSize: '0.9rem' }}
        >
          Retry
        </button>
      </div>
    </>
  );

  return (
    <>
      <Navigation />

      {/* Subtle top bar shown when silently re-fetching stale cached data */}
      {refreshing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, var(--accent-color), var(--secondary-color), var(--accent-color))',
          backgroundSize: '200% 100%',
          animation: 'skeletonPulse 1.2s ease-in-out infinite',
          zIndex: 999
        }} />
      )}

      <div style={{
        maxWidth: '850px',
        margin: '2rem auto',
        padding: '0 1.5rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Title with Search */}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={28} style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Tournament Leaderboards</h2>
          </div>

          {/* Search Player Directory */}
          <div style={{ position: 'relative', width: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', backgroundColor: 'var(--card-bg)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search player username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', width: '100%', padding: '0.1rem 0', color: 'var(--text-color)', fontSize: '0.82rem' }}
              />
            </div>

            {searchQuery && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'var(--dominant-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                zIndex: 100,
                maxHeight: '250px',
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                marginTop: '0.5rem'
              }}>
                {searchLoading ? (
                  <div style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '0.8rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No players found</div>
                ) : (
                  searchResults.map(p => (
                    <div
                      key={p._id}
                      onClick={() => {
                        setSearchQuery('');
                        navigate(`/players/${p._id}`);
                      }}
                      style={{
                        padding: '0.8rem',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(29,79,42,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-color)', fontSize: '0.82rem' }}>{p.first_name} {p.last_name} ({p.display_name})</strong>
                        {p.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{p.username}</span>}
                      </div>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: '700', 
                        padding: '0.15rem 0.3rem', 
                        backgroundColor: 'var(--border-color)', 
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {(p.player_roles?.[0] || 'Player')
                          .toLowerCase()
                          .split('_')
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { id: 'orange', name: 'Orange Cap (Batting)' },
            { id: 'purple', name: 'Purple Cap (Bowling)' },
            { id: 'chase', name: 'Chase Masters' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1',
                minWidth: '150px',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: activeTab === tab.id 
                  ? tab.id === 'orange' 
                    ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                    : tab.id === 'purple'
                      ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                      : 'linear-gradient(135deg, #2a9d8f 0%, #264653 100%)'
                  : 'rgba(255,255,255,0.03)',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* ── ORANGE CAP (BATTING) ───────────────────────────────────────────── */}
        {activeTab === 'orange' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {capsData.batters.length === 0 ? (
              <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No batting data available yet. Complete matches to build the leaderboards!
              </div>
            ) : (
              capsData.batters.map((item, idx) => {
                const isWinner = idx === 0;
                return (
                  <div 
                    key={item._id}
                    className="glass"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.85rem',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      position: 'relative',
                      border: isWinner ? '2px solid #ea580c' : '1px solid var(--border-color)',
                      background: isWinner ? 'linear-gradient(135deg, rgba(234, 88, 12, 0.08) 0%, var(--card-bg) 100%)' : 'var(--card-bg)',
                      boxShadow: isWinner ? '0 4px 20px rgba(234, 88, 12, 0.15)' : 'var(--shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Rank */}
                      <div style={{
                        width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isWinner ? (
                          <CapIcon color="#ea580c" />
                        ) : (
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(120, 120, 120, 0.1)',
                            color: 'var(--text-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800', fontSize: '0.85rem',
                            border: '1px solid var(--border-color)'
                          }}>
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Photo */}
                      {item.player_id?.profile_picture_url ? (
                        <img 
                          src={item.player_id.profile_picture_url} 
                          alt="Avatar" 
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      ) : (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.8rem'
                        }}>
                          {item.player_id?.first_name?.[0] || 'B'}
                        </div>
                      )}

                      {/* Name */}
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <Link 
                            to={`/players/${item.player_id?._id}`} 
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {item.player_id?.display_name}
                          </Link>
                          {item.player_id?.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>@{item.player_id.username}</span>}
                          {isWinner && <Award size={14} style={{ color: '#ea580c' }} />}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.batting.matches_played} matches • {item.batting.innings_batted} innings
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="leaderboard-stats-grid">
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Runs</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#ea580c' }}>{item.batting.total_runs}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {getBattingAvg(item.batting.total_runs, item.batting.innings_batted, item.batting.not_outs)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SR</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {item.batting.balls_faced > 0 ? ((item.batting.total_runs / item.batting.balls_faced) * 100).toFixed(1) : '0.0'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>H.S.</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {item.batting.highest_score.runs}{item.batting.highest_score.is_not_out ? '*' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── PURPLE CAP (BOWLING) ───────────────────────────────────────────── */}
        {activeTab === 'purple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {capsData.bowlers.length === 0 ? (
              <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No bowling data available yet. Complete matches to build the leaderboards!
              </div>
            ) : (
              capsData.bowlers.map((item, idx) => {
                const isWinner = idx === 0;
                return (
                  <div 
                    key={item._id}
                    className="glass"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.85rem',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      position: 'relative',
                      border: isWinner ? '2px solid #7e22ce' : '1px solid var(--border-color)',
                      background: isWinner ? 'linear-gradient(135deg, rgba(126, 34, 206, 0.08) 0%, var(--card-bg) 100%)' : 'var(--card-bg)',
                      boxShadow: isWinner ? '0 4px 20px rgba(126, 34, 206, 0.15)' : 'var(--shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Rank */}
                      <div style={{
                        width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isWinner ? (
                          <CapIcon color="#a855f7" />
                        ) : (
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(120, 120, 120, 0.1)',
                            color: 'var(--text-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800', fontSize: '0.85rem',
                            border: '1px solid var(--border-color)'
                          }}>
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Photo */}
                      {item.player_id?.profile_picture_url ? (
                        <img 
                          src={item.player_id.profile_picture_url} 
                          alt="Avatar" 
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      ) : (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.8rem'
                        }}>
                          {item.player_id?.first_name?.[0] || 'W'}
                        </div>
                      )}

                      {/* Name */}
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <Link 
                            to={`/players/${item.player_id?._id}`} 
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {item.player_id?.display_name}
                          </Link>
                          {item.player_id?.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>@{item.player_id.username}</span>}
                          {isWinner && <Award size={14} style={{ color: '#7e22ce' }} />}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.bowling.innings_bowled} innings bowled • {Math.floor(item.bowling.balls_bowled / 6)} overs
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="leaderboard-stats-grid">
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wickets</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#7e22ce' }}>{item.bowling.wickets_taken}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {getBowlingAvg(item.bowling.runs_conceded, item.bowling.wickets_taken)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Econ</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {getBowlingEcon(item.bowling.runs_conceded, item.bowling.balls_bowled)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Best</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '750' }}>
                          {item.bowling.best_bowling_figures.wickets}-{item.bowling.best_bowling_figures.runs}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── CHASE MASTERS ──────────────────────────────────────────────────── */}
        {activeTab === 'chase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {chaseData.length === 0 ? (
              <div className="glass" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No chase statistics available. Win a match chasing to populate the Chase Master leaderboard!
              </div>
            ) : (
              chaseData.map((item, idx) => {
                const isWinner = idx === 0;
                return (
                  <div 
                    key={item.player?._id}
                    className="glass"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.85rem',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      position: 'relative',
                      border: isWinner ? '2px solid #2a9d8f' : '1px solid var(--border-color)',
                      background: isWinner ? 'linear-gradient(135deg, rgba(42, 157, 143, 0.08) 0%, var(--card-bg) 100%)' : 'var(--card-bg)',
                      boxShadow: isWinner ? '0 4px 20px rgba(42, 157, 143, 0.15)' : 'var(--shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Rank */}
                      <div style={{
                        width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isWinner ? (
                          <img 
                            src={virat3Image} 
                            alt="Chase Master" 
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2a9d8f' }} 
                          />
                        ) : (
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(120, 120, 120, 0.1)',
                            color: 'var(--text-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800', fontSize: '0.85rem',
                            border: '1px solid var(--border-color)'
                          }}>
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Photo */}
                      {item.player?.profile_picture_url ? (
                        <img 
                          src={item.player.profile_picture_url} 
                          alt="Avatar" 
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                      ) : (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '800', fontSize: '0.8rem'
                        }}>
                          {item.player?.first_name?.[0] || 'C'}
                        </div>
                      )}

                      {/* Name */}
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <Link 
                            to={`/players/${item.player?._id}`} 
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {item.player?.display_name}
                          </Link>
                          {item.player?.username && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500' }}>@{item.player.username}</span>}
                          {isWinner && <Zap size={14} style={{ color: '#2a9d8f' }} />}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Chased in {item.chaseTotal} matches • {item.chaseWins} wins ({item.winPct}%)
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="leaderboard-stats-grid">
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Runs</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#2a9d8f' }}>{item.chaseRuns}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wins</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#2a9d8f' }}>{item.chaseWins}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Not Outs</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#2a9d8f' }}>{item.notOutsInSuccessfulChases ?? 0}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score (CMI)</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--secondary-color)' }}>{item.score}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default Leaderboard;
