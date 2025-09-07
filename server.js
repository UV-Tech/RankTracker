const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo');
const validator = require('validator');
const { body, validationResult } = require('express-validator');
const { getGoogleRank } = require('./services/searchService');

// Import models
const Domain = require('./models/Domain');
const Keyword = require('./models/Keyword');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');

// Import authentication middleware
const { ensureAuth } = require('./middleware/auth');

// Initialize passport config
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// Health check endpoint (before all middleware)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        hasMongoUri: !!process.env.MONGODB_URI
    });
});

// Environment validation
if (!process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: SESSION_SECRET is not defined.');
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined.');
    process.exit(1);
}

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Stricter rate limiting for API routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 API requests per windowMs
    message: 'Too many API requests from this IP, please try again later.',
});

// Apply API rate limiting to all routes starting with /api, /auth, /keywords, /domains
app.use('/api', apiLimiter);
app.use('/auth', apiLimiter);
app.use('/keywords', apiLimiter);
app.use('/domains', apiLimiter);

// Input validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // React app URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400 // 24 hours in seconds
}));
app.use(express.json());
app.use(cookieParser());

// Session middleware with secure store
app.use(session({
    secret: process.env.SESSION_SECRET, // Remove fallback for security
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600, // lazy session update
        crypto: {
            secret: process.env.SESSION_SECRET
        }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/'
    }
}));

// Debug middleware to log session data
app.use((req, res, next) => {
    console.log('Session debug:', { 
        sessionID: req.sessionID,
        hasSession: !!req.session,
        isAuthenticated: req.isAuthenticated?.() || false,
        user: req.user ? `User: ${req.user._id}` : 'No user'
    });
    next();
});

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Log environment variables on startup (without exposing sensitive data)
console.log('Environment check:', {
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? 'Set' : 'Not set',
    GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID ? 'Set' : 'Not set',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
});

// MongoDB Connection
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
        .then(() => console.log('MongoDB Connected'))
        .catch(err => console.log('MongoDB Connection Error:', err));
} else {
    console.warn('MONGODB_URI not set. Database features will not work.');
}

// Routes
app.use('/auth', authRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'RankTracker API is running' });
});

// DOMAIN ROUTES
// Get all domains for the current user
app.get('/api/domains', ensureAuth, async (req, res) => {
    try {
        const domains = await Domain.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(domains);
    } catch (error) {
        console.error('Error fetching domains:', error);
        res.status(500).json({ error: 'Failed to fetch domains' });
    }
});

// Get single domain
app.get('/api/domains/:id', ensureAuth, async (req, res) => {
    try {
        const domain = await Domain.findOne({ _id: req.params.id, user: req.user._id });
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        res.json(domain);
    } catch (error) {
        console.error('Error fetching domain:', error);
        res.status(500).json({ error: 'Failed to fetch domain' });
    }
});

// Create domain
app.post('/api/domains', 
    ensureAuth,
    [
        body('name')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Domain name must be between 1 and 100 characters')
            .matches(/^[a-zA-Z0-9\s\-_.]+$/)
            .withMessage('Domain name contains invalid characters'),
        body('url')
            .trim()
            .isLength({ min: 1, max: 255 })
            .withMessage('URL must be between 1 and 255 characters')
            .custom((value) => {
                // Normalize URL for validation
                const normalized = value.toLowerCase()
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .trim();
                
                // Validate domain format
                if (!validator.isFQDN(normalized) && !validator.isIP(normalized)) {
                    throw new Error('Invalid domain format');
                }
                return true;
            })
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { name, url } = req.body;
            
            const normalizedUrl = url.toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .trim();
                
            // Check if domain already exists for this user
            const existingDomain = await Domain.findOne({ 
                url: normalizedUrl, 
                user: req.user._id 
            });
            
            if (existingDomain) {
                return res.status(400).json({ error: 'Domain already exists' });
            }
                
            const domain = new Domain({
                name: validator.escape(name), // Sanitize input
                url: normalizedUrl,
                user: req.user._id
            });
            
            await domain.save();
            res.status(201).json(domain);
        } catch (error) {
            console.error('Error creating domain:', error);
            res.status(500).json({ error: 'Failed to create domain' });
        }
    }
);

// Update domain
app.put('/api/domains/:id', ensureAuth, async (req, res) => {
    try {
        const { name, url } = req.body;
        
        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }
        
        const normalizedUrl = url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .trim();
            
        const domain = await Domain.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id }, 
            { 
                name, 
                url: normalizedUrl,
                updatedAt: Date.now()
            },
            { new: true }
        );
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        res.json(domain);
    } catch (error) {
        console.error('Error updating domain:', error);
        res.status(500).json({ error: 'Failed to update domain' });
    }
});

