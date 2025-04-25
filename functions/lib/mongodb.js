// MongoDB connection utilities - server-side only
import { MongoClient, ObjectId } from 'mongodb';

// Connection URI (using environment variable)
const uri = process.env.MONGODB_URI;

// Cached connection
let cachedClient = null;
let cachedDb = null;

// Connection options
const connectionOptions = {
  connectTimeoutMS: 10000,       // 10 seconds connection timeout
  serverSelectionTimeoutMS: 10000, // 10 seconds server selection timeout
  maxPoolSize: 10,               // Maximum connection pool size
  socketTimeoutMS: 45000         // Socket timeout
};

if (!uri) {
  console.error("MONGODB_URI environment variable is not defined");
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Connect to MongoDB database with connection pooling
 * @returns {Promise<{client: MongoClient, db: Db}>}
 */
export async function connectToDatabase() {
  try {
    // If we have a cached connection, use it
    if (cachedClient && cachedDb) {
      // Verify that the connection is still alive
      try {
        await cachedDb.command({ ping: 1 });
        return { client: cachedClient, db: cachedDb };
      } catch (pingError) {
        console.warn("Cached MongoDB connection is stale, creating a new one:", pingError);
        // Connection is stale, create a new one
        try {
          await cachedClient.close();
        } catch (closeError) {
          // Ignore close errors
        }
        cachedClient = null;
        cachedDb = null;
      }
    }

    // Create a new client and connect
    console.log("Creating new MongoDB connection");
    const client = new MongoClient(uri, connectionOptions);
    
    await client.connect();
    console.log("MongoDB connection established successfully");
    
    // Get the database name from the connection string
    const dbName = new URL(uri).pathname.substring(1);
    console.log(`Using database: ${dbName}`);
    const db = client.db(dbName);

    // Cache the client and database connection
    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    
    // Clean up if there was a partial connection
    if (cachedClient) {
      try {
        await cachedClient.close();
      } catch (closeError) {
        // Ignore close errors
      }
      cachedClient = null;
      cachedDb = null;
    }
    
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

/**
 * Create a new receipt document in MongoDB
 * @param {Object} receiptData - Receipt data to store
 * @returns {Promise<string>} - ID of the created document
 */
export async function createReceiptDocument(receiptData) {
  let client;
  try {
    // Connect to the database
    const { db, client: mongoClient } = await connectToDatabase();
    client = mongoClient;
    
    const collection = db.collection('receipts');
    
    // Add timestamps
    const documentToInsert = {
      ...receiptData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Perform the insert operation
    const result = await collection.insertOne(documentToInsert);
    
    if (!result || !result.insertedId) {
      throw new Error('Failed to get insertedId from MongoDB');
    }
    
    // Convert ObjectId to string
    const documentId = result.insertedId.toString();
    return documentId;
  } catch (error) {
    console.error('Error creating receipt document:', error);
    throw error;
  }
}

/**
 * Retrieve a receipt document by ID
 * @param {string} id - Receipt document ID
 * @returns {Promise<Object|null>} - Receipt document or null if not found
 */
export async function getReceiptById(id) {
  let client;
  try {
    // Input validation
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid receipt ID');
    }
    
    // Connect to the database
    const { db, client: mongoClient } = await connectToDatabase();
    client = mongoClient;
    
    const collection = db.collection('receipts');
    
    // Convert string ID to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (idError) {
      console.error(`Invalid ObjectId format: ${id}`, idError);
      return null;
    }
    
    // Perform the find operation
    const document = await collection.findOne({ _id: objectId });
    
    if (!document) {
      console.log(`No document found with ID: ${id}`);
      return null;
    }
    
    console.log(`Document retrieved successfully`);
    return document;
  } catch (error) {
    console.error('Error retrieving receipt document:', error);
    throw error;
  }
}

/**
 * Update an existing receipt document by ID
 * @param {string} id - Receipt document ID
 * @param {Object} updateData - Data to update in the document
 * @returns {Promise<boolean>} - Whether the update was successful
 */
export async function updateReceiptById(id, updateData) {
  let client;
  try {
    // Input validation
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid receipt ID');
    }
    
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Invalid update data');
    }
    
    // Connect to the database
    const { db, client: mongoClient } = await connectToDatabase();
    client = mongoClient;
    
    const collection = db.collection('receipts');
    
    // Convert string ID to ObjectId
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (idError) {
      console.error(`Invalid ObjectId format: ${id}`, idError);
      return false;
    }
    
    // Prepare the update
    const update = {
      $set: {
        ...updateData,
        updatedAt: new Date()
      }
    };
    
    // Keep original createdAt if it exists
    const existingDoc = await collection.findOne({ _id: objectId }, { projection: { createdAt: 1 } });
    
    if (existingDoc?.createdAt) {
      update.$set.createdAt = existingDoc.createdAt;
    }
    
    // Perform the update operation
    const result = await collection.updateOne(
      { _id: objectId },
      update
    );
    
    if (!result || result.matchedCount === 0) {
      console.log(`No document found with ID: ${id}`);
      return false;
    }
    
    if (result.modifiedCount === 0) {
      console.log(`Document with ID: ${id} found but not modified`);
      // Still return true since the document exists and the operation succeeded
      return true;
    }
    
    console.log(`Document updated successfully. Modified count: ${result.modifiedCount}`);
    return true;
  } catch (error) {
    console.error('Error updating receipt document:', error);
    return false;
  }
} 