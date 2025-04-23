import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from 'axios';

// Configure Axios to send credentials with requests
axios.defaults.withCredentials = true;

// During development, React runs on port 3000 and the API on port 5000
const API_URL = process.env.NODE_ENV === 'production' 
  ? '' // In production we'll use relative URLs
  : 'http://localhost:5000';

// Set the base URL to make sure all requests go to the right server
axios.defaults.baseURL = API_URL;

// Log when axios is configured
console.log('Axios configured with baseURL:', axios.defaults.baseURL);
console.log('Axios withCredentials:', axios.defaults.withCredentials);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

reportWebVitals(); 