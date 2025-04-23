import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './DomainList.css';

function DomainList() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/domains');
      setDomains(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch domains. Please try again.');
      console.error('Error fetching domains:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDomain = async (id) => {
    if (window.confirm('Are you sure you want to delete this domain? This will also delete all associated keywords.')) {
      try {
        await axios.delete(`/api/domains/${id}`);
        fetchDomains();
      } catch (err) {
        setError('Failed to delete domain. Please try again.');
        console.error('Error deleting domain:', err);
      }
    }
  };

  return (
    <div className="domain-list-container">
      <div className="domain-list-header">
        <h2>Your Domains</h2>
        <Link to="/domains/new" className="add-domain-btn">
          Add Domain
        </Link>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading-spinner"></div>
      ) : domains.length === 0 ? (
        <div className="no-domains">
          <p>You haven't added any domains yet.</p>
          <Link to="/domains/new" className="add-first-domain-btn">
            Add Your First Domain
          </Link>
        </div>
      ) : (
        <div className="domains-grid">
          {domains.map(domain => (
            <div key={domain._id} className="domain-card">
              <div className="domain-name">{domain.name}</div>
              <div className="domain-url">{domain.url}</div>
              <div className="domain-actions">
                <Link to={`/domains/${domain._id}/keywords`} className="view-keywords-btn">
                  View Keywords
                </Link>
                <div className="domain-card-buttons">
                  <Link to={`/domains/edit/${domain._id}`} className="edit-domain-btn">
                    Edit
                  </Link>
                  <button 
                    onClick={() => handleDeleteDomain(domain._id)}
                    className="delete-domain-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DomainList; 