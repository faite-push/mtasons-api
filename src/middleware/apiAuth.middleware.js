require('dotenv').config();

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    if (token !== process.env.API_SECRET) {
        return res.status(403).json({ error: 'Invalid token.' });
    }

    next();
};
