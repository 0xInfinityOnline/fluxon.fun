import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  port: process.env.PORT || 3001,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:byr1998@localhost:5432/fluxon?schema=public',
  },
  ai: {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      endpoint: process.env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
    },
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_here',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};
