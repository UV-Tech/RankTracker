const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const User = require('../models/User');

// Serialize user to the session
passport.serializeUser((user, done) => {
    console.log(`[PASSPORT] Serializing user: ${user._id}`);
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        console.log(`[PASSPORT] Deserializing user ID: ${id}`);
        const user = await User.findById(id);
        if (!user) {
            console.log(`[PASSPORT] Deserialization failed - User ${id} not found`);
            return done(null, false);
        }
        console.log(`[PASSPORT] User deserialized successfully: ${user.email}`);
        done(null, user);
    } catch (err) {
        console.error('[PASSPORT] Deserialization error:', err);
        done(err, null);
    }
});

// Local Strategy for Email/Password login
passport.use(
    new LocalStrategy(
        { usernameField: 'email' },
        async (email, password, done) => {
            try {
                console.log(`[PASSPORT] Local auth attempt for email: ${email}`);
                // Find the user
                const user = await User.findOne({ email: email.toLowerCase() });
                
                // Check if user exists
                if (!user) {
                    console.log(`[PASSPORT] Local auth failed - No user with email: ${email}`);
                    return done(null, false, { message: 'Invalid email or password' });
                }
                
                // Check if user is a local user
                if (user.authType !== 'local') {
                    console.log(`[PASSPORT] Local auth failed - User ${email} has authType: ${user.authType}`);
                    return done(null, false, { 
                        message: `This account uses ${user.authType} authentication` 
                    });
                }
                
                // Validate password
                const isMatch = await user.matchPassword(password);
                if (!isMatch) {
                    console.log(`[PASSPORT] Local auth failed - Invalid password for user: ${email}`);
                    return done(null, false, { message: 'Invalid email or password' });
                }
                
                // Update last login
                user.lastLogin = Date.now();
                await user.save();
                
                console.log(`[PASSPORT] Local auth successful for user: ${email}`);
                return done(null, user);
            } catch (err) {
                console.error('[PASSPORT] Local auth error:', err);
                return done(err);
            }
        }
    )
);

// Google OAuth Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log(`[PASSPORT] Google auth attempt for: ${profile.displayName} (${profile.id})`);
                console.log(`[PASSPORT] Google profile email: ${profile.emails?.[0]?.value || 'No email'}`);
                
                // Check if user already exists with Google ID
                let user = await User.findOne({ googleId: profile.id });
                
                // If user exists, return it
                if (user) {
                    console.log(`[PASSPORT] Google auth - Found existing user with Google ID: ${user.email}`);
                    user.lastLogin = Date.now();
                    await user.save();
                    return done(null, user);
                }
                
                // Check if user exists with the email (registered with local auth)
                if (profile.emails && profile.emails.length > 0) {
                    const userEmail = profile.emails[0].value;
                    const existingUser = await User.findOne({ email: userEmail });
                    
                    if (existingUser) {
                        console.log(`[PASSPORT] Google auth - Found existing user with email: ${userEmail}`);
                        // Update the user to link Google account
                        existingUser.googleId = profile.id;
                        existingUser.picture = profile.photos[0].value;
                        existingUser.lastLogin = Date.now();
                        await existingUser.save();
                        return done(null, existingUser);
                    }
                }
                
                // Create new user if it doesn't exist
                console.log(`[PASSPORT] Google auth - Creating new user for: ${profile.displayName}`);
                
                const newUser = new User({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: profile.emails ? profile.emails[0].value : '',
                    picture: profile.photos ? profile.photos[0].value : '',
                    username: (profile.emails ? profile.emails[0].value.split('@')[0] : profile.displayName)
                                 .toLowerCase().replace(/[^a-z0-9]/g, ''),
                    authType: 'google',
                    lastLogin: Date.now()
                });
                
                await newUser.save();
                console.log(`[PASSPORT] Google auth - New user created: ${newUser.email} (${newUser._id})`);
                return done(null, newUser);
            } catch (err) {
                console.error('[PASSPORT] Google auth error:', err);
                return done(err);
            }
        }
    )
);

module.exports = passport; 