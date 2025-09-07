import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import './KeywordList.css';

function KeywordList() {
  const { domainId } = useParams();
  const [domain, setDomain] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedKeywords, setCheckedKeywords] = useState({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  useEffect(() => {
    fetchDomainAndKeywords();
  }, [domainId]);

  const fetchDomainAndKeywords = async () => {
    try {
      setLoading(true);
      
      // Fetch domain details
      const domainResponse = await axios.get(`/api/domains/${domainId}`);
      setDomain(domainResponse.data);
      
      // Fetch keywords for domain
      const keywordsResponse = await axios.get(`/api/domains/${domainId}/keywords`);
      setKeywords(keywordsResponse.data);
      
      // Extract unique groups
      const uniqueGroups = ['All', ...new Set(keywordsResponse.data.map(kw => kw.group))];
      setGroups(uniqueGroups);
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKeyword = async (id) => {
    if (window.confirm('Are you sure you want to delete this keyword?')) {
      try {
        await axios.delete(`/api/keywords/${id}`);
        fetchDomainAndKeywords();
      } catch (err) {
        setError('Failed to delete keyword. Please try again.');
        console.error('Error deleting keyword:', err);
      }
    }
  };

  const handleCheckRanking = async (id) => {
    try {
      setCheckedKeywords(prev => ({ ...prev, [id]: true }));
      const response = await axios.post(`/api/keywords/${id}/check-ranking`);
      
      // Update keyword in the list
      setKeywords(prevKeywords => 
        prevKeywords.map(kw => 
          kw._id === id 
            ? { 
                ...kw, 
                currentRank: response.data.rank, 
                lastChecked: response.data.lastChecked,
                rankingHistory: response.data.history
              } 
            : kw
        )
      );
    } catch (err) {
      console.error('Error checking ranking:', err);
    } finally {
      setCheckedKeywords(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCheckAllRankings = async () => {
    try {
      setCheckingAll(true);
      
      // Filter keywords by selected group if not "All"
      const keywordsToCheck = selectedGroup === 'All' 
        ? keywords 
        : keywords.filter(kw => kw.group === selectedGroup);
        
      for (const keyword of keywordsToCheck) {
        setCheckedKeywords(prev => ({ ...prev, [keyword._id]: true }));
        try {
          const response = await axios.post(`/api/keywords/${keyword._id}/check-ranking`);
          
          // Update single keyword in the state
          setKeywords(prevKeywords => 
            prevKeywords.map(kw => 
              kw._id === keyword._id 
                ? { 
                    ...kw, 
                    currentRank: response.data.rank, 
                    lastChecked: response.data.lastChecked,
                    rankingHistory: response.data.history
                  } 
                : kw
            )
          );
        } catch (err) {
          console.error(`Error checking ranking for ${keyword.keyword}:`, err);
        } finally {
          setCheckedKeywords(prev => ({ ...prev, [keyword._id]: false }));
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      setError('Error checking rankings. Please try again.');
      console.error('Error in check all rankings:', err);
    } finally {
      setCheckingAll(false);
    }
  };

  const getRankChangeIndicator = (keyword) => {
    if (!keyword.rankingHistory || keyword.rankingHistory.length < 2) {
      return null;
    }
    
    const current = keyword.rankingHistory[keyword.rankingHistory.length - 1];
    const previous = keyword.rankingHistory[keyword.rankingHistory.length - 2];
    
    // If either is "Not found in top 100", handle specially
    if (current.position === 'Not found in top 100' && previous.position === 'Not found in top 100') {
      return null;
    }
    
    if (current.position === 'Not found in top 100') {
      return <span className="rank-down">↓</span>;
    }
    
    if (previous.position === 'Not found in top 100') {
      return <span className="rank-up">↑</span>;
    }
    
    // Convert to numbers for comparison
    const currentPos = parseInt(current.position);
    const previousPos = parseInt(previous.position);
    
    if (isNaN(currentPos) || isNaN(previousPos)) {
      return null;
    }
    
    if (currentPos < previousPos) {
      return <span className="rank-up">↑</span>;
    } else if (currentPos > previousPos) {
      return <span className="rank-down">↓</span>;
    } else {
      return <span className="rank-same">→</span>;
    }
  };

  const handleExportCSV = async (includeHistory = false) => {
    try {
      const url = `/api/domains/${domainId}/export?history=${includeHistory ? 'true' : 'false'}`;
      
      // Use axios to get the file as a blob
      const response = await axios.get(url, {
        responseType: 'blob'
      });
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'keywords-export.csv';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError('Failed to download export. Please try again.');
    }
    
    setShowExportOptions(false);
  };

  const handleExportExcel = async (includeHistory = false) => {
    try {
      const url = `/api/domains/${domainId}/export?history=${includeHistory ? 'true' : 'false'}&format=excel`;
      
      // Use axios to get the file as a blob
      const response = await axios.get(url, {
        responseType: 'blob'
      });
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'keywords-export.xls';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Error downloading Excel:', err);
      setError('Failed to download export. Please try again.');
    }
    
    setShowExportOptions(false);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedKeywords = (keywordsToSort) => {
    if (!sortConfig.key) return keywordsToSort;

    return [...keywordsToSort].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'keyword':
          aValue = a.keyword.toLowerCase();
          bValue = b.keyword.toLowerCase();
          break;
        case 'group':
          aValue = (a.group || 'Default').toLowerCase();
          bValue = (b.group || 'Default').toLowerCase();
          break;
        case 'currentRank':
          if (a.currentRank === 'Not found in top 100' || !a.currentRank) {
            aValue = 999;
          } else if (a.currentRank === 'Not checked yet') {
            aValue = 1000;
          } else {
            aValue = parseInt(a.currentRank);
          }
          
          if (b.currentRank === 'Not found in top 100' || !b.currentRank) {
            bValue = 999;
          } else if (b.currentRank === 'Not checked yet') {
            bValue = 1000;
          } else {
            bValue = parseInt(b.currentRank);
          }
          break;
        case 'lastChecked':
          aValue = a.lastChecked ? new Date(a.lastChecked) : new Date(0);
          bValue = b.lastChecked ? new Date(b.lastChecked) : new Date(0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const filteredKeywords = selectedGroup === 'All' 
    ? keywords 
    : keywords.filter(kw => kw.group === selectedGroup);

  const sortedAndFilteredKeywords = getSortedKeywords(filteredKeywords);

  return (
    <div className="keyword-list-container">
      {loading ? (
        <div className="loading-spinner"></div>
      ) : (
        <>
          <div className="keyword-list-header">
            <div className="keyword-domain-info">
              <h2>Keywords for {domain?.name}</h2>
              <div className="domain-url">{domain?.url}</div>
            </div>
            <div className="keyword-actions">
              <Link to={`/domains/${domainId}/keywords/new`} className="add-keyword-btn">
                Add Keyword
              </Link>
              <button 
                onClick={handleCheckAllRankings} 
                className="check-all-btn"
                disabled={checkingAll || keywords.length === 0}
              >
                {checkingAll ? 'Checking...' : 'Check All Rankings'}
              </button>
              <div className="export-dropdown">
                <button
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className="export-btn"
                  disabled={keywords.length === 0}
                >
                  Export
                </button>
                {showExportOptions && (
                  <div className="export-options">
                    <button onClick={() => handleExportCSV(false)}>
                      CSV Export
                    </button>
                    <button onClick={() => handleExportCSV(true)}>
                      CSV with History
                    </button>
                    <button onClick={() => handleExportExcel(false)}>
                      Excel Export
                    </button>
                    <button onClick={() => handleExportExcel(true)}>
                      Excel with History
                    </button>
                  </div>
                )}
              </div>
              <Link to="/" className="back-btn">
                Back to Domains
              </Link>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          {keywords.length === 0 ? (
            <div className="no-keywords">
              <p>You haven't added any keywords for this domain yet.</p>
              <Link to={`/domains/${domainId}/keywords/new`} className="add-first-keyword-btn">
                Add Your First Keyword
              </Link>
            </div>
          ) : (
            <>
              <div className="keyword-filter">
                <label htmlFor="group-filter">Filter by Group:</label>
                <select 
                  id="group-filter" 
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  {groups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
              
              <div className="keywords-table-container">
                <table className="keywords-table">
                  <thead>
                    <tr>
                      <th 
                        onClick={() => handleSort('keyword')} 
                        className={`sortable ${sortConfig.key === 'keyword' ? `sorted-${sortConfig.direction}` : ''}`}
                      >
                        Keyword {sortConfig.key === 'keyword' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('group')} 
                        className={`sortable ${sortConfig.key === 'group' ? `sorted-${sortConfig.direction}` : ''}`}
                      >
                        Group {sortConfig.key === 'group' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('currentRank')} 
                        className={`sortable ${sortConfig.key === 'currentRank' ? `sorted-${sortConfig.direction}` : ''}`}
                      >
                        Current Rank {sortConfig.key === 'currentRank' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('lastChecked')} 
                        className={`sortable ${sortConfig.key === 'lastChecked' ? `sorted-${sortConfig.direction}` : ''}`}
                      >
                        Last Checked {sortConfig.key === 'lastChecked' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredKeywords.map(keyword => (
                      <tr key={keyword._id}>
                        <td data-label="Keyword">{keyword.keyword}</td>
                        <td data-label="Group">{keyword.group || 'Default'}</td>
                        <td data-label="Current Rank">
                          <span className={`rank-value ${keyword.currentRank === 'Not found in top 100' ? 'not-found' : ''}`}>
                            {keyword.currentRank || 'Not checked yet'}
                          </span>
                          {getRankChangeIndicator(keyword)}
                        </td>
                        <td data-label="Last Checked">
                          {keyword.lastChecked 
                            ? new Date(keyword.lastChecked).toLocaleString() 
                            : 'Not checked yet'}
                        </td>
                        <td data-label="Actions">
                          <div className="keyword-row-actions">
                            <button 
                              onClick={() => handleCheckRanking(keyword._id)} 
                              className="check-rank-btn"
                              disabled={checkedKeywords[keyword._id]}
                              title="Check Ranking"
                            >
                              {checkedKeywords[keyword._id] ? '...' : '↻'}
                            </button>
                            <Link 
                              to={`/keywords/edit/${keyword._id}`} 
                              className="edit-keyword-btn"
                              title="Edit"
                            >
                              ✎
                            </Link>
                            <button 
                              onClick={() => handleDeleteKeyword(keyword._id)}
                              className="delete-keyword-btn"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default KeywordList; 