// Delete domain
app.delete('/api/domains/:id', ensureAuth, async (req, res) => {
    try {
        const domain = await Domain.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        // Delete all keywords associated with this domain
        await Keyword.deleteMany({ domain: req.params.id });
        
        res.json({ message: 'Domain deleted successfully' });
    } catch (error) {
        console.error('Error deleting domain:', error);
        res.status(500).json({ error: 'Failed to delete domain' });
    }
});

// KEYWORD ROUTES
// Get all keywords for a domain
app.get('/api/domains/:domainId/keywords', ensureAuth, async (req, res) => {
    try {
        // Find domain and ensure it belongs to the current user
        const domain = await Domain.findOne({ 
            _id: req.params.domainId,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        const keywords = await Keyword.find({ domain: req.params.domainId }).sort({ group: 1, keyword: 1 });
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: 'Failed to fetch keywords' });
    }
});

// Get a single keyword
app.get('/api/keywords/:id', ensureAuth, async (req, res) => {
    try {
        const keyword = await Keyword.findById(req.params.id);
        
        if (!keyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        
        // Get domain and check if it belongs to current user
        const domain = await Domain.findOne({
            _id: keyword.domain,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(keyword);
    } catch (error) {
        console.error('Error fetching keyword:', error);
        res.status(500).json({ error: 'Failed to fetch keyword' });
    }
});

// Create keyword
app.post('/api/domains/:domainId/keywords', ensureAuth, async (req, res) => {
    try {
        const { keyword, group } = req.body;
        
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }
        
        // Check if domain exists and belongs to current user
        const domain = await Domain.findOne({
            _id: req.params.domainId,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        // Check if keyword already exists for this domain
        const existingKeyword = await Keyword.findOne({ 
            domain: req.params.domainId,
            keyword: keyword.trim()
        });
        
        if (existingKeyword) {
            return res.status(400).json({ error: 'Keyword already exists for this domain' });
        }
        
        const newKeyword = new Keyword({
            keyword: keyword.trim(),
            domain: req.params.domainId,
            group: group || 'Default'
        });
        
        await newKeyword.save();
        res.status(201).json(newKeyword);
    } catch (error) {
        console.error('Error creating keyword:', error);
        res.status(500).json({ error: 'Failed to create keyword' });
    }
});

// Bulk import keywords
app.post('/api/domains/:domainId/keywords/bulk', ensureAuth, async (req, res) => {
    try {
        const { keywords, group } = req.body;
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ error: 'Keywords array is required' });
        }
        
        // Check if domain exists and belongs to the current user
        const domain = await Domain.findOne({
            _id: req.params.domainId,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        // Get existing keywords for this domain to avoid duplicates
        const existingKeywords = await Keyword.find({ domain: req.params.domainId });
        const existingKeywordTexts = existingKeywords.map(k => k.keyword.toLowerCase());
        
        // Filter out duplicates
        const uniqueKeywords = keywords.filter(
            k => !existingKeywordTexts.includes(k.toLowerCase())
        );
        
        if (uniqueKeywords.length === 0) {
            return res.status(400).json({ error: 'All keywords already exist for this domain' });
        }
        
        // Create keyword documents
        const keywordDocs = uniqueKeywords.map(keyword => ({
            keyword: keyword.trim(),
            domain: req.params.domainId,
            group: group || 'Default'
        }));
        
        // Insert all keywords at once
        const result = await Keyword.insertMany(keywordDocs);
        
        res.status(201).json({
            message: `Successfully added ${result.length} keywords`,
            added: result.length,
            total: keywords.length,
            duplicates: keywords.length - result.length
        });
    } catch (error) {
        console.error('Error importing keywords:', error);
        res.status(500).json({ error: 'Failed to import keywords' });
    }
});

// Update keyword
app.put('/api/keywords/:id', ensureAuth, async (req, res) => {
    try {
        const { keyword, group } = req.body;
        
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }
        
        // Find the keyword
        const existingKeyword = await Keyword.findById(req.params.id);
        
        if (!existingKeyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        
        // Check if domain belongs to current user
        const domain = await Domain.findOne({ 
            _id: existingKeyword.domain,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const updatedKeyword = await Keyword.findByIdAndUpdate(
            req.params.id,
            {
                keyword: keyword.trim(),
                group: group || 'Default',
                updatedAt: Date.now()
            },
            { new: true }
        );
        
        if (!updatedKeyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        
        res.json(updatedKeyword);
    } catch (error) {
        console.error('Error updating keyword:', error);
        res.status(500).json({ error: 'Failed to update keyword' });
    }
});

// Delete keyword
app.delete('/api/keywords/:id', ensureAuth, async (req, res) => {
    try {
        // Find the keyword first to get the domain
        const keyword = await Keyword.findById(req.params.id);
        
        if (!keyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        
        // Check if domain belongs to current user
        const domain = await Domain.findOne({ 
            _id: keyword.domain,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Now delete the keyword
        await Keyword.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Keyword deleted successfully' });
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).json({ error: 'Failed to delete keyword' });
    }
});

// Check ranking for a keyword
app.post('/api/keywords/:id/check-ranking', ensureAuth, async (req, res) => {
    try {
        const keyword = await Keyword.findById(req.params.id).populate('domain');
        
        if (!keyword) {
            return res.status(404).json({ error: 'Keyword not found' });
        }
        
        // Get domain and check if it belongs to current user
        const domain = await Domain.findOne({
            _id: keyword.domain._id,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!process.env.GOOGLE_API_KEY) {
            console.error('GOOGLE_API_KEY is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: GOOGLE_API_KEY is missing' });
        }
        
        if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.error('GOOGLE_SEARCH_ENGINE_ID is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: GOOGLE_SEARCH_ENGINE_ID is missing' });
        }
        
        console.log(`Checking ranking for domain: ${domain.url}, keyword: ${keyword.keyword}`);
        
        try {
            const rank = await getGoogleRank(domain.url, keyword.keyword);
            console.log(`Rank for ${keyword.keyword}: ${rank}`);
            
            // Update the keyword with new ranking information
            keyword.currentRank = rank;
            keyword.lastChecked = new Date();
            
            // Add to ranking history
            keyword.rankingHistory.push({
                position: rank,
                checkedAt: new Date()
            });
            
            // Limit history to last 30 entries
            if (keyword.rankingHistory.length > 30) {
                keyword.rankingHistory = keyword.rankingHistory.slice(-30);
            }
            
            await keyword.save();
            
            res.json({
                keyword: keyword.keyword,
                rank: rank,
                lastChecked: keyword.lastChecked,
                history: keyword.rankingHistory
            });
        } catch (error) {
            console.error(`Error checking rank for keyword ${keyword.keyword}:`, {
                message: error.message,
                stack: error.stack
            });
            
            res.status(500).json({
                keyword: keyword.keyword,
                error: error.message,
                details: error.response?.data?.error || error.stack
            });
        }
    } catch (error) {
        console.error('Error in check-ranking route:', error);
        res.status(500).json({ error: 'Failed to check ranking' });
    }
});

// Original check-rankings route (keeping for backward compatibility)
app.post('/api/check-rankings', ensureAuth, async (req, res) => {
    try {
        const { domain, keywords } = req.body;
        console.log('Received request:', { domain, keywords });

        if (!domain || !keywords || !Array.isArray(keywords)) {
            console.log('Invalid input received');
            return res.status(400).json({ error: 'Invalid input. Please provide domain and keywords array.' });
        }

        // Validate if domain belongs to user
        const domainDoc = await Domain.findOne({ 
            _id: domain, 
            user: req.user._id 
        });
        
        if (!domainDoc) {
            return res.status(403).json({ error: 'Access denied or domain not found' });
        }

        if (!process.env.GOOGLE_API_KEY) {
            console.error('GOOGLE_API_KEY is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: GOOGLE_API_KEY is missing' });
        }

        if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.error('GOOGLE_SEARCH_ENGINE_ID is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: GOOGLE_SEARCH_ENGINE_ID is missing' });
        }

        console.log('Starting to check rankings for keywords:', keywords);
        const results = await Promise.all(
            keywords.map(async (keyword) => {
                try {
                    console.log(`Checking rank for keyword: ${keyword}`);
                    const rank = await getGoogleRank(domainDoc.url, keyword);
                    console.log(`Rank for ${keyword}: ${rank}`);
                return {
                    keyword,
                    rank,
                    timestamp: new Date()
                };
                } catch (error) {
                    console.error(`Error checking rank for keyword ${keyword}:`, {
                        message: error.message,
                        stack: error.stack,
                        response: error.response?.data
                    });
                    return {
                        keyword,
                        rank: 'Error',
                        error: error.message,
                        details: error.response?.data?.error || error.stack,
                        timestamp: new Date()
                    };
                }
            })
        );

        // Check if any results had errors
        const hasErrors = results.some(result => result.error);
        if (hasErrors) {
            console.log('Some keywords had errors:', results);
            return res.status(207).json({
                message: 'Some rankings could not be checked',
                results
            });
        }

        console.log('Successfully retrieved all rankings');
        res.json(results);
    } catch (error) {
        console.error('Detailed error in check-rankings:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(500).json({ 
            error: 'Failed to check rankings. Please try again later.',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Export domain keywords as CSV or Excel
app.get('/api/domains/:domainId/export', ensureAuth, async (req, res) => {
    try {
        // Check if domain belongs to current user
        const domain = await Domain.findOne({ 
            _id: req.params.domainId,
            user: req.user._id
        });
        
        if (!domain) {
            return res.status(404).json({ error: 'Domain not found' });
        }
        
        const keywords = await Keyword.find({ domain: req.params.domainId });
        if (!keywords.length) {
            return res.status(404).json({ error: 'No keywords found for this domain' });
        }
        
        // Check if history is requested
        const includeHistory = req.query.history === 'true';
        // Check requested format (default to csv)
        const format = req.query.format?.toLowerCase() || 'csv';

        // For Excel format, we need to create an HTML table that Excel can open
        if (format === 'excel' || format === 'xlsx') {
            // Create HTML table with Excel-compatible formatting
            let html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                    <!--[if gte mso 9]>
                    <xml>
                        <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                                <x:ExcelWorksheet>
                                    <x:Name>${domain.name} Keywords</x:Name>
                                    <x:WorksheetOptions>
                                        <x:DisplayGridlines/>
                                    </x:WorksheetOptions>
                                </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                        </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->
                </head>
                <body>
                    <table border="1">
                        <thead>
                            <tr>
                                <th>Keyword</th>
                                <th>Current Rank</th>
                                <th>Group</th>
                                <th>Last Checked</th>`;
            
            // Add history headers if requested
            if (includeHistory) {
                // Find the keyword with most history entries
                const maxHistoryLength = Math.max(...keywords.map(kw => 
                    kw.rankingHistory && kw.rankingHistory.length ? kw.rankingHistory.length : 0
                ));
                
                for (let i = 0; i < maxHistoryLength; i++) {
                    html += `
                                <th>History ${i+1} Position</th>
                                <th>History ${i+1} Date</th>`;
                }
            }
            
            html += `
                            </tr>
                        </thead>
                        <tbody>`;
            
            // Add data rows
            keywords.forEach(kw => {
                const lastChecked = kw.lastChecked ? new Date(kw.lastChecked).toLocaleString() : 'Never';
                html += `
                            <tr>
                                <td>${kw.keyword}</td>
                                <td>${kw.currentRank || 'Not checked'}</td>
                                <td>${kw.group}</td>
                                <td>${lastChecked}</td>`;
                
                // Add history data if requested
                if (includeHistory && kw.rankingHistory && kw.rankingHistory.length) {
                    kw.rankingHistory.forEach(history => {
                        const historyDate = new Date(history.checkedAt).toLocaleString();
                        html += `
                                <td>${history.position}</td>
                                <td>${historyDate}</td>`;
                    });
                }
                
                html += `
                            </tr>`;
            });
            
            html += `
                        </tbody>
                    </table>
                </body>
                </html>`;
            
            // Set headers for Excel download
            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader('Content-Disposition', `attachment; filename="${domain.name}-keywords.xls"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // Send the HTML/Excel data
            return res.status(200).send(html);
        } else {
            // Default CSV format
            // Create CSV header
            let csv = 'Keyword,Current Rank,Group,Last Checked';
            
            // Add history headers if requested
            if (includeHistory) {
                // Find the keyword with most history entries
                const maxHistoryLength = Math.max(...keywords.map(kw => 
                    kw.rankingHistory && kw.rankingHistory.length ? kw.rankingHistory.length : 0
                ));
                
                for (let i = 0; i < maxHistoryLength; i++) {
                    csv += `,History ${i+1} Position,History ${i+1} Date`;
                }
            }
            
            csv += '\n';
            
            // Add data rows
            keywords.forEach(kw => {
                const lastChecked = kw.lastChecked ? new Date(kw.lastChecked).toLocaleString() : 'Never';
                let row = `"${kw.keyword}","${kw.currentRank || 'Not checked'}","${kw.group}","${lastChecked}"`;
                
                // Add history data if requested
                if (includeHistory && kw.rankingHistory && kw.rankingHistory.length) {
                    kw.rankingHistory.forEach(history => {
                        const historyDate = new Date(history.checkedAt).toLocaleString();
                        row += `,"${history.position}","${historyDate}"`;
                    });
                }
                
                csv += row + '\n';
            });
            
            // Set headers for CSV download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${domain.name}-keywords.csv"`);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            // Send the CSV data
            return res.status(200).send(csv);
        }
        
    } catch (error) {
        console.error('Error exporting keywords:', error);
        res.status(500).json({ error: 'Failed to export keywords' });
    }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));
    
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 