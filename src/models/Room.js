import mongoose from "mongoose";

const starterCode = `// Welcome to the Collaborative Study Room!
// Start coding together in real time...

function solution() {
  console.log("Hello, world!");
}

solution();
`;

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      default: null,
    },
    // ⌨️ New fields for collaborative code editor
    code: {
      type: String,
      default: starterCode,
    },
    language: {
      type: String,
      default: "javascript",
    },
    notes: {
      type: String,
      default: "# Study Notes\n- Use this space to write lecture notes, formulas, or agendas together.\n",
    },
    // 🏆 Synchronized LeetCode Problem for all room members
    activeProblem: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // 🎨 Collaborative Whiteboard Strokes
    whiteboard: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Room = mongoose.model("Room", roomSchema);
export default Room;