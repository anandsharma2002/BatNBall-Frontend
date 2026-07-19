import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import {
  Shield, Zap, AlertTriangle, Play, Award, CheckCircle, 
  ChevronRight, RefreshCw, Users, HelpCircle, Share2
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
  balls === 0 ? '0.0' : ((runs / balls) * 100).toFixed(1);

const calcEconomy = (runs, balls) =>
  balls === 0 ? '0.00' : ((runs / (balls / 6))).toFixed(2);

// ─── Ball Chip ─────────────────────────────────────────────────────────────────
const BallChip = ({ ball }) => {
  let bg = 'rgba(255,255,255,0.06)';
  let text = ball.runs_from_bat + ball.extra_runs;
  let color = 'var(--text-color)';

  if (ball.dismissal?.is_wicket) { bg = '#dc2626'; text = 'W'; color = '#fff'; }
  else if (ball.is_boundary && ball.boundary_type === 'SIX') { bg = 'var(--accent-color)'; color = 'var(--dominant-color)'; }
  else if (ball.is_boundary && ball.boundary_type === 'FOUR') { bg = '#22c55e'; color = '#fff'; }
  else if (!ball.is_legal_delivery) { bg = '#ca8a04'; color = '#fff'; text = ball.extra_type?.[0] ?? 'E'; }
  else if (text === 0) { bg = 'rgba(255,255,255,0.03)'; color = 'var(--text-muted)'; text = '•'; }

  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: '700', fontSize: '0.75rem', background: bg, color,
      border: '1px solid var(--border-color)', flexShrink: 0
    }}>
      {text}
    </div>
  );
};

// ─── Score Pill ────────────────────────────────────────────────────────────────
const ScorePill = ({ label, value, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    textAlign: 'center',
    minWidth: '95px',
    flex: '1'
  }}>
    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--secondary-color)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
  </div>
);

