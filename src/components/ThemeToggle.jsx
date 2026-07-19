import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 16px var(--shadow-color)',
        zIndex: 9999,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
      aria-label={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
    >
      {theme === 'light' ? (
        <Moon size={20} style={{ color: 'var(--secondary-color)' }} />
      ) : (
        <Sun size={20} style={{ color: 'var(--accent-color)' }} />
      )}
    </button>
  );
};

export default ThemeToggle;
