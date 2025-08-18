import express from 'express';
import cors from 'cors';
import { config as dotenvConfig } from 'dotenv';
import { router as csvRouter } from './routes/csv.routes';
import { router as aiRouter } from './routes/ai.routes';
import { router as analyticsRouter } from './routes/analytics.routes';
import { router as authRouter } from './routes/auth.routes';
import { initializeDatabase } from './database';
import appConfig from './config';
import { errorHandler, notFound } from '@/middleware/error.middleware';

// Load environment variables
dotenvConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/csv', csvRouter);
app.use('/api/ai', aiRouter);
app.use('/api/analytics', analyticsRouter);

// Error handling middleware
app.use(errorHandler);

// Database initialization
initializeDatabase()
  .then(() => {
    console.log('Database connected successfully');
    
    // Start the server
    const PORT = appConfig.port;
    const server = app.listen(PORT, () => {
      console.log(`Server running in ${appConfig.nodeEnv} mode on port ${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      console.error('Unhandled Rejection:', err);
      server.close(() => process.exit(1));
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
