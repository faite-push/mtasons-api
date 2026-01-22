const adminMiddleware = async (req, res, next) => {
  try {
    
    
    if (req.user && req.user.isAdmin) {
      next();
    } else {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

module.exports = adminMiddleware;