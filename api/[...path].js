const { app } = require('../server');

module.exports = (req, res) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  }
  try {
    return app(req, res);
  } catch (error) {
    console.error('API function error:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor' });
  }
};
