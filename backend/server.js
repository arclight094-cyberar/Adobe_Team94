import "./config.js";
import { app } from "./app.js";
import mongoose from "mongoose";

// Debug: Check NODE_ENV
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);

const PORT = process.env.PORT || 4000;

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

// Connect to MongoDB
mongoose.connect(DB).then(() => {
  console.log('MongoDB Connection Successful !! 🎉');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});