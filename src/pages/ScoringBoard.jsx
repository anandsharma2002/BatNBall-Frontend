import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Target, RotateCcw, ChevronRight, Users, Zap,
  AlertTriangle, CheckCircle, ArrowLeftRight, Shield
} from 'lucide-react';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL as API, SOCKET_URL } from '../config';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatOvers = (legal_balls) => {
  const overs = Math.floor(legal_balls / 6);
  const balls = legal_balls % 6;
  return `${overs}.${balls}`;
};

const calcStrikeRate = (runs, balls) =>
  balls === 0 ? '0.00' : ((runs / balls) * 100).toFixed(1);

// ─── Score Pill ────────────────────────────────────────────────────────────────
const ScorePill = ({ label, value, sub }) => (
  <div className="score-pill-card">
    <div className="pill-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    <div className="pill-val" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--secondary-color)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
  </div>
);

// ─── Ball Chip (recent balls row) ─────────────────────────────────────────────
const BallChip = ({ ball }) => {
  let bg = 'rgba(255,255,255,0.08)';
  let text = ball.runs_from_bat + ball.extra_runs;
  let color = 'var(--text-color)';

  if (ball.dismissal?.is_wicket) { bg = '#dc2626'; text = 'W'; color = '#fff'; }
  else if (ball.is_boundary && ball.boundary_type === 'SIX') { bg = 'var(--accent-color)'; color = 'var(--dominant-color)'; }
  else if (ball.is_boundary && ball.boundary_type === 'FOUR') { bg = '#22c55e'; color = '#fff'; }
  else if (!ball.is_legal_delivery) { bg = '#ca8a04'; color = '#fff'; text = ball.extra_type?.[0] ?? 'E'; }
  else if (text === 0) { bg = 'rgba(255,255,255,0.04)'; color = 'var(--text-muted)'; text = '•'; }

  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: '700', fontSize: '0.8rem', background: bg, color,
      border: '1px solid var(--border-color)', flexShrink: 0
    }}>
      {text}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const ScoringBoard = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [match, setMatch] = useState(null);
  const [balls, setBalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Init modal state
  const [showInitModal, setShowInitModal] = useState(false);
  const [initForm, setInitForm] = useState({ striker_id: '', non_striker_id: '', bowler_id: '' });

  // Extra modal state
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [pendingRuns, setPendingRuns] = useState(0);
  const [extraForm, setExtraForm] = useState({ extra_type: 'WIDE', extra_runs: 1 });

  // Wicket modal state
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketForm, setWicketForm] = useState({
    runs_before_wicket: 0,
    wicket_type: 'BOWLED',
    dismissed_player_id: '',
    fielder_involved_id: '',
    is_direct_hit: false
  });

  // Over complete / next batter modals
  const [showNextBowler, setShowNextBowler] = useState(false);
  const [nextBowlerId, setNextBowlerId] = useState('');
  const [showNextBatter, setShowNextBatter] = useState(false);
  const [nextBatterId, setNextBatterId] = useState('');

  // End Innings declaration
  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);

  // Strike animation flash
  const [strikeSwapped, setStrikeSwapped] = useState(false);

  // Umpire handover state
  const [umpireRequest, setUmpireRequest] = useState(null);

  const { user } = useAuth();

  // Substitution Modal State
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({ role: 'striker', existing_player_id: '', new_player_id: '', sub_type: 'tactical' });

  // End Match Modal State
  const [showEndMatchModal, setShowEndMatchModal] = useState(false);
  const [endMatchForm, setEndMatchForm] = useState({ winner_team_id: 'DRAW', result_type: 'RUNS', win_margin: 0 });

  const showToast = (msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  };

  // ─── Load scorecard ──────────────────────────────────────────────────────────
  const fetchScorecard = async () => {
    try {
      const { data } = await axios.get(`${API}/matches/${matchId}/score/scorecard`);
      setMatch(data.match);
      setBalls(data.balls || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  };

  // ─── Socket.io ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchScorecard();

    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current.emit('join_match_room', matchId);

    socketRef.current.on('ball_logged', ({ ball, match: updatedMatch, over_completed, innings_transition, wicket }) => {
      setMatch(updatedMatch);
      setBalls(prev => [...prev, ball]);
      
      if (updatedMatch.match_status === 'COMPLETED') {
        setShowNextBowler(false);
        setShowNextBatter(false);
        
        let winnerText = 'Match Tied';
        if (updatedMatch.winner_team_id) {
          const winnerName = (typeof updatedMatch.winner_team_id === 'object' ? updatedMatch.winner_team_id.team_name : '') || 'Winner';
          const margin = updatedMatch.win_margin || 0;
          const resType = updatedMatch.result_type ? updatedMatch.result_type.toLowerCase() : 'runs';
          winnerText = `🏆 ${winnerName} won by ${margin} ${resType}`;
        } else if (updatedMatch.result_type === 'TIE') {
          winnerText = '🏆 Match Tied';
        } else {
          winnerText = '🏆 No Result / Draw';
        }
        showToast(winnerText, 3000);
      } else {
        if (over_completed && !innings_transition) {
          setShowNextBowler(true);
        }
        if (innings_transition) {
          showToast('🏏 Innings Complete!', 2000);
          setTimeout(() => {
            setShowInitModal(true);
          }, 2000);
        }
        if (wicket) {
          setShowNextBatter(true);
        }
      }
      // Animate strike swap
      setStrikeSwapped(true);
      setTimeout(() => setStrikeSwapped(false), 500);
    });

    socketRef.current.on('match_state_update', ({ match: updatedMatch, balls: updatedBalls }) => {
      setMatch(updatedMatch);
      if (updatedBalls) {
        setBalls(updatedBalls);
      }
    });

    // Umpire request received — show toast to active umpire
    socketRef.current.on('match:umpire_request', ({ requesterPlayerId, requesterName, targetUmpirePlayerId }) => {
      // Check if this event targets me (match creator fallback or explicit target)
      const myPlayerId = user?.associated_player_id?.toString();
      const isTarget = targetUmpirePlayerId
        ? myPlayerId && targetUmpirePlayerId === myPlayerId
        : (() => {
            const creatorId = (match?.created_by?._id || match?.created_by)?.toString();
            return creatorId && creatorId === user?.id?.toString();
          })();

      if (isTarget) {
        setUmpireRequest(prev => {
          if (prev?.timeoutId) clearTimeout(prev.timeoutId);
          return null;
        });
        const timeoutId = setTimeout(() => setUmpireRequest(null), 5000);
        setUmpireRequest({ requesterPlayerId, requesterName, timeoutId });
      }
    });

    // Umpire accepted — if I am the new umpire, stay on this page; if I was old umpire, go to view-only
    socketRef.current.on('match:umpire_accepted', ({ newActiveUmpireId, oldUmpireId }) => {
      const myPlayerId = user?.associated_player_id?.toString();
      const myUserId = user?.id?.toString();
      if (myPlayerId && newActiveUmpireId === myPlayerId) {
        // I just became umpire — stay here, refresh
        showToast('🎉 You are now the active umpire!');
        fetchScorecard();
      } else if (oldUmpireId && (oldUmpireId === myPlayerId || oldUmpireId === myUserId)) {
        // I was the old umpire — redirect to spectator view
        showToast('🔄 Umpire role transferred. Redirecting...');
        setTimeout(() => navigate(`/matches/${matchId}`), 2000);
      } else {
        fetchScorecard();
      }
    });

    return () => socketRef.current?.disconnect();
  }, [matchId, user, match?.created_by]);

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ─── Umpire Helpers ──────────────────────────────────────────────────────────
  const isActiveUmpire = () => {
    if (!user) return false;
    if (match?.active_umpire_id) {
      const activeId = (match.active_umpire_id._id || match.active_umpire_id).toString();
      return user.associated_player_id && activeId === user.associated_player_id.toString();
    }
    const creatorId = (match?.created_by?._id || match?.created_by)?.toString();
    return creatorId && creatorId === user?.id?.toString();
  };

  const isMatchCreator = () => {
    const creatorId = (match?.created_by?._id || match?.created_by)?.toString();
    return creatorId && creatorId === user?.id?.toString();
  };

  const handleAcceptUmpire = async (requesterPlayerId) => {
    try {
      await axios.post(`${API}/matches/${matchId}/score/accept-umpire`, { requesterPlayerId }, authHeaders);
      setUmpireRequest(null);
      showToast('🔄 Umpire role transferred!');
      fetchScorecard();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept umpire request');
    }
  };

  const handleAppointUmpire = async (e) => {
    const targetPlayerId = e.target.value;
    if (!targetPlayerId) return;
    try {
      await axios.post(`${API}/matches/${matchId}/score/appoint-umpire`, { targetPlayerId }, authHeaders);
      showToast('🎓 Umpire appointed!');
      fetchScorecard();
      // Reset dropdown
      e.target.value = '';
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to appoint umpire');
    }
  };

  // ─── Initialize Crease ────────────────────────────────────────────────────────
  const handleInitialize = async () => {
    if (!initForm.striker_id || !initForm.non_striker_id || !initForm.bowler_id) {
      return showToast('All 3 crease positions are required');
    }
    setActionLoading(true);
    try {
      const { data } = await axios.post(`${API}/matches/${matchId}/score/initialize`, initForm, authHeaders);
      setMatch(data.match);
      setShowInitModal(false);
      showToast('✅ Crease initialized!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to initialize crease');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Log Ball (Normal Run) ────────────────────────────────────────────────────
  const handleRun = async (runs) => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/ball`, {
        runs_from_bat: runs,
        is_boundary: runs === 4 || runs === 6,
        boundary_type: runs === 4 ? 'FOUR' : runs === 6 ? 'SIX' : null
      }, authHeaders);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to log ball');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Log Extra ────────────────────────────────────────────────────────────────
  const handleExtraSubmit = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/ball`, {
        runs_from_bat: pendingRuns,
        is_extra: true,
        extra_type: extraForm.extra_type,
        extra_runs: Number(extraForm.extra_runs),
        is_legal_delivery: !['WIDE', 'NO_BALL'].includes(extraForm.extra_type)
      }, authHeaders);
      setShowExtraModal(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to log extra');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Log Wicket ───────────────────────────────────────────────────────────────
  const handleWicketSubmit = async () => {
    if (!wicketForm.wicket_type) return showToast('Select wicket type');
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/ball`, {
        runs_from_bat: Number(wicketForm.runs_before_wicket),
        dismissal: {
          is_wicket: true,
          dismissed_player_id: wicketForm.dismissed_player_id || match?.crease_state?.striker_id?._id,
          wicket_type: wicketForm.wicket_type,
          fielder_involved_id: wicketForm.fielder_involved_id || null,
          is_direct_hit: wicketForm.is_direct_hit
        }
      }, authHeaders);
      setShowWicketModal(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to log wicket');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Set Next Bowler ──────────────────────────────────────────────────────────
  const handleNextBowler = async () => {
    if (!nextBowlerId) return showToast('Select next bowler');
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/set-next-bowler`, { new_bowler_id: nextBowlerId }, authHeaders);
      setShowNextBowler(false);
      setNextBowlerId('');
      showToast('🎳 New bowler set!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error setting bowler');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Set Next Batter ─────────────────────────────────────────────────────────
  const handleNextBatter = async () => {
    if (!nextBatterId) return showToast('Select next batter');
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/set-next-batter`, { new_striker_id: nextBatterId }, authHeaders);
      setShowNextBatter(false);
      setNextBatterId('');
      showToast('🏏 New batter at crease!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error setting batter');
    } finally {
      setActionLoading(false);
    }
  };
  // ─── Undo Last Ball ──────────────────────────────────────────────────────────
  const handleUndo = async () => {
    setActionLoading(true);
    try {
      const { data } = await axios.post(`${API}/matches/${matchId}/score/undo`, {}, authHeaders);
      setMatch(data.match);
      await fetchScorecard();
      showToast('⏪ Last ball undone!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to undo');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Submit Substitution ──────────────────────────────────────────────────────
  const handleSubstituteSubmit = async () => {
    if (!subForm.new_player_id) return showToast('Select a replacement player');
    setActionLoading(true);
    try {
      const { data } = await axios.post(`${API}/matches/${matchId}/score/substitute`, subForm, authHeaders);
      setMatch(data.match);
      await fetchScorecard();
      setShowSubModal(false);
      showToast('🔄 Player substituted successfully!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to substitute player');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndMatchSubmit = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/end`, {
        winner_team_id: endMatchForm.winner_team_id === 'DRAW' ? null : endMatchForm.winner_team_id,
        result_type: endMatchForm.result_type,
        win_margin: Number(endMatchForm.win_margin)
      }, authHeaders);
      setShowEndMatchModal(false);
      showToast('🏆 Match manually ended!');
      fetchScorecard();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to end match');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndInningsSubmit = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/matches/${matchId}/score/declare-innings`, {}, authHeaders);
      setShowEndInningsConfirm(false);
      showToast(' innings ended successfully!');
      fetchScorecard();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to end innings');
    } finally {
      setActionLoading(false);
    }
  };
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass" style={{ padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
        <AlertTriangle size={40} style={{ color: '#ef4444', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    </div>
  );

  const innings = match?.current_innings || 1;
  const inningsKey = `innings${innings}`;
  const currentInnings = match?.[inningsKey] || {};
  const crease = match?.crease_state || {};
  const striker = crease.striker_id;
  const nonStriker = crease.non_striker_id;
  const bowler = crease.bowler_id;
  const creaseReady = !!striker && !!bowler;

  // Recent balls: last 6 of current innings
  const recentBalls = balls.filter(b => b.innings_number === innings).slice(-6);

  // Bowling team players for next bowler picker
  const bowlingTeamPlaying = innings === 1 ? match?.playing_xi_team_second : match?.playing_xi_team_first;
  const battingTeamPlaying = innings === 1 ? match?.playing_xi_team_first : match?.playing_xi_team_second;

  const getSubOptions = () => {
    const isBatting = subForm.role === 'striker' || subForm.role === 'non_striker';
    const pool = isBatting ? battingTeamPlaying : bowlingTeamPlaying;
    if (!pool) return [];
    
    // Exclude players currently active at the crease (except the one being replaced)
    return pool.filter(p => {
      const isAlreadyActive = 
        (p._id === match?.crease_state?.striker_id?._id && subForm.role !== 'striker') ||
        (p._id === match?.crease_state?.non_striker_id?._id && subForm.role !== 'non_striker') ||
        (p._id === match?.crease_state?.bowler_id?._id && subForm.role !== 'bowler');
      return !isAlreadyActive;
    });
  };

  const requiresFielder = ['CAUGHT', 'CAUGHT_AND_BOWLED', 'RUN_OUT', 'STUMPED'].includes(wicketForm.wicket_type);

  return (
    <>
      <Navigation />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: 'var(--secondary-color)', color: '#fff',
          padding: '0.75rem 1.5rem', borderRadius: '8px',
          fontWeight: '700', fontSize: '0.95rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {toast}
        </div>
      )}

      {/* Umpire handover request toast (only visible to current active umpire) */}
      {umpireRequest && (
        <div className="umpire-toast-card" style={{
          position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 300,
          background: 'var(--dominant-color, #1e1e24)', color: 'var(--text-color, #ffffff)',
          border: '2px solid var(--accent-color, #c6a567)', borderRadius: '12px',
          padding: '1rem 1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            🏏 <strong>{umpireRequest.requesterName}</strong> wants to become umpire
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleAcceptUmpire(umpireRequest.requesterPlayerId)}
              style={{
                background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: '50%', width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1rem', fontWeight: '700'
              }}
              title="Accept"
            >
              ✓
            </button>
            <button
              onClick={() => {
                if (umpireRequest.timeoutId) clearTimeout(umpireRequest.timeoutId);
                setUmpireRequest(null);
              }}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: '50%', width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1rem', fontWeight: '700'
              }}
              title="Reject"
            >
              ✗
            </button>
          </div>
        </div>
      )}

      <div className="scoring-container">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="scoring-header-bar">
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center' }}>
              <Shield size={20} style={{ marginRight: '0.4rem', color: 'var(--accent-color)' }} />
              Live Scoring
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {match?.current_innings_batting_team_id?.team_name} vs {
                innings === 1 ? match?.team_second_id?.team_name : match?.team_first_id?.team_name
              } — Innings {innings}
            </p>
          </div>
          <div className="scoring-controls">
            {match?.match_status !== 'COMPLETED' && (
              <>
                <button
                  className="btn scoring-btn"
                  onClick={handleUndo}
                  disabled={actionLoading || !match?.undo_actions_remaining}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: !match?.undo_actions_remaining ? 'var(--text-muted)' : 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    cursor: !match?.undo_actions_remaining ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RotateCcw size={13} />
                  Undo ({match?.undo_actions_remaining ?? 0})
                </button>
                <button
                  className="btn scoring-btn"
                  onClick={() => setShowEndInningsConfirm(true)}
                  disabled={actionLoading}
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}
                >
                  End Inning
                </button>
                <button
                  className="btn scoring-btn"
                  onClick={() => {
                    setEndMatchForm({ winner_team_id: 'DRAW', result_type: 'RUNS', win_margin: 0 });
                    setShowEndMatchModal(true);
                  }}
                  disabled={actionLoading}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  End Match
                </button>
                <button
                  className="btn btn-primary scoring-btn"
                  onClick={() => setShowInitModal(true)}
                >
                  {creaseReady ? 'Change Crease' : 'Set Crease'}
                </button>
              </>
            )}

            {/* Appoint Umpire dropdown — visible only to match creator */}
            {isMatchCreator() && match?.match_status !== 'COMPLETED' && match?.umpires?.length > 0 && (
              <select
                onChange={handleAppointUmpire}
                defaultValue=""
                className="scoring-btn"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="" disabled>Appoint Umpire</option>
                {match.umpires.map(ump => (
                  <option key={ump._id || ump} value={ump._id || ump}>
                    {ump.display_name || 'Umpire'}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Scoreboard ─────────────────────────────────────────────────────── */}
        <div className="glass scoring-card">

          {/* Team Scores */}
          {(() => {
            const totalOv = match?.total_overs_per_innings ?? 0;
            const inn1 = match?.innings1 || {};
            const inn2 = match?.innings2 || {};

            // Who batted in innings 1?
            const team1stBat = innings === 1
              ? match?.current_innings_batting_team_id
              : match?.current_innings_bowling_team_id;
            const team2ndBat = innings === 1
              ? match?.current_innings_bowling_team_id
              : match?.current_innings_batting_team_id;

            const showInn1 = inn1.score !== undefined || inn1.wickets !== undefined;
            const showInn2 = innings === 2;

            return (
              <div style={{ marginBottom: '0.85rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
                <div className="scoring-team-row">
                  <span style={{ fontWeight: '600' }}>{team1stBat?.team_name || '—'}</span>
                  {showInn1 ? (
                    <span style={{ fontWeight: '700', color: 'var(--secondary-color)' }}>
                      {inn1.score ?? 0}/{inn1.wickets ?? 0} ({formatOvers(inn1.total_legal_balls ?? 0)}/{totalOv} ov)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>–</span>
                  )}
                </div>
                <div className="scoring-team-row">
                  <span style={{ fontWeight: '600' }}>{team2ndBat?.team_name || '—'}</span>
                  {showInn2 ? (
                    <span style={{ fontWeight: '700', color: 'var(--secondary-color)' }}>
                      {inn2.score ?? 0}/{inn2.wickets ?? 0} ({formatOvers(inn2.total_legal_balls ?? 0)}/{totalOv} ov)
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Yet to bat</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Batsmen + Bowler row */}
          {creaseReady && (
            <div className="scoring-crease-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                {[
                  { player: striker, isStrike: true },
                  { player: nonStriker, isStrike: false }
                ].map(({ player, isStrike }) => {
                  if (!player) return null;
                  const battedBalls = balls.filter(b =>
                    b.innings_number === innings &&
                    (b.striker_id?._id || b.striker_id)?.toString() === player._id?.toString() &&
                    b.is_legal_delivery
                  );
                  const runs = battedBalls.reduce((s, b) => s + (b.runs_from_bat || 0), 0);
                  return (
                    <div key={player._id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: '500', color: 'var(--text-color)' }}>
                        {player.display_name}{isStrike ? '*' : '\u00a0'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {runs} ({battedBalls.length})
                      </span>
                    </div>
                  );
                })}
              </div>
              {bowler && (() => {
                const bBalls = balls.filter(b =>
                  b.innings_number === innings &&
                  (b.bowler_id?._id || b.bowler_id)?.toString() === bowler._id?.toString()
                );
                const bRuns = bBalls.reduce((s, b) => s + (b.runs_from_bat || 0) + (b.extra_runs || 0), 0);
                const bWkts = bBalls.filter(b => b.dismissal?.is_wicket && b.dismissal?.wicket_type !== 'RUN_OUT').length;
                const bLegal = bBalls.filter(b => b.is_legal_delivery).length;
                return (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '500' }}>{bowler.display_name}</div>
                    <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>{bWkts}/{bRuns} ({formatOvers(bLegal)})</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Score Pills — no TEA, just Target/Need/CRR/RRR */}
          <div className="score-pills-container">
            {innings === 2 && (
              <>
                <ScorePill label="Target" value={(match?.innings1?.score ?? 0) + 1} />
                <ScorePill
                  label="Need"
                  value={Math.max(0, (match?.innings1?.score ?? 0) + 1 - (currentInnings.score ?? 0))}
                  sub={`in ${Math.max(0, (match?.total_overs_per_innings ?? 0) * 6 - (currentInnings.total_legal_balls ?? 0))} balls`}
                />
              </>
            )}
            <ScorePill label="CRR" value={(currentInnings.total_legal_balls ? ((currentInnings.score / currentInnings.total_legal_balls) * 6).toFixed(2) : '0.00')} sub="curr rate" />
            {innings === 2 && (() => {
              const ballsLeft = Math.max(0, (match?.total_overs_per_innings ?? 0) * 6 - (currentInnings.total_legal_balls ?? 0));
              const runsLeft = Math.max(0, (match?.innings1?.score ?? 0) + 1 - (currentInnings.score ?? 0));
              const rrr = ballsLeft > 0 ? ((runsLeft / ballsLeft) * 6).toFixed(2) : '–';
              return <ScorePill label="RRR" value={rrr} sub="req rate" />;
            })()}
          </div>

          {/* Recent balls */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Last 6:</span>
            {recentBalls.length === 0
              ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No balls yet</span>
              : recentBalls.map((b, i) => <BallChip key={b._id || i} ball={b} />)
            }
          </div>
        </div>

        {/* ── Scoring Pad ─────────────────────────────────────────────────────── */}
        {match?.match_status === 'COMPLETED' ? (
          <div className="glass scoring-card" style={{ textAlign: 'center' }}>
            <CheckCircle size={44} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.35rem' }}>Match Complete!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>The match has concluded. View the final scorecard above.</p>
          </div>
        ) : !creaseReady ? (
          <div className="glass scoring-card" style={{ textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>Set the crease positions to start scoring.</p>
            <button className="btn btn-primary scoring-btn" onClick={() => setShowInitModal(true)}>
              Set Crease →
            </button>
          </div>
        ) : (
          <div className="glass scoring-card">
            <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Log Ball
            </div>

            {/* Run Buttons */}
            <div className="scoring-run-grid">
              {[0, 1, 2, 3, 4, 6].map(r => (
                <button
                  key={r}
                  onClick={() => handleRun(r)}
                  disabled={actionLoading}
                  className="scoring-run-btn"
                  style={{
                    background: r === 4
                      ? 'rgba(34,197,94,0.12)'
                      : r === 6
                        ? 'rgba(var(--accent-color-rgb, 79,70,229),0.12)'
                        : 'rgba(255,255,255,0.04)',
                    borderColor: r === 4
                      ? '#22c55e'
                      : r === 6
                        ? 'var(--accent-color)'
                        : 'var(--border-color)',
                    color: r === 4 ? '#22c55e' : r === 6 ? 'var(--accent-color)' : 'var(--text-color)'
                  }}
                >
                  {r === 4 ? '4' : r === 6 ? '6' : r}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="scoring-action-grid">
              <button
                onClick={() => { setExtraForm({ extra_type: 'WIDE', extra_runs: 1 }); setPendingRuns(0); setShowExtraModal(true); }}
                disabled={actionLoading}
                className="btn scoring-action-btn"
                style={{
                  border: '2px solid #ca8a04', color: '#ca8a04',
                  background: 'rgba(202,138,4,0.08)'
                }}
              >
                Wide (WD)
              </button>
              <button
                onClick={() => { setExtraForm({ extra_type: 'NO_BALL', extra_runs: 1 }); setPendingRuns(0); setShowExtraModal(true); }}
                disabled={actionLoading}
                className="btn scoring-action-btn"
                style={{
                  border: '2px solid #ca8a04', color: '#ca8a04',
                  background: 'rgba(202,138,4,0.08)'
                }}
              >
                No Ball (NB)
              </button>
              <button
                onClick={() => { setExtraForm({ extra_type: 'BYE', extra_runs: 1 }); setPendingRuns(0); setShowExtraModal(true); }}
                disabled={actionLoading}
                className="btn scoring-action-btn"
                style={{
                  border: '2px solid #ca8a04', color: '#ca8a04',
                  background: 'rgba(202,138,4,0.08)'
                }}
              >
                Byes (B)
              </button>
              <button
                onClick={() => { setExtraForm({ extra_type: 'LEG_BYE', extra_runs: 1 }); setPendingRuns(0); setShowExtraModal(true); }}
                disabled={actionLoading}
                className="btn scoring-action-btn"
                style={{
                  border: '2px solid #ca8a04', color: '#ca8a04',
                  background: 'rgba(202,138,4,0.08)'
                }}
              >
                Leg Byes (LB)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
              <button
                onClick={() => {
                  setWicketForm({ runs_before_wicket: 0, wicket_type: 'BOWLED', dismissed_player_id: '', fielder_involved_id: '', is_direct_hit: false });
                  setShowWicketModal(true);
                }}
                disabled={actionLoading}
                className="btn scoring-action-btn"
                style={{
                  border: '2px solid #ef4444', color: '#ef4444',
                  background: 'rgba(239,68,68,0.08)',
                  width: '100%',
                  fontSize: '0.88rem'
                }}
              >
                <AlertTriangle size={15} style={{ marginRight: '0.3rem' }} />
                Wicket! 🏏
              </button>
            </div>
          </div>
        )}

        {/* ── Ball Log ────────────────────────────────────────────────────────── */}
        {balls.length > 0 && (
          <div className="glass" style={{ padding: '1.25rem', marginTop: '1.25rem', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Ball Log</h3>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {[...balls].reverse().map((b, i) => (
                <div key={b._id || i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem 0.25rem',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.82rem'
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ov {b.over_number}.{b.ball_number_in_over}</span>
                  <span>{b.dismissal?.is_wicket ? <span style={{ color: '#ef4444', fontWeight: '700' }}>WICKET ({b.dismissal.wicket_type})</span> : b.is_extra ? <span style={{ color: '#ca8a04' }}>{b.extra_type} +{b.extra_runs}</span> : `${b.runs_from_bat} run${b.runs_from_bat !== 1 ? 's' : ''}${b.is_boundary ? ` (${b.boundary_type})` : ''}`}</span>
                  <span style={{ color: 'var(--accent-color)', fontWeight: '700' }}>{b.current_total_score}/{b.current_wickets_down}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Initialize Crease Modal ─────────────────────────────────────────── */}
      {showInitModal && (
        <ModalOverlay onClose={() => setShowInitModal(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '1.5rem' }}>Set Crease Positions</h2>

          {/* Striker — exclude whoever is picked as non-striker */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Striker (Opening Batter)</label>
            <select
              className="form-input"
              value={initForm.striker_id}
              onChange={e => setInitForm(prev => ({ ...prev, striker_id: e.target.value }))}
            >
              <option value="">— Select Player —</option>
              {(battingTeamPlaying || []).map(p => {
                if (!p) return null;
                const id = (p._id || p).toString();
                if (id === initForm.non_striker_id) return null; // already picked as non-striker
                const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>

          {/* Non-Striker — exclude whoever is picked as striker */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Non-Striker</label>
            <select
              className="form-input"
              value={initForm.non_striker_id}
              onChange={e => setInitForm(prev => ({ ...prev, non_striker_id: e.target.value }))}
            >
              <option value="">— Select Player —</option>
              {(battingTeamPlaying || []).map(p => {
                if (!p) return null;
                const id = (p._id || p).toString();
                if (id === initForm.striker_id) return null; // already picked as striker
                const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>

          {/* Bowler — always from bowling team, no conflict with batters */}
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Bowler</label>
            <select
              className="form-input"
              value={initForm.bowler_id}
              onChange={e => setInitForm(prev => ({ ...prev, bowler_id: e.target.value }))}
            >
              <option value="">— Select Player —</option>
              {(bowlingTeamPlaying || []).map(p => {
                if (!p) return null;
                const id = (p._id || p).toString();
                const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleInitialize} disabled={actionLoading}>
            {actionLoading ? 'Setting...' : 'Start Innings →'}
          </button>
        </ModalOverlay>
      )}

      {/* ── Extra Modal ─────────────────────────────────────────────────────── */}
      {showExtraModal && (
        <ModalOverlay onClose={() => setShowExtraModal(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '1.5rem' }}>Log Extra</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Extra Type</label>
            <select className="form-input" value={extraForm.extra_type} onChange={e => setExtraForm(prev => ({ ...prev, extra_type: e.target.value }))}>
              {['WIDE', 'NO_BALL', 'BYE', 'LEG_BYE', 'PENALTY'].map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Extra Runs (penalty/byes)</label>
            <input className="form-input" type="number" min="1" max="5" value={extraForm.extra_runs}
              onChange={e => setExtraForm(prev => ({ ...prev, extra_runs: e.target.value }))} />
          </div>
          {extraForm.extra_type === 'NO_BALL' && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Runs off bat (on No-Ball)</label>
              <input className="form-input" type="number" min="0" max="6" value={pendingRuns}
                onChange={e => setPendingRuns(Number(e.target.value))} />
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleExtraSubmit} disabled={actionLoading}>
            {actionLoading ? 'Logging...' : 'Log Extra'}
          </button>
        </ModalOverlay>
      )}

      {/* ── Wicket Modal ─────────────────────────────────────────────────────── */}
      {showWicketModal && (
        <ModalOverlay onClose={() => setShowWicketModal(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '1.5rem', color: '#ef4444' }}>🏏 Wicket!</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Runs before wicket on this ball</label>
            <input className="form-input" type="number" min="0" max="6" value={wicketForm.runs_before_wicket}
              onChange={e => setWicketForm(prev => ({ ...prev, runs_before_wicket: e.target.value }))} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Wicket Type</label>
            <select className="form-input" value={wicketForm.wicket_type} onChange={e => setWicketForm(prev => ({ ...prev, wicket_type: e.target.value }))}>
              {['BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET', 'RETIRED_HURT', 'RETIRED_OUT', 'OBSTRUCTING_FIELD'].map(w => (
                <option key={w} value={w}>{w.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Dismissed Batter</label>
            <select className="form-input" value={wicketForm.dismissed_player_id} onChange={e => setWicketForm(prev => ({ ...prev, dismissed_player_id: e.target.value }))}>
              <option value="">— Striker (default) —</option>
              {[striker, nonStriker].filter(Boolean).map(p => (
                <option key={p._id} value={p._id}>{p.display_name}</option>
              ))}
            </select>
          </div>
          {requiresFielder && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Fielder Involved</label>
              <select className="form-input" value={wicketForm.fielder_involved_id} onChange={e => setWicketForm(prev => ({ ...prev, fielder_involved_id: e.target.value }))}>
                <option value="">— Select Fielder —</option>
                {(bowlingTeamPlaying || []).map(p => {
                  if (!p) return null;
                  const id = p._id || p;
                  const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                  return <option key={id} value={id}>{name}</option>;
                })}
              </select>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={wicketForm.is_direct_hit} onChange={e => setWicketForm(prev => ({ ...prev, is_direct_hit: e.target.checked }))} />
                  Direct Hit
                </label>
              </div>
            </div>
          )}
          <button className="btn" style={{ width: '100%', background: '#ef4444', color: '#fff', fontWeight: '700', border: 'none' }} onClick={handleWicketSubmit} disabled={actionLoading}>
            {actionLoading ? 'Logging...' : 'Confirm Wicket!'}
          </button>
        </ModalOverlay>
      )}

      {/* ── Next Bowler Modal ────────────────────────────────────────────────── */}
      {showNextBowler && (
        <ModalOverlay onClose={() => setShowNextBowler(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '0.5rem' }}>🎳 Over Complete!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select the next bowler</p>
          <select className="form-input" value={nextBowlerId} onChange={e => setNextBowlerId(e.target.value)} style={{ marginBottom: '1rem' }}>
            <option value="">— Select Bowler —</option>
            {(bowlingTeamPlaying || []).map(p => {
              if (!p) return null;
              const id = p._id || p;
              const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleNextBowler} disabled={actionLoading}>
            {actionLoading ? 'Setting...' : 'Confirm Bowler →'}
          </button>
        </ModalOverlay>
      )}

      {/* ── Next Batter Modal ────────────────────────────────────────────────── */}
      {showNextBatter && (
        <ModalOverlay onClose={() => setShowNextBatter(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '0.5rem', color: '#ef4444' }}>🏏 Wicket Fell!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Select the next batter</p>
          <select className="form-input" value={nextBatterId} onChange={e => setNextBatterId(e.target.value)} style={{ marginBottom: '1rem' }}>
            <option value="">— Select Batter —</option>
            {(() => {
              const currentInnings = match?.current_innings || 1;
              const dismissedPlayerIds = new Set();
              (balls || [])
                .filter(b => b.innings_number === currentInnings)
                .forEach(b => {
                  if (b.dismissal?.is_wicket && b.dismissal?.dismissed_player_id) {
                    const dbId = b.dismissal.dismissed_player_id._id || b.dismissal.dismissed_player_id;
                    dismissedPlayerIds.add(dbId.toString());
                  }
                });

              const strikerId = match?.crease_state?.striker_id?._id || match?.crease_state?.striker_id;
              const nonStrikerId = match?.crease_state?.non_striker_id?._id || match?.crease_state?.non_striker_id;

              const suggestedBatters = (battingTeamPlaying || []).filter(p => {
                if (!p) return false;
                const id = (p._id || p).toString();
                if (strikerId && strikerId.toString() === id) return false;
                if (nonStrikerId && nonStrikerId.toString() === id) return false;
                if (dismissedPlayerIds.has(id)) return false;
                return true;
              });

              return suggestedBatters.map(p => {
                const id = p._id || p;
                const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                return <option key={id} value={id}>{name}</option>;
              });
            })()}
          </select>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleNextBatter} disabled={actionLoading}>
            {actionLoading ? 'Setting...' : 'Send to Crease →'}
          </button>
        </ModalOverlay>
      )}

      {/* ── Substitution Modal ────────────────────────────────────────────────── */}
      {showSubModal && (
        <ModalOverlay onClose={() => setShowSubModal(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={22} style={{ color: 'var(--accent-color)' }} />
            Substitute Player
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Replace the active <strong>{subForm.role?.replace('_', ' ')}</strong> at the crease.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Replacement Player</label>
            <select 
              className="form-input" 
              value={subForm.new_player_id} 
              onChange={e => setSubForm(prev => ({ ...prev, new_player_id: e.target.value }))}
            >
              <option value="">— Select Player —</option>
              {getSubOptions().map(p => {
                if (!p) return null;
                const id = p._id || p;
                const name = typeof p === 'object' ? (p.display_name || `${p.first_name} ${p.last_name}`) : `Player ${p}`;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Substitution Type</label>
            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="radio" 
                  name="sub_type" 
                  value="tactical" 
                  checked={subForm.sub_type === 'tactical'} 
                  onChange={e => setSubForm(prev => ({ ...prev, sub_type: e.target.value }))} 
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <strong>Tactical Mid-Over Sub</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                    Replaces the player at the crease from now on. Previous balls remain unchanged.
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="radio" 
                  name="sub_type" 
                  value="correction" 
                  checked={subForm.sub_type === 'correction'} 
                  onChange={e => setSubForm(prev => ({ ...prev, sub_type: e.target.value }))} 
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <strong>Correction (Retroactive)</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                    Corrects a scoring error. Updates the player for all balls in the current over.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1, padding: '0.75rem' }} 
              onClick={() => setShowSubModal(false)}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '0.75rem' }} 
              onClick={handleSubstituteSubmit}
              disabled={actionLoading}
            >
              {actionLoading ? 'Updating...' : 'Confirm Sub'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── End Innings Confirmation Modal ─────────────────────────────────────── */}
      {showEndInningsConfirm && (
        <ModalOverlay onClose={() => setShowEndInningsConfirm(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '0.5rem', color: '#f59e0b' }}>⚠️ End Inning</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Are you sure you want to end the current innings? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem' }}
              onClick={() => setShowEndInningsConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.75rem', background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
              onClick={handleEndInningsSubmit}
              disabled={actionLoading}
            >
              {actionLoading ? 'Declaring...' : 'Confirm End Inning'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── End Match Modal ────────────────────────────────────────────────── */}
      {showEndMatchModal && (
        <ModalOverlay onClose={() => setShowEndMatchModal(false)}>
          <h2 style={{ fontWeight: '800', marginBottom: '0.5rem', color: '#ef4444' }}>🏆 End Match</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Manually conclude this match and record the final outcome.
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Select Winner</label>
            <select
              className="form-input"
              value={endMatchForm.winner_team_id}
              onChange={e => setEndMatchForm(prev => ({ ...prev, winner_team_id: e.target.value }))}
            >
              <option value="DRAW">— Draw / Tie / No Result —</option>
              <option value={match?.team_first_id?._id}>{match?.team_first_id?.team_name}</option>
              <option value={match?.team_second_id?._id}>{match?.team_second_id?.team_name}</option>
            </select>
          </div>

          {endMatchForm.winner_team_id !== 'DRAW' && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Result Type</label>
                <select
                  className="form-input"
                  value={endMatchForm.result_type}
                  onChange={e => setEndMatchForm(prev => ({ ...prev, result_type: e.target.value }))}
                >
                  <option value="RUNS">Won by Runs</option>
                  <option value="WICKETS">Won by Wickets</option>
                  <option value="SUPER_OVER">Won in Super Over</option>
                  <option value="DLS_METHOD">Won by DLS Method</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Win Margin</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={endMatchForm.win_margin}
                  onChange={e => setEndMatchForm(prev => ({ ...prev, win_margin: e.target.value }))}
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem' }}
              onClick={() => setShowEndMatchModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.75rem', background: '#ef4444', borderColor: '#ef4444' }}
              onClick={handleEndMatchSubmit}
              disabled={actionLoading}
            >
              {actionLoading ? 'Ending Match...' : 'End Match'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  );
};

// ─── Modal Overlay ─────────────────────────────────────────────────────────────
const ModalOverlay = ({ children, onClose }) => (
  <div onClick={onClose} className="scoring-modal-overlay">
    <div onClick={e => e.stopPropagation()} className="glass scoring-modal-card">
      {/* Cancel Button */}
      <button 
        onClick={onClose} 
        style={{
          position: 'absolute', top: '0.85rem', right: '0.85rem',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '1.4rem', color: 'var(--text-muted)', fontWeight: 'bold',
          lineHeight: '1', padding: '0.2rem'
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        &times;
      </button>
      {children}
    </div>
  </div>
);

export default ScoringBoard;
