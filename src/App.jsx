import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import ProfileEdit from './pages/ProfileEdit';
import TeamManagement from './pages/TeamManagement';
import CreateMatchWizard from './pages/CreateMatchWizard';
import RosterJoin from './pages/RosterJoin';
import ScoringBoard from './pages/ScoringBoard';
import VisitorDashboard from './pages/VisitorDashboard';
import Leaderboard from './pages/Leaderboard';
import PlayerProfile from './pages/PlayerProfile';
import Settings from './pages/Settings';
import CreateUser from './pages/CreateUser';
import MyMatches from './pages/MyMatches';

import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/matches/:matchId/join" element={<RosterJoin />} />
          <Route path="/matches/:matchId/live" element={<VisitorDashboard />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<ProfileEdit />} />
            <Route path="/players/:playerId" element={<PlayerProfile />} />
            <Route path="/teams" element={<TeamManagement />} />
            <Route path="/matches/new" element={<CreateMatchWizard />} />
            <Route path="/matches/:matchId/score" element={<ScoringBoard />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/create-user" element={<CreateUser />} />
            <Route path="/my-matches" element={<MyMatches />} />
          </Route>

          {/* Root Redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ThemeToggle />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
