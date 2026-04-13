import mongoose from 'mongoose';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const conn = await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB || 'taskflow',
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 2
      });

      console.log(`MongoDB connected: ${conn.connection.host}`);
      break;
    } catch (error) {
      console.error(`Database connection failed (attempt ${attempt}/${maxAttempts}): ${error.message}`);
      if (attempt === maxAttempts) {
        throw error;
      }
      await delay(1500 * attempt);
    }
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });

  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB runtime error: ${error.message}`);
  });
};

export default connectDB;
