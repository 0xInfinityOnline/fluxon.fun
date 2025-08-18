import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

export async function initializeDatabase() {
  try {
    // Verify connection
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
}

// Ensure database connection is closed when the app shuts down
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
