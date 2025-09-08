const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Ultra simple test - just serve some basic responses
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>RankTracker</title></head>
            <body>
                <h1>🎉 RankTracker is Live!</h1>
                <p>Server is running properly on Vercel</p>
                <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
                <p>Time: ${new Date().toISOString()}</p>
                <a href="/api/test">Test API endpoint</a>
            </body>
        </html>
    `);
});

app.get('/api/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;