import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

export async function connectDB(uri?: string): Promise<string> {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (mongoUri && mongoUri.trim() !== '') {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500,
      });
      console.log(`[MongoDB] Connected to external database: ${mongoUri}`);
      return mongoUri;
    } catch (err) {
      console.warn(`[MongoDB] Failed to connect to ${mongoUri}. Falling back to in-memory MongoDB. Error: ${(err as Error).message}`);
    }
  }

  // Fallback to in-memory MongoDB server
  try {
    mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    await mongoose.connect(memUri);
    console.log(`[MongoDB] Connected to In-Memory MongoDB instance at: ${memUri}`);
    return memUri;
  } catch (error) {
    console.error('[MongoDB] Failed to initialize in-memory MongoDB:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
      mongod = null;
    }
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Error during disconnect:', error);
  }
}
