import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import NavBar from './components/NavBar';
import DomainList from './components/DomainList';
import DomainForm from './components/DomainForm';
import KeywordList from './components/KeywordList';
import KeywordForm from './components/KeywordForm';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { UserProvider } from './context/UserContext';
import './components/Loading.css';

function App() {
  return (
    <Router>
      <UserProvider>
        <div className="App">
          <Routes>
            {/* Public routes - no NavBar */}
            <Route path="/login" element={<Login />} />
            
            {/* All routes with NavBar */}
            <Route path="/*" element={
              <>
                <NavBar />
                <div className="container">
                  <Routes>
                    {/* Protected routes */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<DomainList />} />
                      <Route path="/domains/new" element={<DomainForm />} />
                      <Route path="/domains/edit/:id" element={<DomainForm />} />
                      <Route path="/domains/:domainId/keywords" element={<KeywordList />} />
                      <Route path="/domains/:domainId/keywords/new" element={<KeywordForm />} />
                      <Route path="/keywords/edit/:id" element={<KeywordForm />} />
                    </Route>
                    
                    {/* Redirect to home for unknown routes */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </div>
              </>
            } />
          </Routes>
        </div>
      </UserProvider>
    </Router>
  );
}

export default App; 