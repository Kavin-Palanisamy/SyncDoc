import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

function sanitizeMongoUri(uri: string): string {
  return uri.replace(/:([^@]+)@/, ':****@');
}

export async function connectDB(uri?: string): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';
  const mongoUri = uri || process.env.MONGODB_URI;

  if (isProduction && (!mongoUri || mongoUri.trim() === '')) {
    throw new Error('Production environment requires a valid MONGODB_URI. In-memory database fallback is disabled in production.');
  }

  if (mongoUri && mongoUri.trim() !== '') {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500,
      });
      console.log(`[MongoDB] Connected to database: ${sanitizeMongoUri(mongoUri)}`);
      return mongoUri;
    } catch (err) {
      if (isProduction) {
        console.error(`[MongoDB] Failed to connect to production database: ${sanitizeMongoUri(mongoUri)}`);
        throw new Error(`Failed to connect to production database: ${(err as Error).message}`);
      }
      console.warn(`[MongoDB] Failed to connect to ${sanitizeMongoUri(mongoUri)}. Falling back to in-memory MongoDB. Error: ${(err as Error).message}`);
    }
  }

  // Fallback to in-memory MongoDB server (Development & Test only)
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
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
      mongod = null;
    }
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Error during disconnect:', error);
  }
}
