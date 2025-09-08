import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './KeywordForm.css';

function KeywordForm() {
  const { id, domainId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    keyword: '',
    group: 'Default'
  });
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode) {
      fetchKeyword();
    } else if (domainId) {
      fetchDomain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, domainId]);

  const fetchKeyword = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/keywords/${id}`);
      setFormData({
        keyword: response.data.keyword,
        group: response.data.group
      });
      
      // Fetch domain for the breadcrumb navigation
      const domainResponse = await axios.get(`/api/domains/${response.data.domain}`);
      setDomain(domainResponse.data);
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch keyword. Please try again.');
      console.error('Error fetching keyword:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomain = async () => {
    try {
      const response = await axios.get(`/api/domains/${domainId}`);
      setDomain(response.data);
    } catch (err) {
      console.error('Error fetching domain:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleBulkChange = (e) => {
    setBulkKeywords(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode) {
        await axios.put(`/api/keywords/${id}`, formData);
        navigate(`/domains/${domain._id}/keywords`);
      } else if (isBulkMode) {
        // Process bulk keywords
        const keywordList = bulkKeywords
          .split('\n')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        
        if (keywordList.length === 0) {
          setError('Please enter at least one keyword');
          setLoading(false);
          return;
        }

        // Create endpoint for bulk import if doesn't exist
        await axios.post(`/api/domains/${domainId}/keywords/bulk`, {
          keywords: keywordList,
          group: formData.group
        });
        
        navigate(`/domains/${domainId}/keywords`);
      } else {
        await axios.post(`/api/domains/${domainId}/keywords`, formData);
        navigate(`/domains/${domainId}/keywords`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
      console.error('Error saving keyword:', err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="keyword-form-container">
      <div className="keyword-form-header">
        <h2>{isEditMode ? 'Edit Keyword' : 'Add Keyword'}</h2>
        <Link to={isEditMode && domain ? `/domains/${domain._id}/keywords` : domainId ? `/domains/${domainId}/keywords` : '/'} className="back-btn">
          Back to Keywords
        </Link>
      </div>

      {domain && (
        <div className="domain-context">
          <span className="domain-label">Domain:</span>
          <span className="domain-name">{domain.name}</span>
          <span className="domain-url">({domain.url})</span>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {!isEditMode && (
        <div className="mode-toggle">
          <button 
            type="button" 
            className={`mode-btn ${!isBulkMode ? 'active' : ''}`}
            onClick={() => setIsBulkMode(false)}
          >
            Single Keyword
          </button>
          <button 
            type="button" 
            className={`mode-btn ${isBulkMode ? 'active' : ''}`}
            onClick={() => setIsBulkMode(true)}
          >
            Bulk Import
          </button>
        </div>
      )}

      {loading && !isEditMode ? (
        <div className="loading-spinner"></div>
      ) : (
        <form onSubmit={handleSubmit} className="keyword-form">
          
          {!isEditMode && isBulkMode ? (
            <div className="form-group">
              <label htmlFor="bulkKeywords">Enter Keywords (one per line)</label>
              <textarea
                id="bulkKeywords"
                name="bulkKeywords"
                value={bulkKeywords}
                onChange={handleBulkChange}
                placeholder="Enter each keyword on a new line:&#10;keyword 1&#10;keyword 2&#10;keyword 3"
                rows={10}
                required
              />
              <small className="form-help">
                Enter one keyword per line. All keywords will be added to the same group.
              </small>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="keyword">Keyword</label>
              <input
                type="text"
                id="keyword"
                name="keyword"
                value={formData.keyword}
                onChange={handleChange}
                placeholder="Enter keyword to track (e.g., best coffee beans)"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="group">Group</label>
            <input
              type="text"
              id="group"
              name="group"
              value={formData.group}
              onChange={handleChange}
              placeholder="Enter group name (e.g., Products, Services)"
            />
            <small className="form-help">
              Group helps you organize keywords. Leave as "Default" or enter a custom group.
            </small>
          </div>

          <div className="form-actions">
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : isBulkMode ? 'Import Keywords' : 'Save Keyword'}
            </button>
            <Link 
              to={isEditMode && domain ? `/domains/${domain._id}/keywords` : domainId ? `/domains/${domainId}/keywords` : '/'} 
              className="cancel-btn"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default KeywordForm; 