/**
 * Authentication middleware
 * Checks if the user is authenticated before allowing access to protected routes
 */
module.exports = {
    // Check if user is authenticated
    ensureAuth: function (req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        } else {
            res.status(401).json({ error: 'Unauthorized - Please log in' });
        }
    },
    
    // Check if user is NOT authenticated (for login/register pages)
    ensureGuest: function (req, res, next) {
        if (req.isAuthenticated()) {
            res.redirect('/');
        } else {
            return next();
        }
    }
}; 