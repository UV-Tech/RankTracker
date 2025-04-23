import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NavBar.css';
import { useUser } from '../context/UserContext';

function NavBar() {
  const { user, logout, isAuthenticated } = useUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.navbar-user-dropdown')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    // First close dropdown
    setDropdownOpen(false);
    
    try {
      // Perform logout - this now includes a built-in delay
      await logout();
      
      // Navigate to login page with replace to prevent back navigation
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // If logout fails, still try to navigate to login
      navigate('/login', { replace: true });
    }
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-logo">
          RankTracker
        </Link>
      </div>
      
      <div className="navbar-menu">
        {isAuthenticated && (
          <>
            <Link to="/" className="navbar-item">Domains</Link>
            
            <div className="navbar-user-dropdown">
              <button 
                className="navbar-user-button" 
                onClick={toggleDropdown}
              >
                {user.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="navbar-avatar"
                  />
                ) : (
                  <div className="navbar-avatar-placeholder">
                    {user.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="navbar-username">{user.name}</span>
                <i className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}></i>
              </button>
              
              {dropdownOpen && isAuthenticated && (
                <div className="navbar-dropdown">
                  <div className="dropdown-user-info">
                    <div className="dropdown-name">{user.name}</div>
                    <div className="dropdown-email">{user.email}</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item">
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

export default NavBar; 