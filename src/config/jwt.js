const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET;

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Token inválido ou expirado');
  }
};

module.exports = { generateToken, verifyToken };