const VisitorDashboard = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const prevLastBallIdRef = useRef(null);

  const [match, setMatch] = useState(null);
  const [balls, setBalls] = useState([]);
  const [partnership, setPartnership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interactive UI State
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'scorecard'
  const [scorecardInnings, setScorecardInnings] = useState(1); // 1 or 2

  // Event Animation States
  const [wicketFlash, setWicketFlash] = useState(false);
  const [boundaryFlash, setBoundaryFlash] = useState(null); // 'FOUR' | 'SIX' | null
  const [scoreGlow, setScoreGlow] = useState(false);

  // Share link states
  const [copied, setCopied] = useState(false);

  // Responsive Grid State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Toast State
  const [toast, setToast] = useState('');
  const [toastTimeout, setToastTimeout] = useState(null);
  const [umpireRequest, setUmpireRequest] = useState(null);

  const showToast = (msg) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    setToast(msg);
    const to = setTimeout(() => setToast(''), 3000);
    setToastTimeout(to);
  };

  const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if current user is active umpire
  const isActiveUmpire = () => {
    if (!user) return false;
    if (match?.active_umpire_id) {
      const activeId = match.active_umpire_id._id || match.active_umpire_id;
      return user.associated_player_id && activeId.toString() === user.associated_player_id.toString();
    }
    const creatorId = match?.created_by?._id || match?.created_by;
    return creatorId && creatorId.toString() === user.id?.toString();
  };

  // Check if current user is one of the umpires chosen during match creation
  const isRegisteredUmpire = () => {
    if (!user?.associated_player_id) return false;
    return match?.umpires?.some(ump => (ump._id || ump).toString() === user.associated_player_id.toString());
  };

  const handleRequestUmpire = async () => {
    try {
      await axios.post(`${API}/matches/${matchId}/score/request-umpire`, {}, authHeaders);
      showToast('✉️ Request sent to current umpire!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send umpire request');
    }
  };

  const handleAcceptUmpire = async (requesterPlayerId) => {
    try {
      await axios.post(`${API}/matches/${matchId}/score/accept-umpire`, { requesterPlayerId }, authHeaders);
      setUmpireRequest(null);
      showToast('🔄 Umpire role transferred successfully!');
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
      showToast('🎓 Umpire appointed successfully!');
      fetchScorecard();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to appoint umpire');
    }
  };

  // ─── Fetch Match Data ────────────────────────────────────────────────────────
  const fetchScorecard = async () => {
    try {
      const { data } = await axios.get(`${API}/matches/${matchId}/score/scorecard`);
      setMatch(data.match);
      setBalls(data.balls || []);
      
      // Infer active innings
      if (data.match?.current_innings) {
        setScorecardInnings(data.match.current_innings);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Match details could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  // ─── Socket.io Connection ────────────────────────────────────────────────────
  useEffect(() => {
    fetchScorecard();

    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current.emit('join:match', matchId);

    // Live score update receiver
    socketRef.current.on('match:score_update', ({ match: updatedMatch, balls: updatedBalls, partnership: updatedPartnership }) => {
      setMatch(updatedMatch);
      if (updatedBalls) {
        setBalls(updatedBalls);
      }
      if (updatedPartnership) {
        setPartnership(updatedPartnership);
      } else {
        setPartnership(null);
      }
    });

    // Umpire request receiver
    socketRef.current.on('match:umpire_request', ({ requesterPlayerId, requesterName, targetUmpirePlayerId }) => {
      const activeId = match?.active_umpire_id?._id || match?.active_umpire_id;
      const isTarget = targetUmpirePlayerId
        ? (user?.associated_player_id && targetUmpirePlayerId === user.associated_player_id.toString())
        : (match?.created_by && match.created_by.toString() === user?.id?.toString());

      if (isTarget) {
        setUmpireRequest(prev => {
          if (prev?.timeoutId) clearTimeout(prev.timeoutId);
          return null;
        });

        const timeoutId = setTimeout(() => {
          setUmpireRequest(null);
        }, 5000); // 5 seconds auto-dismiss

        setUmpireRequest({ requesterPlayerId, requesterName, timeoutId });
      }
    });

    // Umpire handover accepted event
    socketRef.current.on('match:umpire_accepted', ({ newActiveUmpireId }) => {
      if (user?.associated_player_id && newActiveUmpireId === user.associated_player_id.toString()) {
        showToast('🎉 You are now the active umpire! Redirecting to score panel...');
        setTimeout(() => {
          navigate(`/matches/${matchId}/score`);
        }, 2000);
      } else {
        fetchScorecard();
      }
    });

    return () => socketRef.current?.disconnect();
  }, [matchId, user, match?.active_umpire_id, match?.created_by]);

  // ─── Trigger Micro-Animations on New Ball ────────────────────────────────────
  useEffect(() => {
    if (balls.length === 0) return;
    const lastBall = balls[balls.length - 1];

    if (prevLastBallIdRef.current && prevLastBallIdRef.current !== lastBall._id) {
      // Trigger Wicket Flash
      if (lastBall.dismissal?.is_wicket) {
        setWicketFlash(true);
        setTimeout(() => setWicketFlash(false), 1500);
      }
      // Trigger Boundary Border Flash
      else if (lastBall.is_boundary) {
        setBoundaryFlash(lastBall.boundary_type);
        setTimeout(() => setBoundaryFlash(null), 1500);
      }

      // Trigger Score Glow
      setScoreGlow(true);
      setTimeout(() => setScoreGlow(false), 1000);
    }
    prevLastBallIdRef.current = lastBall._id;
  }, [balls]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Compile Scorecard on the fly from balls log ─────────────────────────────
  const compileScorecard = (inningsNum) => {
    const inningsBalls = balls.filter(b => b.innings_number === inningsNum);
    const battingTeamPlayers = inningsNum === 1 ? match?.playing_xi_team_first : match?.playing_xi_team_second;
    const bowlingTeamPlayers = inningsNum === 1 ? match?.playing_xi_team_second : match?.playing_xi_team_first;

    const batsmanStats = {}; // player_id -> { name, runs, balls, fours, sixes, dismissalText, isBatted }
    const bowlerStats = {}; // player_id -> { name, legalBalls, runs, wickets, oversConceded, oversBalls }

    // Initialize playing squads to list those who did not bat/bowl
    battingTeamPlayers?.forEach(p => {
      batsmanStats[p._id] = { id: p._id.toString(), name: p.display_name, runs: 0, balls: 0, fours: 0, sixes: 0, dismissalText: 'did not bat', isBatted: false };
    });
    bowlingTeamPlayers?.forEach(p => {
      bowlerStats[p._id] = { id: p._id.toString(), name: p.display_name, legalBalls: 0, runs: 0, wickets: 0, oversConceded: {}, oversBalls: {} };
    });

    // Process ball by ball
    inningsBalls.forEach(ball => {
      const strikerId = ball.striker_id?._id || ball.striker_id;
      const nonStrikerId = ball.non_striker_id?._id || ball.non_striker_id;
      const bowlerId = ball.bowler_id?._id || ball.bowler_id;

      // Handle Batsman Stats
      if (strikerId) {
        if (!batsmanStats[strikerId]) {
          batsmanStats[strikerId] = { id: strikerId.toString(), name: 'Unknown Batsman', runs: 0, balls: 0, fours: 0, sixes: 0, dismissalText: 'not out', isBatted: true };
        }
        batsmanStats[strikerId].isBatted = true;
        if (batsmanStats[strikerId].dismissalText === 'did not bat') {
          batsmanStats[strikerId].dismissalText = 'not out';
        }

        if (ball.is_legal_delivery) {
          batsmanStats[strikerId].balls += 1;
          batsmanStats[strikerId].runs += ball.runs_from_bat;
          if (ball.is_boundary && ball.boundary_type === 'FOUR') batsmanStats[strikerId].fours += 1;
          if (ball.is_boundary && ball.boundary_type === 'SIX') batsmanStats[strikerId].sixes += 1;
        } else if (ball.extra_type === 'NO_BALL') {
          batsmanStats[strikerId].balls += 1;
          batsmanStats[strikerId].runs += ball.runs_from_bat;
          if (ball.is_boundary && ball.boundary_type === 'FOUR') batsmanStats[strikerId].fours += 1;
          if (ball.is_boundary && ball.boundary_type === 'SIX') batsmanStats[strikerId].sixes += 1;
        }
      }

      if (nonStrikerId) {
        if (!batsmanStats[nonStrikerId]) {
          batsmanStats[nonStrikerId] = { id: nonStrikerId.toString(), name: 'Unknown Batsman', runs: 0, balls: 0, fours: 0, sixes: 0, dismissalText: 'not out', isBatted: true };
        }
        if (batsmanStats[nonStrikerId].dismissalText === 'did not bat') {
          batsmanStats[nonStrikerId].dismissalText = 'not out';
        }
        batsmanStats[nonStrikerId].isBatted = true;
      }

      // Handle Wicket Dismissals
      if (ball.dismissal?.is_wicket) {
        const outPlayerId = ball.dismissal.dismissed_player_id?._id || ball.dismissal.dismissed_player_id || strikerId;
        if (outPlayerId && batsmanStats[outPlayerId]) {
          batsmanStats[outPlayerId].isBatted = true;
          const wType = ball.dismissal.wicket_type;
          const bowlerName = bowlerStats[bowlerId]?.name || 'Bowler';
          const fielderName = ball.dismissal.fielder_involved_id?.display_name || 'Fielder';

          let desc = 'out';
          if (wType === 'BOWLED') desc = `b ${bowlerName}`;
          else if (wType === 'CAUGHT') desc = `c ${fielderName} b ${bowlerName}`;
          else if (wType === 'CAUGHT_AND_BOWLED') desc = `c & b ${bowlerName}`;
          else if (wType === 'LBW') desc = `lbw b ${bowlerName}`;
          else if (wType === 'STUMPED') desc = `st ${fielderName} b ${bowlerName}`;
          else if (wType === 'RUN_OUT') desc = `run out (${fielderName})`;
          else if (wType === 'HIT_WICKET') desc = `hit wicket b ${bowlerName}`;
          else if (wType === 'RETIRED_HURT') desc = 'retired hurt';
          else if (wType === 'RETIRED_OUT') desc = 'retired out';

          batsmanStats[outPlayerId].dismissalText = desc;
        }
      }

      // Handle Bowler Stats
      if (bowlerId) {
        if (!bowlerStats[bowlerId]) {
          bowlerStats[bowlerId] = { id: bowlerId.toString(), name: 'Unknown Bowler', legalBalls: 0, runs: 0, wickets: 0, oversConceded: {}, oversBalls: {} };
        }

        // Conceded runs calculation
        let runConceded = 0;
        if (ball.is_extra) {
          if (['WIDE', 'NO_BALL'].includes(ball.extra_type)) {
            runConceded = ball.extra_runs + ball.runs_from_bat;
          }
        } else {
          runConceded = ball.runs_from_bat;
        }
        bowlerStats[bowlerId].runs += runConceded;

        // Wickets calculation
        if (ball.dismissal?.is_wicket && ['BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'HIT_WICKET'].includes(ball.dismissal.wicket_type)) {
          bowlerStats[bowlerId].wickets += 1;
        }

        // Legal deliveries
        if (ball.is_legal_delivery) {
          bowlerStats[bowlerId].legalBalls += 1;
        }

        // Over-by-over log to calculate maidens
        const overNum = ball.over_number;
        bowlerStats[bowlerId].oversConceded[overNum] = (bowlerStats[bowlerId].oversConceded[overNum] || 0) + runConceded;
        bowlerStats[bowlerId].oversBalls[overNum] = (bowlerStats[bowlerId].oversBalls[overNum] || 0) + (ball.is_legal_delivery ? 1 : 0);
      }
    });

    // Calculate maidens
    Object.keys(bowlerStats).forEach(id => {
      let maidens = 0;
      const bStat = bowlerStats[id];
      Object.keys(bStat.oversBalls).forEach(overNum => {
        if (bStat.oversBalls[overNum] === 6 && (bStat.oversConceded[overNum] || 0) === 0) {
          maidens += 1;
        }
      });
      bowlerStats[id].maidens = maidens;
    });

    // Extra runs breakdown
    let wides = 0, noBalls = 0, byes = 0, legByes = 0, penalty = 0;
    inningsBalls.forEach(b => {
      if (b.is_extra) {
        if (b.extra_type === 'WIDE') wides += b.extra_runs;
        else if (b.extra_type === 'NO_BALL') noBalls += b.extra_runs;
        else if (b.extra_type === 'BYE') byes += b.extra_runs;
        else if (b.extra_type === 'LEG_BYE') legByes += b.extra_runs;
        else if (b.extra_type === 'PENALTY') penalty += b.extra_runs;
      }
    });
    const totalExtras = wides + noBalls + byes + legByes + penalty;

    // Sort batsmen according to crease entrance order
    const entranceOrder = [];
    inningsBalls.forEach(ball => {
      const strikerId = ball.striker_id?._id || ball.striker_id;
      const nonStrikerId = ball.non_striker_id?._id || ball.non_striker_id;
      
      if (strikerId && !entranceOrder.includes(strikerId.toString())) {
        entranceOrder.push(strikerId.toString());
      }
      if (nonStrikerId && !entranceOrder.includes(nonStrikerId.toString())) {
        entranceOrder.push(nonStrikerId.toString());
      }
    });

    if (match && match.current_innings === inningsNum && match.crease_state) {
      const strikerId = match.crease_state.striker_id?._id || match.crease_state.striker_id;
      const nonStrikerId = match.crease_state.non_striker_id?._id || match.crease_state.non_striker_id;
      if (strikerId && !entranceOrder.includes(strikerId.toString())) {
        entranceOrder.push(strikerId.toString());
      }
      if (nonStrikerId && !entranceOrder.includes(nonStrikerId.toString())) {
        entranceOrder.push(nonStrikerId.toString());
      }
    }

    const sortedBatsmen = [];
    entranceOrder.forEach(pId => {
      const stats = batsmanStats[pId];
      if (stats) sortedBatsmen.push(stats);
    });

    Object.keys(batsmanStats).forEach(pId => {
      if (!entranceOrder.includes(pId)) {
        sortedBatsmen.push(batsmanStats[pId]);
      }
    });

    return {
      batsmen: sortedBatsmen,
      bowlers: Object.values(bowlerStats).filter(b => b.legalBalls > 0 || b.runs > 0),
      bowlerStatsMap: bowlerStats,
      extras: { total: totalExtras, wides, noBalls, byes, legByes, penalty }
    };
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

  const recentBalls = balls.filter(b => b.innings_number === innings).slice(-6);
  const innings1Score = match?.innings1?.score ?? 0;
  const targetVal = innings1Score + 1;

  // Compile stats for selected innings in tab
  const scorecardData = compileScorecard(scorecardInnings);

  return (
    <>
      <Navigation />

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'var(--secondary-color)', color: '#fff',
          padding: '0.75rem 1.5rem', borderRadius: '8px',
          fontWeight: '700', fontSize: '0.95rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {toast}
        </div>
      )}

      {/* Umpire request popup toast */}
      {umpireRequest && (
        <div style={{
          position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'var(--dominant-color, #1e1e24)', color: 'var(--text-color, #ffffff)',
          border: '2px solid var(--accent-color, #c6a567)', borderRadius: '10px',
          padding: '1rem 1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: '1.5rem'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            {umpireRequest.requesterName} wants to become umpire
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => handleAcceptUmpire(umpireRequest.requesterPlayerId)}
              style={{
                background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease'
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
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              title="Reject"
            >
              ✗
            </button>
          </div>
        </div>
      )}

      {/* Red Wicket Overlay Flash */}
      {wicketFlash && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(220, 38, 38, 0.18)',
          zIndex: 999, pointerEvents: 'none',
          animation: 'flashRed 1.5s ease-out forwards'
        }} />
      )}

      {/* CSS Animation Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flashRed {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}} />

      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem', boxSizing: 'border-box' }}>
        
        {/* Match Header Info */}
        <div className="glass" style={{
          padding: '1.5rem', marginBottom: '1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexWrap: 'wrap', gap: '1rem', position: 'relative',
          border: boundaryFlash === 'SIX' ? '2px solid var(--accent-color)' : boundaryFlash === 'FOUR' ? '2px solid #22c55e' : '1px solid var(--border-color)',
          boxShadow: boundaryFlash === 'SIX' ? '0 0 20px rgba(198,165,103,0.3)' : boundaryFlash === 'FOUR' ? '0 0 20px rgba(34,197,94,0.3)' : 'var(--shadow)',
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              {match?.match_status === 'LIVE' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                  padding: '0.2rem 0.5rem', borderRadius: '20px',
                  fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
                  animation: 'pulseGlow 2s infinite'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  Live Broadcast
                </div>
              ) : match?.match_status === 'COMPLETED' ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(29, 79, 42, 0.1)',
                  color: 'var(--secondary-color)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}>
                  <CheckCircle size={10} />
                  Completed
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                  padding: '0.2rem 0.5rem', borderRadius: '20px',
                  fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase'
                }}>{match?.match_status}</div>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match?.venue}</span>
            </div>
            
            {/* Team Scores Block */}
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
              const showInn2 = innings === 2 || match?.match_status === 'COMPLETED';

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '320px', maxWidth: '100%', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.05rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-color)' }}>{team1stBat?.team_name || '—'}</span>
                    {showInn1 ? (
                      <span style={{ fontWeight: '800', color: 'var(--secondary-color)' }}>
                        {inn1.score ?? 0}/{inn1.wickets ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-muted)' }}>({formatOvers(inn1.total_legal_balls ?? 0)}/{totalOv} ov)</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>–</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.05rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-color)' }}>{team2ndBat?.team_name || '—'}</span>
                    {showInn2 ? (
                      <span style={{ fontWeight: '800', color: 'var(--secondary-color)' }}>
                        {inn2.score ?? 0}/{inn2.wickets ?? 0} <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-muted)' }}>({formatOvers(inn2.total_legal_balls ?? 0)}/{totalOv} ov)</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Yet to bat</span>
                    )}
                  </div>
                </div>
              );
            })()}
            {match?.match_status === 'COMPLETED' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--secondary-color)', fontWeight: '750', marginTop: '0.4rem', marginBottom: 0 }}>
                {(() => {
                  if (!match.winner_team_id) {
                    return match.result_type === 'TIE' ? 'Match Tied' : 'No Result / Draw';
                  }
                  const winnerName = match.winner_team_id.team_name || 'Winner';
                  const margin = match.win_margin || 0;
                  const resType = match.result_type ? match.result_type.toLowerCase() : 'runs';
                  return `${winnerName} won by ${margin} ${resType}`;
                })()}
              </p>
            )}

            {/* Live crease stats block */}
            {['LIVE', 'PAUSED', 'RAIN_DELAY'].includes(match?.match_status) && (() => {
              const currentInnings = match?.current_innings || 1;
              const scorecard = compileScorecard(currentInnings);

              const strikerId = (match?.crease_state?.striker_id?._id || match?.crease_state?.striker_id)?.toString();
              const nonStrikerId = (match?.crease_state?.non_striker_id?._id || match?.crease_state?.non_striker_id)?.toString();
              const bowlerId = (match?.crease_state?.bowler_id?._id || match?.crease_state?.bowler_id)?.toString();

              // Get both crease batsmen in FIXED entrance order (filter preserves array order)
              const creaseBatsmen = scorecard.batsmen.filter(b =>
                b.id === strikerId || b.id === nonStrikerId
              );

              const bowler = scorecard.bowlerStatsMap && bowlerId
                ? scorecard.bowlerStatsMap[bowlerId]
                : null;

              const formatOvers = (legalBalls) => {
                const ov = Math.floor(legalBalls / 6);
                const bl = legalBalls % 6;
                return `${ov}.${bl}`;
              };

              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(0,0,0,0.07)',
                  fontSize: '0.85rem',
                  color: 'var(--text-color)',
                  lineHeight: '1.6',
                  gap: '1rem'
                }}>
                  {/* Batsmen — fixed order, only * moves */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1 }}>
                    {creaseBatsmen.length > 0 ? creaseBatsmen.map(b => {
                      const isOnStrike = b.id === strikerId;
                      return (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontWeight: '500', color: 'var(--text-color)' }}>
                            {b.name}{isOnStrike ? '*' : '\u00a0'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {b.runs} ({b.balls})
                          </span>
                        </div>
                      );
                    }) : (
                      <div style={{ color: 'var(--text-muted)' }}>No batsmen at crease</div>
                    )}
                  </div>

                  {/* Bowler — far right */}
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
                    {bowler ? (
                      <>
                        <div style={{ fontWeight: '500', color: 'var(--text-color)' }}>
                          {bowler.name}
                        </div>
                        <div style={{ color: 'var(--accent-color)', fontSize: '0.82rem' }}>
                          {bowler.wickets}/{bowler.runs} ({formatOvers(bowler.legalBalls)})
                        </div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>–</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={handleShare} 
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                color: 'var(--text-color)', width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                position: 'relative'
              }}
              title="Share match link"
            >
              <Share2 size={14} />
              {copied && (
                <span style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  backgroundColor: 'var(--secondary-color)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  marginBottom: '0.5rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                  Link copied!
                </span>
              )}
            </button>
            <button 
              onClick={fetchScorecard} 
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                color: 'var(--text-color)', width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
              title="Refresh scorecard"
            >
              <RefreshCw size={14} />
            </button>

            {/* "Point as Umpire" — only for registered umpires who are NOT the active umpire */}
            {isRegisteredUmpire() && !isActiveUmpire() && match?.match_status !== 'COMPLETED' && (
              <button
                onClick={handleRequestUmpire}
                style={{
                  background: 'rgba(198,165,103,0.12)',
                  border: '1px solid rgba(198,165,103,0.4)',
                  color: 'var(--accent-color, #c6a567)',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Request to become active umpire"
              >
                🏏 Point as Umpire
              </button>
            )}

            {/* "Appoint Umpire" dropdown — only for match creator */}
            {(() => {
              const creatorId = (match?.created_by?._id || match?.created_by)?.toString();
              const isCreator = creatorId && creatorId === user?.id?.toString();
              if (!isCreator || !match?.umpires?.length || match?.match_status === 'COMPLETED') return null;
              return (
                <select
                  onChange={handleAppointUmpire}
                  defaultValue=""
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.4rem 0.6rem',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
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
              );
            })()}
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex', borderBottom: '2px solid var(--border-color)',
          marginBottom: '1.5rem', gap: '1rem'
        }}>
          {[
            { id: 'live', name: 'Live Tracking' },
            { id: 'scorecard', name: 'Full Scoreboard' },
            { id: 'squads', name: 'Playing Squads' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none',
                color: activeTab === tab.id ? 'var(--secondary-color)' : 'var(--text-muted)',
                padding: '0.75rem 0.5rem', fontSize: '0.9rem', fontWeight: '700',
                cursor: 'pointer', position: 'relative',
                transition: 'color 0.2s ease'
              }}
            >
              {tab.name}
              {activeTab === tab.id && (
                <div style={{
                  position: 'absolute', bottom: '-2px', left: 0, right: 0,
                  height: '2.5px', background: 'var(--secondary-color)',
                  borderRadius: '2px'
                }} />
              )}
            </button>
          ))}
        </div>

            {/* ── LIVE TRACKING TAB ──────────────────────────────────────────────── */}
            {activeTab === 'live' && (
              <>
                {/* Scoreboard block */}
                <div className="glass" style={{
                  padding: '1.5rem', marginBottom: '1.25rem',
                  border: boundaryFlash ? '1px solid var(--accent-color)' : '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {innings === 2 && (
                      <>
                        <ScorePill label="Target" value={targetVal} />
                        <ScorePill
                          label="Need"
                          value={Math.max(0, targetVal - (currentInnings.score ?? 0))}
                          sub={`in ${Math.max(0, (match?.total_overs_per_innings * 6) - (currentInnings.total_legal_balls ?? 0))} balls`}
                        />
                      </>
                    )}

                    <ScorePill
                      label="CRR"
                      value={currentInnings.total_legal_balls ? ((currentInnings.score / currentInnings.total_legal_balls) * 6).toFixed(2) : '0.00'}
                      sub="curr rate"
                    />

                    {innings === 2 && (() => {
                      const ballsLeft = Math.max(0, (match?.total_overs_per_innings ?? 0) * 6 - (currentInnings.total_legal_balls ?? 0));
                      const runsLeft = Math.max(0, targetVal - (currentInnings.score ?? 0));
                      const rrr = ballsLeft > 0 ? ((runsLeft / ballsLeft) * 6).toFixed(2) : '–';
                      return <ScorePill label="RRR" value={rrr} sub="req rate" />;
                    })()}
                  </div>

                  {/* Recent balls */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Over:</span>
                    {recentBalls.length === 0
                      ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Waiting for first ball...</span>
                      : recentBalls.map((b, i) => <BallChip key={b._id || i} ball={b} />)
                    }
                  </div>
                </div>



                {/* Active Partnership Card */}
                {partnership ? (
                  <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <Users size={14} style={{ color: 'var(--accent-color)' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Active Partnership</span>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                      {partnership.total_runs_scored} runs <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>({partnership.total_balls_faced} balls)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>{partnership.batsman_1_id?.display_name}: {partnership.runs_by_batsman_1} ({partnership.balls_by_batsman_1})</div>
                      <div>{partnership.batsman_2_id?.display_name}: {partnership.runs_by_batsman_2} ({partnership.balls_by_batsman_2})</div>
                    </div>
                  </div>
                ) : (
                  <div className="glass" style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                    No active partnership logged
                  </div>
                )}
              </>
            )}

            {/* ── FULL SCORECARD TAB ─────────────────────────────────────────────── */}
            {activeTab === 'scorecard' && (
              <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                
                {/* Innings Selector inside scorecard */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {[1, 2].map(inn => {
                    const team = inn === 1 ? match?.team_first_id : match?.team_second_id;
                    const scoreObj = inn === 1 ? match?.innings1 : match?.innings2;
                    return (
                      <button
                        key={inn}
                        onClick={() => setScorecardInnings(inn)}
                        style={{
                          flex: 1, padding: '0.6rem', borderRadius: '8px',
                          background: scorecardInnings === inn ? 'var(--secondary-color)' : 'rgba(255,255,255,0.03)',
                          color: scorecardInnings === inn ? '#fff' : 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {team?.team_short_name} {scoreObj?.score}/{scoreObj?.wickets} ({formatOvers(scoreObj?.total_legal_balls ?? 0)} ov)
                      </button>
                    );
                  })}
                </div>

                {/* Batting Card Table */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary-color)', textTransform: 'uppercase' }}>Batting</h3>
                <div style={{ overflowX: 'auto', marginBottom: '1.75rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem 0.25rem' }}>Batter</th>
                        <th style={{ padding: '0.5rem 0.25rem' }}>Status</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>R</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>B</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>4s</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>6s</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const activeBatsmen = scorecardData.batsmen.filter(b => b.isBatted);
                        if (activeBatsmen.length === 0) {
                          return (
                            <tr>
                              <td colSpan="7" style={{ padding: '1rem 0.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>No batting stats available</td>
                            </tr>
                          );
                        }
                        return activeBatsmen.map((b, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.6rem 0.25rem', fontWeight: '600' }}>{b.name}</td>
                            <td style={{ padding: '0.6rem 0.25rem', color: 'var(--text-muted)' }}>{b.dismissalText}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '700' }}>{b.runs}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{b.balls}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{b.fours}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{b.sixes}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', color: 'var(--text-muted)' }}>{calcStrikeRate(b.runs, b.balls)}</td>
                          </tr>
                        ));
                      })()}
                      {/* Extras Row */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>
                        <td style={{ padding: '0.6rem 0.25rem' }}>Extras</td>
                        <td style={{ padding: '0.6rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          (wd {scorecardData.extras.wides}, nb {scorecardData.extras.noBalls}, b {scorecardData.extras.byes}, lb {scorecardData.extras.legByes})
                        </td>
                        <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{scorecardData.extras.total}</td>
                        <td colSpan="4"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Did not bat section */}
                {(() => {
                  const didNotBat = scorecardData.batsmen.filter(b => !b.isBatted);
                  if (didNotBat.length === 0) return null;
                  return (
                    <div style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      marginBottom: '1.5rem',
                      padding: '0.2rem 0.25rem',
                      lineHeight: '1.4'
                    }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-color)' }}>Next: </span>
                      {didNotBat.map(b => b.name).join(', ')}
                    </div>
                  );
                })()}

                {/* Bowling Card Table */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--secondary-color)', textTransform: 'uppercase' }}>Bowling</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem 0.25rem' }}>Bowler</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>O</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>M</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>R</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>W</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Econ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorecardData.bowlers.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '1rem 0.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>No bowling stats available</td>
                        </tr>
                      ) : (
                        scorecardData.bowlers.map((b, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.6rem 0.25rem', fontWeight: '600' }}>{b.name}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{formatOvers(b.legalBalls)}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right' }}>{b.maidens}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '700' }}>{b.runs}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '700' }}>{b.wickets}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', color: 'var(--text-muted)' }}>{calcEconomy(b.runs, b.legalBalls)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* ── PLAYING SQUADS TAB ────────────────────────────────────────────── */}
            {activeTab === 'squads' && (
              <div className="glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                  
                  {/* Team 1 XI */}
                  <div>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--secondary-color)',
                      paddingBottom: '0.5rem',
                      color: 'var(--secondary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginBottom: '1rem'
                    }}>
                      <Users size={18} />
                      {match?.team_first_id?.team_name}
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {match?.playing_xi_team_first && match.playing_xi_team_first.length > 0 ? (
                        match.playing_xi_team_first.map((player, index) => (
                          <li key={player._id} style={{
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.6rem',
                            borderBottom: '1px solid rgba(255,255,255,0.02)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '18px' }}>{index + 1}</span>
                              <strong style={{ color: 'var(--text-color)' }}>{player.display_name}</strong>
                              {player.username && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{player.username}</span>}
                            </div>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: '700', 
                              padding: '0.15rem 0.4rem', 
                              backgroundColor: 'var(--border-color)', 
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              {(player.player_roles?.[0] || 'Player')
                                .toLowerCase()
                                .split('_')
                                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(' ')}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem' }}>No players joined this roster yet</li>
                      )}
                    </ul>
                  </div>

                  {/* Team 2 XI */}
                  <div>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '800',
                      borderBottom: '2px solid var(--accent-color)',
                      paddingBottom: '0.5rem',
                      color: 'var(--secondary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginBottom: '1rem'
                    }}>
                      <Users size={18} />
                      {match?.team_second_id?.team_name}
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {match?.playing_xi_team_second && match.playing_xi_team_second.length > 0 ? (
                        match.playing_xi_team_second.map((player, index) => (
                          <li key={player._id} style={{
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.6rem',
                            borderBottom: '1px solid rgba(255,255,255,0.02)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '18px' }}>{index + 1}</span>
                              <strong style={{ color: 'var(--text-color)' }}>{player.display_name}</strong>
                              {player.username && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{player.username}</span>}
                            </div>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: '700', 
                              padding: '0.15rem 0.4rem', 
                              backgroundColor: 'var(--border-color)', 
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              {(player.player_roles?.[0] || 'Player')
                                .toLowerCase()
                                .split('_')
                                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(' ')}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.5rem' }}>No players joined this roster yet</li>
                      )}
                    </ul>
                  </div>

                </div>
              </div>
            )}
          </div>
    </>
  );
};

export default VisitorDashboard;
