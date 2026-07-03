const mongoose = require('mongoose');

const db = process.env.MONGO_URI;

const dbConnect = async () => {
  if (!db) {
    console.error("❌ MongoDB connection failed: MONGO_URI is not set in .env");
    return;
  }
  try {
    await mongoose.connect(db, { serverSelectionTimeoutMS: 5000 });
    console.log("📡 MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    if (error.message.includes('ENOTFOUND')) {
      console.error("   → Check: hostname in MONGO_URI is correct (e.g. localhost or Atlas host)");
    }
    if (error.message.includes('authentication failed')) {
      console.error("   → Check: username and password in MONGO_URI (special chars may need encoding)");
    }
    if (error.message.includes('timed out')) {
      console.error("   → Check: MongoDB is running, or Atlas Network Access allows your IP");
    }
  }
};

module.exports = dbConnect;