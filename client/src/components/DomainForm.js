import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './DomainForm.css';

function DomainForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    url: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEditMode = !!id;

  const fetchDomain = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/domains/${id}`);
      setFormData({
        name: response.data.name,
        url: response.data.url
      });
      setError(null);
    } catch (err) {
      setError('Failed to fetch domain details. Please try again.');
      console.error('Error fetching domain:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditMode) {
      fetchDomain();
    }
  }, [isEditMode, fetchDomain]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode) {
        await axios.put(`/api/domains/${id}`, formData);
      } else {
        await axios.post('/api/domains', formData);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
      console.error('Error saving domain:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="domain-form-container">
      <div className="domain-form-header">
        <h2>{isEditMode ? 'Edit Domain' : 'Add Domain'}</h2>
        <Link to="/" className="back-btn">
          Back to Domains
        </Link>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && !isEditMode ? (
        <div className="loading-spinner"></div>
      ) : (
        <form onSubmit={handleSubmit} className="domain-form">
          <div className="form-group">
            <label htmlFor="name">Domain Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter a name for this domain (e.g., My Website)"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="url">Domain URL</label>
            <input
              type="text"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              placeholder="Enter domain URL (e.g., example.com)"
              required
            />
            <small className="form-help">
              Enter only the domain (e.g., example.com) without http:// or www.
            </small>
          </div>

          <div className="form-actions">
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Domain'}
            </button>
            <Link to="/" className="cancel-btn">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default DomainForm; 