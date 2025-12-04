import express from 'express';
import morgan from 'morgan';
import AppError from './utils/AppError.js';
import authRoutes from './routes/authRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import geminiRoutes from './routes/geminiRoutes.js';
import layerProjectRoutes from './routes/layerProjectRoutes.js';
import layerRoutes from './routes/layerRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import seqAiProjectRoutes from './routes/seqAiProjectRoutes.js';
import globalErrorHandler from './utils/globalErrorHandler.js';


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
    console.log('🔧 Morgan logging enabled (development mode)');
}

// Sample route
app.get('/', (req, res) => {
    res.json({
        message: 'hello from Adobe PS backend!!',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Auth routes
app.use('/api/v1/adobe-ps/auth', authRoutes);

// Image routes
app.use('/api/v1/adobe-ps/images', imageRoutes);

// AI routes
app.use('/api/v1/adobe-ps/ai', aiRoutes);

// Gemini AI routes
app.use('/api/v1/adobe-ps/gemini', geminiRoutes);

// Project routes (Layer-based editing)
app.use('/api/v1/adobe-ps/projects', layerProjectRoutes);

// Layer routes (Individual layer operations)
app.use('/api/v1/adobe-ps/layers', layerRoutes);

// AI Project routes (sequential editing)
app.use('/api/v1/adobe-ps/ai-projects', seqAiProjectRoutes);

// Settings routes
app.use('/api/v1/adobe-ps/settings', settingsRoutes);






// 404 handler
app.all('/{*any}', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!!`, 404));
});

app.use(globalErrorHandler);

export { app };
