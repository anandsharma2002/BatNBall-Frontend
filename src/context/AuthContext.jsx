import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

// Synchronously initialize default Authorization header if token exists in localStorage
const initialToken = localStorage.getItem('token');
if (initialToken && initialToken !== 'null' && initialToken !== 'undefined') {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('token');
    return (saved && saved !== 'null' && saved !== 'undefined') ? saved : null;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return (saved && saved !== 'null' && saved !== 'undefined') ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState(() => {
    const saved = localStorage.getItem('role');
    return (saved && saved !== 'null' && saved !== 'undefined') ? saved : null;
  });

  // Set default auth headers whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Global interceptor for 401 Unauthorized errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Clear authentication states and localStorage
          setToken(null);
          setUser(null);
          setRole(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          delete axios.defaults.headers.common['Authorization'];
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (phone_number, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        phone_number,
        password
      });

      const { token: userToken, role: userRole, user: userData } = response.data;

      setToken(userToken);
      setRole(userRole);
      setUser(userData);

      localStorage.setItem('role', userRole);
      localStorage.setItem('user', JSON.stringify(userData));

      return { success: true, role: userRole };
    } catch (error) {
      const msg = error.response?.data?.error || 'Login failed. Please check credentials.';
      throw new Error(msg);
    }
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
  };

  const changePassword = async (current_password, new_password, confirm_new_password) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/users/change-password`, {
        current_password,
        new_password,
        confirm_new_password
      });
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to change password.';
      throw new Error(msg);
    }
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, role, login, logout, changePassword, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
