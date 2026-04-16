import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "scms";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

let prodClientPromise: Promise<MongoClient> | undefined;

export function isMongoConfigured(): boolean {
  return Boolean(uri?.trim());
}

export function getMongoClientPromise(): Promise<MongoClient> {
  if (!uri?.trim()) {
    return Promise.reject(new Error("MONGODB_URI is not set"));
  }

  if (process.env.NODE_ENV === "development") {
    if (!global.__mongoClientPromise) {
      const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
      });
      global.__mongoClientPromise = client.connect();
    }
    return global.__mongoClientPromise;
  }

  if (!prodClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    prodClientPromise = client.connect();
  }
  return prodClientPromise;
}

export async function getDb() {
  const client = await getMongoClientPromise();
  return client.db(dbName);
}
