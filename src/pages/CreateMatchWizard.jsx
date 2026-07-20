import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, SOCKET_URL } from '../config';
import { Calendar, MapPin, Settings, Clipboard, Check, Plus, UserPlus, Trophy, AlertTriangle, UserMinus, GripVertical, Trash2 } from 'lucide-react';


const getLocalDateTimeString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localNow = new Date(now.getTime() - offset * 60 * 1000);
  return localNow.toISOString().slice(0, 16);
};

// Helper to auto-generate team short name
const generateShortName = (name) => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return words.map(w => w[0]).join('').substring(0, 5).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
};

const CreateMatchWizard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState(1); // 1 = Config, 2 = Roster, 3 = Toss
  const [matchId, setMatchId] = useState(null);
  const [_socket, setSocket] = useState(null);

  // Load from localStorage for quick creation fallback
  const savedConfigStr = localStorage.getItem('last_match_config');
  const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;

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

  // Drag and drop state & handlers
  const [dragOverTeam, setDragOverTeam] = useState(null);

  const handleDragStart = (e, player, sourceTeamId, isSubstitute = false) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      playerId: player._id,
      playerName: player.display_name,
      sourceTeamId,
      isSubstitute
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, teamKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTeam !== teamKey) {
      setDragOverTeam(teamKey);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverTeam(null);
  };


  const handleDropOnTeam = async (e, targetTeamId, teamKey, defaultIsSub = false) => {
    e.preventDefault();
    setDragOverTeam(null);

    try {
      const dataRaw = e.dataTransfer.getData('application/json');
      if (!dataRaw) return;
      const { playerId, sourceTeamId, isSubstitute } = JSON.parse(dataRaw);

      if (sourceTeamId === targetTeamId) return;

      const canSub = matchData?.match_rules?.allow_substitutes !== false;
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/matches/${matchId}/move-player`, {
        playerId,
        targetTeamId,
        isSubstitute: canSub ? (isSubstitute || defaultIsSub) : false
      });


      setMatchData(response.data.match);
      // Toast notification is broadcast to the affected player via Socket.IO, not displayed to admin
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to move player to team.');
    } finally {
      setLoading(false);
    }
  };

  const handleDropPlayer = async (e, playerId, playerName) => {
    e.stopPropagation();
    if (!matchId || !playerId) return;

    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/matches/${matchId}/drop-player`, { playerId });
      setMatchData(response.data.match);
      setSuccess(`Dropped ${playerName} from match roster.`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to drop player from roster.');
    } finally {
      setLoading(false);
    }
  };

  // Phase 1 states: Match Config
  const [venue, setVenue] = useState(savedConfig?.venue || '');
  const [dateTime, setDateTime] = useState(getLocalDateTimeString());
  const [totalOvers, setTotalOvers] = useState(savedConfig?.totalOvers || 20);
  const [maxOversPerBowler, setMaxOversPerBowler] = useState(savedConfig?.maxOversPerBowler || 4);
  const [ballType, setBallType] = useState(savedConfig?.ballType || 'LEATHER_WHITE');
  const [rules, setRules] = useState(savedConfig?.rules || {
    wide_ball_run_added: true,
    no_ball_run_calculated: true,
    no_ball_free_hit_enabled: true,
    overthrow_runs_allowed: true,
    bye_runs_allowed: true,
    leg_bye_runs_allowed: true,
    penalty_runs_allowed: true,
    allow_substitutes: true
  });

  // Phase 2 states: Teams & Roster
  const [teamsList, setTeamsList] = useState([]);
  const [_teamFirstId, setTeamFirstId] = useState(savedConfig?.teamFirstId || '');
  const [_teamSecondId, setTeamSecondId] = useState(savedConfig?.teamSecondId || '');

  const [matchData, setMatchData] = useState(null);

  // Autocomplete states for Team A and Team B
  const [teamFirstSearch, setTeamFirstSearch] = useState('');
  const [teamFirstSelectedId, setTeamFirstSelectedId] = useState(savedConfig?.teamFirstId || null);
  const [showTeamFirstDropdown, setShowTeamFirstDropdown] = useState(false);

  const [teamSecondSearch, setTeamSecondSearch] = useState('');
  const [teamSecondSelectedId, setTeamSecondSelectedId] = useState(savedConfig?.teamSecondId || null);
  const [showTeamSecondDropdown, setShowTeamSecondDropdown] = useState(false);

  // Sync search inputs once teamsList loads
  useEffect(() => {
    if (teamsList.length > 0) {
      if (teamFirstSelectedId) {
        const team = teamsList.find(t => t._id === teamFirstSelectedId);
        if (team) setTeamFirstSearch(team.team_name);
      }
      if (teamSecondSelectedId) {
        const team = teamsList.find(t => t._id === teamSecondSelectedId);
        if (team) setTeamSecondSearch(team.team_name);
      }
    }
  }, [teamsList, teamFirstSelectedId, teamSecondSelectedId]);

  // Search & add players per team states
  const [teamASearchQuery, setTeamASearchQuery] = useState('');
  const [teamASearchResults, setTeamASearchResults] = useState([]);
  const [showTeamADropdown, setShowTeamADropdown] = useState(false);

  const [teamBSearchQuery, setTeamBSearchQuery] = useState('');
  const [teamBSearchResults, setTeamBSearchResults] = useState([]);
  const [showTeamBDropdown, setShowTeamBDropdown] = useState(false);

  const teamASearchRef = useRef(null);
  const teamBSearchRef = useRef(null);

  // Close search player dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (teamASearchRef.current && !teamASearchRef.current.contains(e.target)) {
        setShowTeamADropdown(false);
      }
      if (teamBSearchRef.current && !teamBSearchRef.current.contains(e.target)) {
        setShowTeamBDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Phase 3 states: Toss
  const [tossWinner, setTossWinner] = useState('');
  const [tossDecision, setTossDecision] = useState('BAT');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  // Discard Match modal states
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [discarding, setDiscarding] = useState(false);


  const handleDiscardMatch = async () => {
    const targetId = matchData?._id || sessionStorage.getItem('draftMatchId');
    setDiscarding(true);

    try {
      if (targetId) {
        await axios.delete(`${API_BASE_URL}/matches/${targetId}`);
      }
    } catch (err) {
      console.error('Discard match error:', err);
    } finally {
      sessionStorage.removeItem('draftMatchId');
      sessionStorage.removeItem('draftMatchConfig');
      setMatchData(null);
      setShowDiscardModal(false);
      setDiscarding(false);
      navigate('/dashboard');
    }
  };


  // Load teams list
  useEffect(() => {
    axios.get(`${API_BASE_URL}/teams`)
      .then(res => setTeamsList(res.data))
      .catch(err => console.error('Fetch teams error:', err));
  }, []);


  // Socket IO listener for live roster updates
  useEffect(() => {
    if (!matchId) return;

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.emit('join_match_room', matchId);

    newSocket.on('player_joined', (data) => {
      setMatchData(data.match);
      setSuccess(data.message);
      setTimeout(() => setSuccess(''), 3000);
    });

    newSocket.on('toss_updated', (data) => {
      setMatchData(data.match);
    });

    newSocket.on('player_dropped', (data) => {
      setMatchData(data.match);
      setSuccess(data.message);
      setTimeout(() => setSuccess(''), 2000);
    });

    newSocket.on('player_moved', (data) => {
      setMatchData(data.match);

      // Show toast only to the player whose team got changed
      const currentUserPlayerId = (user?.associated_player_id?._id || user?.associated_player_id)?.toString();
      const guestPlayerId = sessionStorage.getItem(`joined_player_${matchId}`);
      const targetPlayerId = data.playerId?.toString();

      const isTargetPlayer = (currentUserPlayerId && currentUserPlayerId === targetPlayerId) ||
                             (guestPlayerId && guestPlayerId === targetPlayerId);

      if (isTargetPlayer && data.targetTeamName) {
        triggerToast(`Your team has been changed to ${data.targetTeamName}`);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [matchId, user]);



  // Autocomplete search for Team A
  useEffect(() => {
    if (!teamASearchQuery.trim()) {
      setTeamASearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      axios.get(`${API_BASE_URL}/players/search?q=${encodeURIComponent(teamASearchQuery.trim())}`)
        .then(res => {
          if (matchData) {
            const registeredIds = [
              ...matchData.playing_xi_team_first,
              ...matchData.playing_xi_team_second,
              ...matchData.substitutes_team_first,
              ...matchData.substitutes_team_second
            ].map(p => p._id);
            setTeamASearchResults(res.data.filter(p => !registeredIds.includes(p._id)));
          } else {
            setTeamASearchResults(res.data);
          }
        })
        .catch(err => console.error(err));
    }, 250);

    return () => clearTimeout(timer);
  }, [teamASearchQuery, matchData]);

  // Autocomplete search for Team B
  useEffect(() => {
    if (!teamBSearchQuery.trim()) {
      setTeamBSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      axios.get(`${API_BASE_URL}/players/search?q=${encodeURIComponent(teamBSearchQuery.trim())}`)
        .then(res => {
          if (matchData) {
            const registeredIds = [
              ...matchData.playing_xi_team_first,
              ...matchData.playing_xi_team_second,
              ...matchData.substitutes_team_first,
              ...matchData.substitutes_team_second
            ].map(p => p._id);
            setTeamBSearchResults(res.data.filter(p => !registeredIds.includes(p._id)));
          } else {
            setTeamBSearchResults(res.data);
          }
        })
        .catch(err => console.error(err));
    }, 250);

    return () => clearTimeout(timer);
  }, [teamBSearchQuery, matchData]);





  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedFirst = teamFirstSearch.trim();
    const trimmedSecond = teamSecondSearch.trim();

    if (!venue || !dateTime || !trimmedFirst || !trimmedSecond) {
      setError('Please fill in all configuration and team fields');
      return;
    }

    if (trimmedFirst.toLowerCase() === trimmedSecond.toLowerCase()) {
      setError('Please enter two different team names');
      return;
    }

    setLoading(true);

    try {
      // 1. Resolve Team A
      let firstId = teamFirstSelectedId;
      if (!firstId) {
        const matched = teamsList.find(t => t.team_name.toLowerCase() === trimmedFirst.toLowerCase());
        if (matched) {
          firstId = matched._id;
        } else {
          const shortName = generateShortName(trimmedFirst);
          const teamRes = await axios.post(`${API_BASE_URL}/teams`, {
            team_name: trimmedFirst,
            team_short_name: shortName
          });
          firstId = teamRes.data.team._id;
        }
      }

      // 2. Resolve Team B
      let secondId = teamSecondSelectedId;
      if (!secondId) {
        const matched = teamsList.find(t => t.team_name.toLowerCase() === trimmedSecond.toLowerCase());
        if (matched) {
          secondId = matched._id;
        } else {
          const shortName = generateShortName(trimmedSecond);
          const teamRes = await axios.post(`${API_BASE_URL}/teams`, {
            team_name: trimmedSecond,
            team_short_name: shortName
          });
          secondId = teamRes.data.team._id;
        }
      }

      // Sync local state IDs
      setTeamFirstId(firstId);
      setTeamSecondId(secondId);

      // Save configuration to localStorage
      localStorage.setItem('last_match_config', JSON.stringify({
        venue,
        totalOvers,
        maxOversPerBowler,
        ballType,
        rules,
        teamFirstId: firstId,
        teamSecondId: secondId
      }));

      const res = await axios.post(`${API_BASE_URL}/matches`, {
        venue,
        match_date_time: dateTime,
        total_overs_per_innings: totalOvers,
        max_overs_per_bowler: maxOversPerBowler,
        ball_type: ballType,
        team_first_id: firstId,
        team_second_id: secondId,
        match_rules: rules,
        umpires: []
      });

      setMatchId(res.data.match._id);
      
      // Fetch fresh populated match details
      const matchDetails = await axios.get(`${API_BASE_URL}/matches/${res.data.match._id}`);
      setMatchData(matchDetails.data);
      
      setPhase(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to configure match.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayerToTeam = async (displayName, targetTeamId, clearSearchFn) => {
    if (!matchId || !displayName || !displayName.trim() || !targetTeamId) return;

    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/matches/${matchId}/join`, {
        display_name: displayName.trim(),
        team_id: targetTeamId,
        is_substitute: false
      });

      setMatchData(response.data.match);
      setSuccess(`Added ${displayName.trim()} to roster.`);
      setTimeout(() => setSuccess(''), 2000);
      if (clearSearchFn) clearSearchFn('');
      setShowTeamADropdown(false);
      setShowTeamBDropdown(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add player to team.');
    } finally {
      setLoading(false);
    }
  };


  const handleCopyLink = () => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}matches/${matchId}/join`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleUmpire = async (playerId) => {
    let currentUmpires = (matchData?.umpires || []).map(u => u._id || u);
    if (currentUmpires.includes(playerId)) {
      currentUmpires = currentUmpires.filter(id => id !== playerId);
    } else {
      currentUmpires.push(playerId);
    }

    try {
      const res = await axios.put(`${API_BASE_URL}/matches/${matchId}/umpires`, {
        umpires: currentUmpires
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMatchData(res.data.match);
      setSuccess('Umpire designation updated successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update umpires.');
    }
  };

  const handleTossSubmit = async (e) => {
    e.preventDefault();
    if (!matchId || !tossWinner || !tossDecision) return;

    setError('');
    setLoading(true);

    try {
      await axios.put(`${API_BASE_URL}/matches/${matchId}/toss`, {
        toss_won_by_team_id: tossWinner,
        toss_decision: tossDecision
      });
      
      // Match is now LIVE → navigate to Live Scoring Board
      navigate(`/matches/${matchId}/score`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record toss.');
      setLoading(false);
    }
  };

  const filteredTeamA = teamsList.filter(t => 
    t.team_name.toLowerCase().includes(teamFirstSearch.toLowerCase())
  );
  const filteredTeamB = teamsList.filter(t => 
    t.team_name.toLowerCase().includes(teamSecondSearch.toLowerCase())
  );

  return (
    <>
      <Navigation />

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

      <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1.5rem', width: '100%' }}>

        
        {/* Wizard Steps indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          {['1. Configuration', '2. Live Roster', '3. Toss Setup'].map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = phase === stepNum;
            const isCompleted = phase > stepNum;
            return (
              <div key={step} style={{
                fontWeight: isActive ? '800' : '600',
                color: isActive ? 'var(--secondary-color)' : isCompleted ? 'var(--text-color)' : 'var(--text-muted)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'var(--secondary-color)' : isCompleted ? 'var(--accent-color)' : 'var(--border-color)',
                  color: isActive || isCompleted ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem'
                }}>
                  {isCompleted ? '✓' : stepNum}
                </span>
                {step}
              </div>
            );
          })}
        </div>

        {/* Global Errors/Success */}
        {error && (
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', border: '1px solid rgba(217, 83, 79, 0.3)', color: '#D9534F', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', border: '1px solid rgba(29, 79, 42, 0.3)', color: 'var(--secondary-color)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            <Check size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* PHASE 1: CONFIGURATION */}
        {phase === 1 && (
          <div className="glass" style={{ padding: '2rem', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Settings size={24} style={{ color: 'var(--secondary-color)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Configure Match Rules</h3>
            </div>

            <form onSubmit={handleConfigSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Form Grid */}
              <div className="profile-form-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}><MapPin size={14} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />Venue *</label>
                  <input type="text" placeholder="e.g. Wankhede Stadium" value={venue} onChange={(e) => setVenue(e.target.value)} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />Date & Time *</label>
                  <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Total Overs *</label>
                  <input type="number" min="1" max="50" value={totalOvers} onChange={(e) => setTotalOvers(e.target.value)} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Max Overs Per Bowler *</label>
                  <input type="number" min="1" max="10" value={maxOversPerBowler} onChange={(e) => setMaxOversPerBowler(e.target.value)} required />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Ball Type *</label>
                  <select value={ballType} onChange={(e) => setBallType(e.target.value)}>
                    <option value="LEATHER_WHITE">Leather White</option>
                    <option value="LEATHER_RED">Leather Red</option>
                    <option value="LEATHER_PINK">Leather Pink</option>
                    <option value="TENNIS">Tennis</option>
                    <option value="TAPE_TENNIS">Tape Tennis</option>
                    <option value="COSCO">Cosco</option>
                  </select>
                </div>
              </div>

              {/* Team selection */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }} className="profile-form-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Team A *</label>
                  <input
                    type="text"
                    placeholder="Search or type new Team A"
                    value={teamFirstSearch}
                    onChange={(e) => {
                      setTeamFirstSearch(e.target.value);
                      const matched = teamsList.find(t => t.team_name.toLowerCase() === e.target.value.toLowerCase().trim());
                      setTeamFirstSelectedId(matched ? matched._id : null);
                      setShowTeamFirstDropdown(true);
                    }}
                    onFocus={() => setShowTeamFirstDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowTeamFirstDropdown(false), 200);
                    }}
                    required
                  />
                  {showTeamFirstDropdown && filteredTeamA.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: 'var(--dominant-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow)',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      marginTop: '0.2rem'
                    }}>
                      {filteredTeamA.map(t => (
                        <div
                          key={t._id}
                          onMouseDown={() => {
                            setTeamFirstSearch(t.team_name);
                            setTeamFirstSelectedId(t._id);
                            setShowTeamFirstDropdown(false);
                          }}
                          style={{
                            padding: '0.6rem 1rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          {t.team_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Team B *</label>
                  <input
                    type="text"
                    placeholder="Search or type new Team B"
                    value={teamSecondSearch}
                    onChange={(e) => {
                      setTeamSecondSearch(e.target.value);
                      const matched = teamsList.find(t => t.team_name.toLowerCase() === e.target.value.toLowerCase().trim());
                      setTeamSecondSelectedId(matched ? matched._id : null);
                      setShowTeamSecondDropdown(true);
                    }}
                    onFocus={() => setShowTeamSecondDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowTeamSecondDropdown(false), 200);
                    }}
                    required
                  />
                  {showTeamSecondDropdown && filteredTeamB.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: 'var(--dominant-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow)',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      marginTop: '0.2rem'
                    }}>
                      {filteredTeamB.map(t => (
                        <div
                          key={t._id}
                          onMouseDown={() => {
                            setTeamSecondSearch(t.team_name);
                            setTeamSecondSelectedId(t._id);
                            setShowTeamSecondDropdown(false);
                          }}
                          style={{
                            padding: '0.6rem 1rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          {t.team_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rules Checklist */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--secondary-color)', marginBottom: '0.75rem', display: 'block' }}>Match Scoring Settings</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {Object.keys(rules).map((ruleKey) => (
                    <label key={ruleKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={rules[ruleKey]} 
                        onChange={(e) => setRules({ ...rules, [ruleKey]: e.target.checked })}
                        style={{ width: '16px', height: '16px' }}
                      />
                      {ruleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => setShowDiscardModal(true)} 
                  className="btn btn-outline" 
                  style={{ padding: '0.85rem 1.75rem', fontWeight: '700', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                >
                  Back
                </button>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.85rem 2.5rem', fontWeight: '700' }}>
                  {loading ? 'Initializing Match...' : 'Configure & Next'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* PHASE 2: LIVE ROSTER JOIN */}
        {phase === 2 && matchData && (
          <div className="glass" style={{ padding: '2rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--secondary-color)' }}>
                Roster Join & Live Synchronization
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Copy the shared link and distribute to players or spectators to let them join their squads remotely in real time.
              </p>
            </div>

            {/* Share link box */}
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
              <input 
                type="text" 
                readOnly 
                value={`http://localhost:5173/matches/${matchId}/join`} 
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.85rem', padding: 0 }}
              />
              <button 
                onClick={handleCopyLink} 
                className="btn" 
                style={{ 
                  padding: '0.4rem 1rem', 
                  fontSize: '0.8rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem', 
                  border: 'none',
                  backgroundColor: 'var(--secondary-color)',
                  color: '#ffffff',
                  fontWeight: '600'
                }}
              >
                {copied ? <Check size={14} style={{ color: '#ffffff' }} /> : <Clipboard size={14} style={{ color: '#ffffff' }} />}
                <span style={{ color: '#ffffff' }}>{copied ? 'Copied' : 'Copy Invite'}</span>
              </button>
            </div>

            {/* Live Rosters Lists */}
            <div className="responsive-grid-2col">
              {/* Team First */}
              <div 

                onDragOver={(e) => handleDragOver(e, 'team_first')}
                onDragLeave={(e) => handleDragLeave(e, 'team_first')}
                onDrop={(e) => handleDropOnTeam(e, matchData.team_first_id?._id, 'team_first')}
                style={{ 
                  border: dragOverTeam === 'team_first' ? '2px dashed var(--secondary-color)' : '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  backgroundColor: dragOverTeam === 'team_first' ? 'rgba(29, 79, 42, 0.08)' : 'rgba(0,0,0,0.01)',
                  transition: 'all 0.2s'
                }}
              >
                <h4 style={{ fontWeight: '800', color: 'var(--secondary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{matchData.team_first_id?.team_name}</span>
                  {dragOverTeam === 'team_first' && <span style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>Drop player here</span>}
                </h4>

                {/* Quick Add Player to Team A */}
                <div ref={teamASearchRef} style={{ marginBottom: '1rem', position: 'relative' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <UserPlus size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder={`Search & add player to ${matchData.team_first_id?.team_name}...`}
                      value={teamASearchQuery}
                      onChange={(e) => {
                        setTeamASearchQuery(e.target.value);
                        setShowTeamADropdown(true);
                      }}
                      onFocus={() => setShowTeamADropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPlayerToTeam(teamASearchQuery, matchData.team_first_id?._id, setTeamASearchQuery);
                        }
                      }}
                      style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', width: '100%', fontSize: '0.85rem', height: '38px', borderRadius: '6px' }}
                    />
                  </div>

                  {/* Autocomplete Results Dropdown */}
                  {showTeamADropdown && teamASearchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--dominant-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      zIndex: 20,
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginTop: '0.3rem',
                      boxShadow: 'var(--shadow)'
                    }}>
                      {teamASearchResults.map(p => (
                        <div
                          key={p._id}
                          onMouseDown={() => {
                            handleAddPlayerToTeam(p.display_name, matchData.team_first_id?._id, setTeamASearchQuery);
                          }}
                          style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            padding: '0.55rem 0.85rem',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>{p.display_name}</span>
                          <Plus size={14} style={{ color: 'var(--secondary-color)', strokeWidth: 2.5 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>Playing XI (Click to toggle Umpire, Drag to move):</strong>
                  {matchData.playing_xi_team_first.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>None joined (Drop player here).</span> : (
                    matchData.playing_xi_team_first.map(p => {
                      const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                      return (
                        <div 
                          key={p._id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, p, matchData.team_first_id?._id, false)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                            backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.15)' : 'var(--dominant-color)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                          title="Drag to transfer team | Click name to toggle Umpire"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                            <span onClick={() => handleToggleUmpire(p._id)} style={{ cursor: 'pointer', fontWeight: '500' }}>
                              {p.display_name}
                            </span>
                            {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDropPlayer(e, p._id, p.display_name)}
                            title="Drop player from team"
                            style={{
                              background: 'rgba(217, 83, 79, 0.1)',
                              border: '1px solid rgba(217, 83, 79, 0.3)',
                              color: '#D9534F',
                              borderRadius: '4px',
                              padding: '0.2rem 0.35rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.15s',
                              marginLeft: 'auto'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.25)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.1)'}
                          >
                            <UserMinus size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                  {matchData.match_rules?.allow_substitutes === true && (
                    <>
                      <strong style={{ marginTop: '0.5rem' }}>Substitutes (Click to toggle Umpire, Drag to move):</strong>
                      {matchData.substitutes_team_first.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>None joined.</span> : (
                        matchData.substitutes_team_first.map(p => {
                          const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                          return (
                            <div 
                              key={p._id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, p, matchData.team_first_id?._id, true)}
                              style={{
                                padding: '0.45rem 0.75rem',
                                border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.15)' : 'var(--dominant-color)',
                                borderRadius: '6px',
                                cursor: 'grab',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              title="Drag to transfer team | Click name to toggle Umpire"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                                <span onClick={() => handleToggleUmpire(p._id)} style={{ cursor: 'pointer', fontWeight: '500' }}>
                                  {p.display_name}
                                </span>
                                {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handleDropPlayer(e, p._id, p.display_name)}
                                title="Drop player from team"
                                style={{
                                  background: 'rgba(217, 83, 79, 0.1)',
                                  border: '1px solid rgba(217, 83, 79, 0.3)',
                                  color: '#D9534F',
                                  borderRadius: '4px',
                                  padding: '0.2rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.15s',
                                  marginLeft: 'auto'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.25)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.1)'}
                              >
                                <UserMinus size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Team Second */}
              <div 
                onDragOver={(e) => handleDragOver(e, 'team_second')}
                onDragLeave={(e) => handleDragLeave(e, 'team_second')}
                onDrop={(e) => handleDropOnTeam(e, matchData.team_second_id?._id, 'team_second')}
                style={{ 
                  border: dragOverTeam === 'team_second' ? '2px dashed var(--secondary-color)' : '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '1rem', 
                  backgroundColor: dragOverTeam === 'team_second' ? 'rgba(29, 79, 42, 0.08)' : 'rgba(0,0,0,0.01)',
                  transition: 'all 0.2s'
                }}
              >
                <h4 style={{ fontWeight: '800', color: 'var(--secondary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{matchData.team_second_id?.team_name}</span>
                  {dragOverTeam === 'team_second' && <span style={{ fontSize: '0.75rem', color: 'var(--secondary-color)' }}>Drop player here</span>}
                </h4>

                {/* Quick Add Player to Team B */}
                <div ref={teamBSearchRef} style={{ marginBottom: '1rem', position: 'relative' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <UserPlus size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder={`Search & add player to ${matchData.team_second_id?.team_name}...`}
                      value={teamBSearchQuery}
                      onChange={(e) => {
                        setTeamBSearchQuery(e.target.value);
                        setShowTeamBDropdown(true);
                      }}
                      onFocus={() => setShowTeamBDropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPlayerToTeam(teamBSearchQuery, matchData.team_second_id?._id, setTeamBSearchQuery);
                        }
                      }}
                      style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', width: '100%', fontSize: '0.85rem', height: '38px', borderRadius: '6px' }}
                    />
                  </div>


                  {/* Autocomplete Results Dropdown */}
                  {showTeamBDropdown && teamBSearchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--dominant-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      zIndex: 20,
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginTop: '0.3rem',
                      boxShadow: 'var(--shadow)'
                    }}>
                      {teamBSearchResults.map(p => (
                        <div
                          key={p._id}
                          onMouseDown={() => {
                            handleAddPlayerToTeam(p.display_name, matchData.team_second_id?._id, setTeamBSearchQuery);
                          }}
                          style={{
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            padding: '0.55rem 0.85rem',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(29, 79, 42, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>{p.display_name}</span>
                          <Plus size={14} style={{ color: 'var(--secondary-color)', strokeWidth: 2.5 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>Playing XI (Click to toggle Umpire, Drag to move):</strong>
                  {matchData.playing_xi_team_second.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>None joined (Drop player here).</span> : (
                    matchData.playing_xi_team_second.map(p => {
                      const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                      return (
                        <div 
                          key={p._id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, p, matchData.team_second_id?._id, false)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                            backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.15)' : 'var(--dominant-color)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                          title="Drag to transfer team | Click name to toggle Umpire"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                            <span onClick={() => handleToggleUmpire(p._id)} style={{ cursor: 'pointer', fontWeight: '500' }}>
                              {p.display_name}
                            </span>
                            {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDropPlayer(e, p._id, p.display_name)}
                            title="Drop player from team"
                            style={{
                              background: 'rgba(217, 83, 79, 0.1)',
                              border: '1px solid rgba(217, 83, 79, 0.3)',
                              color: '#D9534F',
                              borderRadius: '4px',
                              padding: '0.2rem 0.35rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.15s',
                              marginLeft: 'auto'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.25)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.1)'}
                          >
                            <UserMinus size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                  {matchData.match_rules?.allow_substitutes === true && (
                    <>
                      <strong style={{ marginTop: '0.5rem' }}>Substitutes (Click to toggle Umpire, Drag to move):</strong>
                      {matchData.substitutes_team_second.length === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>None joined.</span> : (
                        matchData.substitutes_team_second.map(p => {
                          const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                          return (
                            <div 
                              key={p._id} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, p, matchData.team_second_id?._id, true)}
                              style={{
                                padding: '0.45rem 0.75rem',
                                border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.15)' : 'var(--dominant-color)',
                                borderRadius: '6px',
                                cursor: 'grab',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              title="Drag to transfer team | Click name to toggle Umpire"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                                <span onClick={() => handleToggleUmpire(p._id)} style={{ cursor: 'pointer', fontWeight: '500' }}>
                                  {p.display_name}
                                </span>
                                {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => handleDropPlayer(e, p._id, p.display_name)}
                                title="Drop player from team"
                                style={{
                                  background: 'rgba(217, 83, 79, 0.1)',
                                  border: '1px solid rgba(217, 83, 79, 0.3)',
                                  color: '#D9534F',
                                  borderRadius: '4px',
                                  padding: '0.2rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.15s',
                                  marginLeft: 'auto'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.25)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(217, 83, 79, 0.1)'}
                              >
                                <UserMinus size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>



            {/* Next step buttons */}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={() => setShowDiscardModal(true)} 
                className="btn btn-outline" 
                style={{ color: '#D9534F', borderColor: 'rgba(217, 83, 79, 0.4)', padding: '0.85rem 1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Trash2 size={16} />
                Discard Match
              </button>
              <button 
                onClick={() => {
                  // Basic validation: must have at least 1 player on each team (or wait until toss phase)
                  if (matchData.playing_xi_team_first.length === 0 || matchData.playing_xi_team_second.length === 0) {
                    setError('Both teams need at least 1 player to proceed.');
                    return;
                  }
                  // Set default toss winner option to Team A
                  setTossWinner(matchData.team_first_id?._id);
                  setPhase(3);
                  setError('');
                }} 
                className="btn btn-primary" 
                style={{ padding: '0.85rem 3rem', fontWeight: '700' }}
              >
                Proceed to Toss Setup
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3: TOSS SETUP */}
        {phase === 3 && matchData && (
          <div className="glass" style={{ padding: '2.5rem 2rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Trophy size={28} style={{ color: 'var(--accent-color)' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Coin Toss Registry</h3>
            </div>

            <form onSubmit={handleTossSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Select Toss Winner */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Who Won the Toss?</span>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{
                    flex: '1',
                    minWidth: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: tossWinner === matchData.team_first_id?._id ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossWinner === matchData.team_first_id?._id ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name="tossWinner" 
                      value={matchData.team_first_id?._id}
                      checked={tossWinner === matchData.team_first_id?._id}
                      onChange={() => setTossWinner(matchData.team_first_id?._id)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--secondary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem' }}>
                      {matchData.team_first_id?.team_short_name}
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{matchData.team_first_id?.team_name}</span>
                  </label>

                  <label style={{
                    flex: '1',
                    minWidth: '150px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: tossWinner === matchData.team_second_id?._id ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossWinner === matchData.team_second_id?._id ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name="tossWinner" 
                      value={matchData.team_second_id?._id}
                      checked={tossWinner === matchData.team_second_id?._id}
                      onChange={() => setTossWinner(matchData.team_second_id?._id)}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem' }}>
                      {matchData.team_second_id?.team_short_name}
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{matchData.team_second_id?.team_name}</span>
                  </label>
                </div>
              </div>

              {/* Select Elected Decision */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Elected To?</span>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: tossDecision === 'BAT' ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossDecision === 'BAT' ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name="tossDecision" 
                      value="BAT"
                      checked={tossDecision === 'BAT'}
                      onChange={() => setTossDecision('BAT')}
                      style={{ display: 'none' }}
                    />
                    BAT
                  </label>

                  <label style={{
                    flex: 1,
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: tossDecision === 'FIELD' ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossDecision === 'FIELD' ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="radio" 
                      name="tossDecision" 
                      value="FIELD"
                      checked={tossDecision === 'FIELD'}
                      onChange={() => setTossDecision('FIELD')}
                      style={{ display: 'none' }}
                    />
                    FIELD
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => setShowDiscardModal(true)} 
                  className="btn btn-outline" 
                  style={{ color: '#D9534F', borderColor: 'rgba(217, 83, 79, 0.4)', padding: '0.85rem 1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Trash2 size={16} />
                  Discard Match
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.85rem 3rem', fontWeight: '700', flex: 1 }}>
                  {loading ? 'Starting Match...' : 'Start Live Match'}
                </button>
                <button type="button" onClick={() => setPhase(2)} className="btn" style={{ padding: '0.85rem 1.5rem', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Discard Match Confirmation Modal */}
      {showDiscardModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div className="glass" style={{
            maxWidth: '440px',
            width: '100%',
            padding: '2rem',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 83, 79, 0.15)',
              color: '#D9534F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              <Trash2 size={28} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-color)' }}>
                Discard Match?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Are you sure you want to discard this match? This will permanently delete the match and disable all active invite links.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={discarding}
                onClick={() => setShowDiscardModal(false)}
                style={{ flex: 1, padding: '0.75rem', fontWeight: '700' }}
              >
                No, Keep Match
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={discarding}
                onClick={handleDiscardMatch}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontWeight: '700',
                  backgroundColor: '#D9534F',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px'
                }}
              >
                {discarding ? 'Discarding...' : 'Yes, Discard Match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateMatchWizard;
