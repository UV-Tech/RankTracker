import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user data on initial mount
  useEffect(() => {
    // First check if we have a user in localStorage to immediately show content
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        console.log('User loaded from localStorage:', parsedUser.name);
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
      }
    }
    
    // Then fetch latest user data from API
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to fetch current user data
  const fetchUser = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching user data from API...');
      
      // Configure axios to include credentials
      axios.defaults.withCredentials = true;
      
      // Get the user data
      const res = await axios.get('/auth/current-user');
      console.log('User data response:', res.data);
      
      if (res.data && res.data.user) {
        setUser(res.data.user);
        setIsAuthenticated(true);
        console.log('User authenticated from API:', res.data.user.name);
        
        // Store user in localStorage as a fallback
        localStorage.setItem('user', JSON.stringify(res.data.user));
      } else {
        console.log('No user data returned from API');
        
        // Clear user state
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Log more details about the error
      if (error.response) {
        console.error('Error response:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Error request:', error.request);
      }
      
      // If we already have a user in state from localStorage, keep it
      // This prevents flickering during network issues
      if (!user) {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh user data
  const refreshUser = async () => {
    return fetchUser();
  };

  // Function to log out
  const logout = async () => {
    try {
      // Use the POST endpoint instead of GET for more reliable logout
      await axios.post('/auth/logout');
      
      // Clear user state
      setUser(null);
      setIsAuthenticated(false);
      
      // Clear localStorage
      localStorage.removeItem('user');
      
      // Return a promise that resolves after a short delay
      // This allows for a smoother transition
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(true);
        }, 300);
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, still clear the user state
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      throw error;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        refreshUser,
        logout
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext); 