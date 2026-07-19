import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { API_BASE_URL } from '../config';
import { Users, Plus, UserPlus, CheckCircle, AlertTriangle, Search, Info } from 'lucide-react';

const TeamManagement = () => {
  const { user } = useAuth();

  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // Team creation form state
  const [teamName, setTeamName] = useState('');
  const [teamShortName, setTeamShortName] = useState('');
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Squad addition search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [roleInTeam, setRoleInTeam] = useState('MEMBER');

  // Status/loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch all teams
  const fetchTeams = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/teams`);
      setTeams(response.data);
      if (selectedTeam) {
        // Refresh details of currently selected team
        const refreshedSelected = response.data.find(t => t._id === selectedTeam._id);
        if (refreshedSelected) setSelectedTeam(refreshedSelected);
      }
    } catch (err) {
      console.error('Fetch teams error:', err);
      setError('Failed to load teams list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Search players for roster addition
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      axios.get(`${API_BASE_URL}/players/search?q=${searchQuery}`)
        .then(res => {
          // Filter out players already in the squad
          if (selectedTeam) {
            const memberIds = selectedTeam.squad_members.map(m => m.player_id?._id);
            setSearchResults(res.data.filter(p => !memberIds.includes(p._id)));
          } else {
            setSearchResults(res.data);
          }
        })
        .catch(err => console.error('Search error:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedTeam]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    if (!teamName || !teamShortName) {
      setError('Team name and short name are required');
      setActionLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('team_name', teamName);
    formData.append('team_short_name', teamShortName);
    if (selectedLogo) {
      formData.append('logo', selectedLogo);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/teams`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess('Team created successfully!');
      setTeamName('');
      setTeamShortName('');
      setSelectedLogo(null);
      setLogoPreview('');
      setShowCreateForm(false);
      fetchTeams();
      setSelectedTeam(response.data.team);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedTeam || !selectedPlayer) return;

    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/teams/${selectedTeam._id}/roster`, {
        player_id: selectedPlayer._id,
        role_in_team: roleInTeam
      });
      setSuccess(`Player ${selectedPlayer.display_name} added to squad!`);
      setSelectedPlayer(null);
      setSearchQuery('');
      setSearchResults([]);
      setRoleInTeam('MEMBER');
      fetchTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add squad member.');
    } finally {
      setActionLoading(false);
    }
  };

  const isCreatorOrAdmin = selectedTeam && (
    selectedTeam.created_by_user_id === user?.id || user?.role === 'SUPER_ADMIN'
  );

  return (
    <>
      <Navigation />
      <div className="team-management-grid" style={{
        maxWidth: '1000px',
        margin: '2rem auto',
        padding: '0 1.5rem'
      }}>
        {/* Left Sidebar: Teams list */}
        <aside className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '800', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={20} />
              Teams List
            </h3>
            {!showCreateForm && (
              <button 
                onClick={() => { setShowCreateForm(true); setSelectedTeam(null); setError(''); setSuccess(''); }}
                style={{
                  backgroundColor: 'var(--secondary-color)',
                  color: '#ffffff',
                  padding: '0.3rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Create Team"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {teams.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                No teams registered.
              </div>
            ) : (
              teams.map((t) => (
                <button
                  key={t._id}
                  onClick={() => { setSelectedTeam(t); setShowCreateForm(false); setError(''); setSuccess(''); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    width: '100%',
                    textAlign: 'left',
                    backgroundColor: selectedTeam?._id === t._id ? 'rgba(29, 79, 42, 0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedTeam?._id === t._id ? 'var(--secondary-color)' : 'transparent',
                    color: 'var(--text-color)',
                    cursor: 'pointer'
                  }}
                >
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '700' }}>
                      {t.team_short_name}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{t.team_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.squad_members.length} Squad Members</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right Content Pane */}
        <main>
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
              marginBottom: '1rem'
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
              marginBottom: '1rem'
            }}>
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Form: Create Team */}
          {showCreateForm && (
            <div className="glass" style={{ padding: '2rem', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontWeight: '800', fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--secondary-color)' }}>
                Create New Team
              </h3>
              <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: '2px dashed var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Users size={32} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <label htmlFor="logo-upload" style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      top: 0,
                      left: 0,
                      cursor: 'pointer',
                      background: 'transparent'
                    }}>
                      <input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to upload team logo</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Team Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Royal Challengers Bengaluru" 
                    value={teamName} 
                    onChange={(e) => setTeamName(e.target.value)} 
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Team Short Name (Abbreviation) *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. RCB" 
                    value={teamShortName} 
                    onChange={(e) => setTeamShortName(e.target.value)} 
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                    {actionLoading ? 'Creating...' : 'Create Team'}
                  </button>
                  <button type="button" onClick={() => { setShowCreateForm(false); setError(''); }} className="btn" style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* View: Selected Team details */}
          {selectedTeam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Team Profile */}
              <div className="glass" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: 'var(--shadow)' }}>
                {selectedTeam.logo_url ? (
                  <img src={selectedTeam.logo_url} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: '800', color: 'var(--text-color)' }}>
                    {selectedTeam.team_short_name}
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{selectedTeam.team_name}</h2>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '0.2rem' }}>
                    Abbreviation: {selectedTeam.team_short_name}
                  </div>
                </div>
              </div>

              {/* Roster & Adding interface */}
              <div className="glass" style={{ padding: '2rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={22} />
                  Squad Members ({selectedTeam.squad_members.length})
                </h3>

                {/* Squad Members grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem',
                  width: '100%'
                }}>
                  {selectedTeam.squad_members.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', fontSize: '0.9rem', color: 'var(--text-muted)', padding: '1rem 0' }}>
                      No players have joined this team's squad yet.
                    </div>
                  ) : (
                    selectedTeam.squad_members.map((member) => (
                      <div key={member.player_id?._id || Math.random()} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,0,0,0.01)'
                      }}>
                        {member.player_id?.profile_picture_url ? (
                          <img src={member.player_id.profile_picture_url} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem' }}>
                            {member.player_id?.first_name?.slice(0, 1) || 'P'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{member.player_id?.display_name || 'Generic Player'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: '600' }}>{member.role_in_team}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add member interface (visible to creators/admins) */}
                {isCreatorOrAdmin && (
                  <div style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '1.5rem',
                    marginTop: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <UserPlus size={18} style={{ color: 'var(--secondary-color)' }} />
                      Add Squad Member
                    </h4>
                    <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Autocomplete Player Search */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Search Player</label>
                        <div style={{ position: 'relative' }}>
                          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input 
                            type="text" 
                            placeholder="Type player display name..." 
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSelectedPlayer(null); }}
                            style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.85rem', paddingY: '0.5rem' }}
                          />
                        </div>

                        {/* Search result dropdown */}
                        {searchResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'var(--dominant-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 10,
                            marginTop: '0.25rem'
                          }}>
                            {searchResults.map((player) => (
                              <button
                                key={player._id}
                                type="button"
                                onClick={() => { setSelectedPlayer(player); setSearchQuery(player.display_name); setSearchResults([]); }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  padding: '0.5rem 1rem',
                                  width: '100%',
                                  textAlign: 'left',
                                  borderBottom: '1px solid var(--border-color)',
                                  color: 'var(--text-color)',
                                  cursor: 'pointer'
                                }}
                              >
                                {player.profile_picture_url ? (
                                  <img src={player.profile_picture_url} alt="Avatar" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'var(--dominant-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700' }}>
                                    {player.first_name.slice(0, 1)}
                                  </div>
                                )}
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{player.display_name} ({player.first_name} {player.last_name})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Role selection & Submit */}
                      {selectedPlayer && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          alignItems: 'flex-end',
                          padding: '1rem',
                          backgroundColor: 'rgba(29, 79, 42, 0.04)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 180px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>Role in Team</label>
                            <select value={roleInTeam} onChange={(e) => setRoleInTeam(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                              <option value="MEMBER">Standard Member</option>
                              <option value="CAPTAIN">Captain</option>
                              <option value="WICKET_KEEPER">Wicket Keeper</option>
                            </select>
                          </div>
                          
                          <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}>
                            {actionLoading ? 'Adding...' : 'Confirm Add'}
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fallback View: Selection prompt */}
          {!selectedTeam && !showCreateForm && (
            <div className="glass" style={{ padding: '3rem', textAlign: 'center', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <Users size={48} style={{ color: 'var(--accent-color)' }} />
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem' }}>No Team Selected</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Select a team from the left sidebar to manage its squad roster, or create a new team using the plus icon.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default TeamManagement;
