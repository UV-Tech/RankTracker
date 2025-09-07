const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const { ensureAuth, ensureGuest } = require('../middleware/auth');

// Helper function for validating input
const validateInput = (email, password, name = null) => {
    const errors = [];
    
    // Email validation
    if (!email || !email.includes('@') || email.length < 5) {
        errors.push('Please provide a valid email address');
    }
    
    // Password validation (if registration)
    if (name !== null && (!password || password.length < 6)) {
        errors.push('Password must be at least 6 characters');
    }
    
    // Name validation (if registration)
    if (name !== null && (!name || name.trim().length === 0)) {
        errors.push('Name is required');
    }
    
    return errors;
};

// @route   POST /auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, username } = req.body;
        
        // Validate input
        const errors = validateInput(email, password, name);
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        
        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ 
                errors: ['Email already registered'] 
            });
        }
        
        // Create new user
        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
            username: username || name,
            authType: 'local'
        });
        
        await user.save();
        
        // Log the user in after registration
        req.login(user, (err) => {
            if (err) {
                console.error('Login after registration error:', err);
                return res.status(500).json({ errors: ['Error during login'] });
            }
            return res.json({
                message: 'Registration successful',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            });
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ errors: ['Server error during registration'] });
    }
});

// @route   POST /auth/login
// @desc    Login with email/password
// @access  Public
router.post('/login', (req, res, next) => {
    // Validate input
    const { email, password } = req.body;
    const errors = validateInput(email, password);
    
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }
    
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ errors: ['Server error during login'] });
        }
        
        if (!user) {
            return res.status(401).json({ 
                errors: [info.message || 'Invalid credentials'] 
            });
        }
        
        req.login(user, (err) => {
            if (err) {
                console.error('Login error:', err);
                return res.status(500).json({ errors: ['Error during login'] });
            }
            
            return res.json({
                message: 'Login successful',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    picture: user.picture
                }
            });
        });
    })(req, res, next);
});

// @route   GET /auth/google
// @desc    Auth with Google
// @access  Public
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// @route   GET /auth/google/callback
// @desc    Google auth callback
// @access  Public
router.get('/google/callback', 
    passport.authenticate('google', { 
        // Use appropriate URL for failure redirect
        failureRedirect: process.env.NODE_ENV === 'production' 
            ? '/login?error=google_failed'
            : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_failed`
    }),
    (req, res) => {
        // Successful authentication
        console.log('[AUTH] Google login successful for user:', {
            id: req.user._id,
            email: req.user.email,
            sessionID: req.sessionID
        });
        
        // Get appropriate redirect URL
        const redirectUrl = process.env.NODE_ENV === 'production' 
            ? '/' // In production, redirect to root since frontend and backend are on same domain
            : process.env.FRONTEND_URL || 'http://localhost:3000'; // In development, redirect to frontend URL
        
        // Redirect to the frontend application
        console.log(`[AUTH] Redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
    }
);

// @route   GET /auth/logout
// @desc    Logout user
// @access  Public
router.get('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { 
            console.error('Logout error:', err);
            return next(err); 
        }
        
        // Destroy the session completely
        req.session.destroy(function(err) {
            if (err) { 
                console.error('Session destruction error:', err);
                return next(err); 
            }
            // Clear the cookie
            res.clearCookie('connect.sid');
            
            // Get appropriate redirect URL
            const redirectUrl = process.env.NODE_ENV === 'production' 
                ? '/login' // In production, redirect to /login since frontend and backend are on same domain
                : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`; // In development, redirect to frontend URL
            
            // Redirect to the frontend login page
            res.redirect(redirectUrl);
        });
    });
});

// @route   POST /auth/logout
// @desc    Logout user (API version)
// @access  Public
router.post('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) { 
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Error during logout' }); 
        }
        
        // Destroy the session completely
        req.session.destroy(function(err) {
            if (err) { 
                console.error('Session destruction error:', err);
                return res.status(500).json({ error: 'Error destroying session' }); 
            }
            // Clear the cookie
            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// @route   GET /auth/user
// @desc    Get current user
// @access  Private
router.get('/user', (req, res) => {
    if (req.user) {
        res.json({
            isAuthenticated: true,
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                picture: req.user.picture,
                username: req.user.username
            }
        });
    } else {
        res.json({
            isAuthenticated: false,
            user: null
        });
    }
});

// @route   GET /auth/current-user
// @desc    Get current user
// @access  Private
router.get('/current-user', (req, res) => {
    if (req.user) {
        res.json({
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                picture: req.user.picture,
                username: req.user.username
            }
        });
    } else {
        res.json({
            user: null
        });
    }
});

// @route   GET /auth/session-check
// @desc    Debug session status
// @access  Public
router.get('/session-check', (req, res) => {
    const sessionInfo = {
        sessionID: req.sessionID,
        isAuthenticated: !!req.isAuthenticated(),
        user: req.user ? {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        } : null,
        cookies: req.cookies,
        headers: {
            cookie: req.headers.cookie,
            origin: req.headers.origin,
            host: req.headers.host,
            referer: req.headers.referer
        },
        session: req.session
    };
    
    console.log('[AUTH] SESSION CHECK:', sessionInfo);
    
    res.json(sessionInfo);
});

module.exports = router; 