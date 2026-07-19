import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Navigation from '../components/Navigation';
import { Calendar, MapPin, Settings, Shield, Clipboard, Check, Plus, UserPlus, Trophy, AlertTriangle } from 'lucide-react';

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

  const [phase, setPhase] = useState(1); // 1 = Config, 2 = Roster, 3 = Toss
  const [matchId, setMatchId] = useState(null);
  const [socket, setSocket] = useState(null);

  // Load from localStorage for quick creation fallback
  const savedConfigStr = localStorage.getItem('last_match_config');
  const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;

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
  const [teamFirstId, setTeamFirstId] = useState(savedConfig?.teamFirstId || '');
  const [teamSecondId, setTeamSecondId] = useState(savedConfig?.teamSecondId || '');
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

  // Search & add players state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isSub, setIsSub] = useState(false);

  // Umpires are designated by clicking chips in the Live Roster panel (Phase 2)

  // Phase 3 states: Toss
  const [tossWinner, setTossWinner] = useState('');
  const [tossDecision, setTossDecision] = useState('BAT');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  // Load teams list
  useEffect(() => {
    axios.get('http://localhost:5000/api/v1/teams')
      .then(res => setTeamsList(res.data))
      .catch(err => console.error('Fetch teams error:', err));
  }, []);

  // Socket IO listener for live roster updates
  useEffect(() => {
    if (!matchId) return;

    const newSocket = io('http://localhost:5000');
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

    return () => {
      newSocket.close();
    };
  }, [matchId]);

  // Autocomplete search
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      axios.get(`http://localhost:5000/api/v1/players/search?q=${searchQuery}`)
        .then(res => {
          // Filter out players already in the match
          if (matchData) {
            const registeredIds = [
              ...matchData.playing_xi_team_first,
              ...matchData.playing_xi_team_second,
              ...matchData.substitutes_team_first,
              ...matchData.substitutes_team_second
            ].map(p => p._id);
            setSearchResults(res.data.filter(p => !registeredIds.includes(p._id)));
          } else {
            setSearchResults(res.data);
          }
        })
        .catch(err => console.error(err));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, matchData]);




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
          const teamRes = await axios.post('http://localhost:5000/api/v1/teams', {
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
          const teamRes = await axios.post('http://localhost:5000/api/v1/teams', {
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

      const res = await axios.post('http://localhost:5000/api/v1/matches', {
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
      const matchDetails = await axios.get(`http://localhost:5000/api/v1/matches/${res.data.match._id}`);
      setMatchData(matchDetails.data);
      
      setPhase(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to configure match.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!matchId || !selectedPlayer || !selectedTeamId) return;

    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`http://localhost:5000/api/v1/matches/${matchId}/join`, {
        display_name: selectedPlayer.display_name,
        team_id: selectedTeamId,
        is_substitute: isSub
      });

      setMatchData(response.data.match);
      setSuccess(`Added ${selectedPlayer.display_name} to roster.`);
      setTimeout(() => setSuccess(''), 2000);
      
      // Reset form
      setSelectedPlayer(null);
      setSearchQuery('');
      setIsSub(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add player to match.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = `http://localhost:5173/matches/${matchId}/join`;
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
      const res = await axios.put(`http://localhost:5000/api/v1/matches/${matchId}/umpires`, {
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
      await axios.put(`http://localhost:5000/api/v1/matches/${matchId}/toss`, {
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

              <div style={{ marginTop: '0.5rem' }}>
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
              <button onClick={handleCopyLink} className="btn" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', border: '1px solid var(--border-color)' }}>
                {copied ? <Check size={14} style={{ color: 'var(--secondary-color)' }} /> : <Clipboard size={14} />}
                {copied ? 'Copied' : 'Copy Invite'}
              </button>
            </div>

            {/* Live Rosters Lists */}
            <div className="responsive-grid-2col">
              {/* Team First */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                <h4 style={{ fontWeight: '800', color: 'var(--secondary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  {matchData.team_first_id?.team_name}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>Playing XI (Click to toggle Umpire):</strong>
                  {matchData.playing_xi_team_first.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None joined.</span> : (
                    matchData.playing_xi_team_first.map(p => {
                      const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                      return (
                        <div 
                          key={p._id} 
                          onClick={() => handleToggleUmpire(p._id)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                            backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.1)' : 'transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                          title="Toggle Umpire"
                        >
                          <span>{p.display_name}</span>
                          {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                        </div>
                      );
                    })
                  )}
                  {matchData.match_rules?.allow_substitutes !== false && (
                    <>
                      <strong style={{ marginTop: '0.5rem' }}>Substitutes (Click to toggle Umpire):</strong>
                      {matchData.substitutes_team_first.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None joined.</span> : (
                        matchData.substitutes_team_first.map(p => {
                          const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                          return (
                            <div 
                              key={p._id} 
                              onClick={() => handleToggleUmpire(p._id)}
                              style={{
                                padding: '0.4rem 0.75rem',
                                border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.1)' : 'transparent',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              title="Toggle Umpire"
                            >
                              <span>{p.display_name}</span>
                              {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Team Second */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                <h4 style={{ fontWeight: '800', color: 'var(--secondary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  {matchData.team_second_id?.team_name}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <strong>Playing XI (Click to toggle Umpire):</strong>
                  {matchData.playing_xi_team_second.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None joined.</span> : (
                    matchData.playing_xi_team_second.map(p => {
                      const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                      return (
                        <div 
                          key={p._id} 
                          onClick={() => handleToggleUmpire(p._id)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                            backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.1)' : 'transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                          title="Toggle Umpire"
                        >
                          <span>{p.display_name}</span>
                          {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                        </div>
                      );
                    })
                  )}
                  {matchData.match_rules?.allow_substitutes !== false && (
                    <>
                      <strong style={{ marginTop: '0.5rem' }}>Substitutes (Click to toggle Umpire):</strong>
                      {matchData.substitutes_team_second.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>None joined.</span> : (
                        matchData.substitutes_team_second.map(p => {
                          const isUmpire = matchData.umpires?.some(u => (u._id || u) === p._id);
                          return (
                            <div 
                              key={p._id} 
                              onClick={() => handleToggleUmpire(p._id)}
                              style={{
                                padding: '0.4rem 0.75rem',
                                border: isUmpire ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                backgroundColor: isUmpire ? 'rgba(198, 165, 103, 0.1)' : 'transparent',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                userSelect: 'none'
                              }}
                              title="Toggle Umpire"
                            >
                              <span>{p.display_name}</span>
                              {isUmpire && <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>⚖️ Umpire</span>}
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Player Addition */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <UserPlus size={18} />
                Manually Add Player
              </h4>
              <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 200px', position: 'relative' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Search Player Profile</label>
                  <input 
                    type="text" 
                    placeholder="Type display name..." 
                    value={searchQuery} 
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedPlayer(null); }}
                  />
                  {searchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--dominant-color)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' }}>
                      {searchResults.map(p => (
                        <button type="button" key={p._id} onClick={() => { setSelectedPlayer(p); setSearchQuery(p.display_name); setSearchResults([]); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-color)', cursor: 'pointer' }}>
                          {p.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 150px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Add To Team</label>
                  <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} required>
                    <option value="">Select Team</option>
                    <option value={matchData.team_first_id?._id}>{matchData.team_first_id?.team_name}</option>
                    <option value={matchData.team_second_id?._id}>{matchData.team_second_id?.team_name}</option>
                  </select>
                </div>

                {matchData.match_rules?.allow_substitutes !== false && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', paddingBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                      Substitute
                    </label>
                  </div>
                )}

                <button type="submit" disabled={loading || !selectedPlayer || !selectedTeamId} className="btn btn-accent" style={{ padding: '0.5rem 1.5rem', height: '38px' }}>
                  <Plus size={16} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />
                  Add
                </button>
              </form>
            </div>

            {/* Next step buttons */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
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

              {/* Select Decision */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Toss Winner Elected To:</span>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: tossDecision === 'BAT' ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossDecision === 'BAT' ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'center'
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
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: tossDecision === 'FIELD' ? 'var(--secondary-color)' : 'var(--border-color)',
                    backgroundColor: tossDecision === 'FIELD' ? 'rgba(29, 79, 42, 0.04)' : 'transparent',
                    fontWeight: '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    textAlign: 'center'
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
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
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
    </>
  );
};

export default CreateMatchWizard;
