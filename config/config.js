const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/quran_app',
  jwtSecret: process.env.JWT_SECRET || 'gjm38r37rh37r387r38r3h8r3hr83h83rr',
  jwtExpiresIn: '30d'
};

module.exports = config;