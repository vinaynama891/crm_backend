import app from './app';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();

  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(` ESTATEFLOW CRM SERVER RUNNING ON PORT ${PORT}`);
    console.log(` Mode: Development`);
    console.log(` Database: MongoDB via Mongoose`);
    console.log(`=============================================`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Boot failure:', err);
  process.exit(1);
});
