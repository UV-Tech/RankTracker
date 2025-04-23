# Rank Tracker

A web application to track keyword rankings for your domains.

## Features

- User authentication with Google login
- Multiple domain management
- Track keywords and their rankings
- Export keyword data as CSV or Excel
- Historical tracking of keyword positions

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Google API Key (for search functionality)
- Google OAuth credentials (for authentication)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ranktracker
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# Google OAuth settings
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_session_secret
```

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add "http://localhost:5000/auth/google/callback" to the authorized redirect URIs
7. Copy the Client ID and Client Secret to your `.env` file

### Setting up Google Custom Search API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the "Custom Search API"
3. Create an API key and add it to your `.env` file
4. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/create/new)
5. Create a new search engine
6. Copy the Search Engine ID and add it to your `.env` file

### Installation

1. Install server dependencies:
   ```
   npm install
   ```

2. Install client dependencies:
   ```
   cd client
   npm install
   ```

3. Start MongoDB:
   ```
   mongod --dbpath /path/to/data/directory
   ```

4. Start the server:
   ```
   npm start
   ```

5. Start the client:
   ```
   cd client
   npm start
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Sign in with your Google account
2. Add domains you want to track
3. Add keywords for each domain
4. Check rankings for individual keywords or all keywords at once
5. Export data as needed for reporting

## API Endpoints

- POST `/api/check-rankings`
  - Request body:
    ```json
    {
      "domain": "example.com",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
    ```
  - Returns an array of ranking results

## Technologies Used

- Frontend: React
- Backend: Node.js + Express
- Database: MongoDB (optional)
- API: SerpApi
- Styling: CSS3

## License

MIT 