import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';

function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useUser();

  // Show loading state while checking authentication
  if (isLoading && !user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated or we have a user (from localStorage), render the child routes
  return <Outlet />;
}

export default ProtectedRoute; 