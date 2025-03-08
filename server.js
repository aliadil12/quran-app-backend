// server.js - actualizado

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http'); 
const { errorHandler } = require('./utils/errorHandler');
const logger = require('./middleware/loggerMiddleware');
const connectDB = require('./config/db');
const config = require('./config/config');
const setupWebSocketServer = require('./utils/websocketServer'); 

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app); // Crear servidor HTTP

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Agregar punto de verificación de salud (health check) para mantener el servicio activo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/community', require('./routes/communityRoutes'));
app.use('/api/users', require('./routes/userDetailsRoutes'));
app.use('/api/calls', require('./routes/callRoutes'));
// Eliminar la línea que importa evaluationRoutes
app.use('/api/circles', require('./routes/studyCircleRoutes'));
app.use('/api/chat', require('./routes/chatRoutes')); 

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Handle undefined routes
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `لا يمكن العثور على ${req.originalUrl} على هذا الخادم`
  });
});

// Global error handler
app.use(errorHandler);

// Configurar servicio WebSocket
const io = setupWebSocketServer(server);

const PORT = process.env.PORT || 5000;

// Usar servidor HTTP 
server.listen(PORT, () => {
  console.log(`Server running in ${config.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  // تعديل هنا: بدلاً من إغلاق التطبيق، نسمح له بالاستمرار في التشغيل
  console.log('Server will continue running despite the error');
});