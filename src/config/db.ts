import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.DATABASE_URL;

if (!mongoURI) {
  console.error('[DB] DATABASE_URL not defined in environment variables');
  process.exit(1);
}

export const connectDB = async () => {
  try {
    // Suppress warning alerts on strict queries
    mongoose.set('strictQuery', false);
    
    await mongoose.connect(mongoURI);
    console.log('=============================================');
    console.log(' DATABASE: Connected to MongoDB Atlas');
    console.log('=============================================');
  } catch (err) {
    console.error('[DB] Connection error:', err);
    process.exit(1);
  }
};

export default mongoose;
