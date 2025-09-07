import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import './Login.css';

function Login() {
  const { refreshUser, isAuthenticated, isLoading } = useUser();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const navigate = useNavigate();

  // Set axios to include credentials
  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('User already authenticated, redirecting to home');
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    const newErrors = [];

    if (!formData.email || !formData.email.includes('@')) {
      newErrors.push('Valid email is required');
    }

    if (!formData.password || formData.password.length < 6) {
      newErrors.push('Password must be at least 6 characters');
    }

    if (mode === 'register') {
      if (!formData.name) {
        newErrors.push('Name is required');
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.push('Passwords do not match');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      console.log(`Attempting to ${mode} with email: ${formData.email}`);
      let response;

      if (mode === 'login') {
        response = await axios.post('/auth/login', {
          email: formData.email,
          password: formData.password
        });
        console.log('Login response:', response.data);
      } else {
        response = await axios.post('/auth/register', {
          name: formData.name,
          username: formData.username || formData.name,
          email: formData.email,
          password: formData.password
        });
        console.log('Registration response:', response.data);
      }

      // Refresh user data in context
      if (response.data.user) {
        console.log('User authenticated, refreshing user context');
        await refreshUser();
        console.log('Navigation to homepage');
        navigate('/');
      } else {
        console.error('No user data in response:', response.data);
        setErrors(['Authentication succeeded but user data is missing']);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      
      if (error.response && error.response.data && error.response.data.errors) {
        console.error('Server validation errors:', error.response.data.errors);
        setErrors(error.response.data.errors);
      } else if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
        setErrors([`Server error (${error.response.status}): ${error.response.data.error || 'Unknown error'}`]);
      } else if (error.request) {
        console.error('Error request - no response received:', error.request);
        setErrors(['No response from server. Please check your connection.']);
      } else {
        console.error('Unexpected error:', error.message);
        setErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Use the current domain for production or localhost for development
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin  // Use the current domain in production
      : 'http://localhost:5000'; // Use localhost in development
    const googleAuthUrl = `${backendUrl}/auth/google`;
    console.log('Redirecting to Google login:', googleAuthUrl);
    window.location.href = googleAuthUrl;
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors([]);
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-card">
        <div className="login-header">
          <h1>Rank Tracker</h1>
          <p>Track your website rankings across search engines and monitor your SEO performance in real-time</p>
        </div>
        
        <div className="login-content">
          <div className="login-form-wrapper">
            <div className="login-tabs">
              <button 
                className={`login-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
              <button 
                className={`login-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => setMode('register')}
              >
                Register
              </button>
            </div>
            
            {errors.length > 0 && (
              <div className="login-errors">
                {errors.map((error, index) => (
                  <div key={index} className="login-error">{error}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    required={mode === 'register'}
                  />
                </div>
              )}

              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="username">Username (optional)</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Username"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                />
              </div>

              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm Password"
                    required={mode === 'register'}
                  />
                </div>
              )}

              <button 
                type="submit" 
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="login-divider">
              <span>OR</span>
            </div>
            
            <button 
              type="button" 
              onClick={handleGoogleLogin} 
              className="google-login-btn"
            >
              <div className="google-icon">
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              </div>
              <span>Sign in with Google</span>
            </button>
            
            <div className="login-footer">
              <p>
                {mode === 'login' 
                  ? "Don't have an account? " 
                  : "Already have an account? "}
                <button 
                  type="button"
                  className="login-toggle-btn"
                  onClick={toggleMode}
                >
                  {mode === 'login' ? 'Register' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login; 