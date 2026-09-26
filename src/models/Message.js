import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true, // Fast lookup by room
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content cannot be empty"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: Allows querying messages for a specific room sorted by timestamp super fast
messageSchema.index({ room: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;