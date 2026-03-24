import { signOut } from 'firebase/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const loc = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const displayName = user?.displayName?.trim() || 'Clinician';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        Simu<span>Care</span>
      </Link>
      <div className="navbar-links">
        <Link to="/" className={loc.pathname === '/' ? 'active' : ''}>
          Home
        </Link>
        {user && (
          <Link to="/predict" className={loc.pathname === '/predict' ? 'active' : ''}>
            Predict
          </Link>
        )}
        {user && (
          <Link to="/history" className={loc.pathname === '/history' ? 'active' : ''}>
            History
          </Link>
        )}
        {user && (
          <Link to="/profile" className={loc.pathname === '/profile' ? 'active' : ''}>
            Profile
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <div className="profile-chip">
            <div className="profile-avatar">{initials || 'C'}</div>
            <div className="profile-meta">
              <span className="profile-name">{displayName}</span>
              <span className="profile-email">{user.email}</span>
            </div>
          </div>
        )}
        {user && (
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        )}
        {!user && (
          <Link to="/login">
            <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Sign In
            </button>
          </Link>
        )}
      </div>
    </nav>
  );
}
