import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // ⏳ Auto-deletes this document from MongoDB after 3600 seconds (1 hour)!
  },
});

const Token = mongoose.model("Token", tokenSchema);
export default Token;