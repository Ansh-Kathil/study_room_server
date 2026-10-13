import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    problemFrontendId: {
      type: String,
      default: "",
    },
    problemTitle: {
      type: String,
      required: true,
    },
    problemTitleSlug: {
      type: String,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Custom"],
      default: "Custom",
    },
    language: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Accepted", "Wrong Answer", "Compile Error", "Runtime Error", "Submitted"],
      default: "Submitted",
    },
    passedCases: {
      type: Number,
      default: 0,
    },
    totalCases: {
      type: Number,
      default: 0,
    },
    executionTime: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Submission", submissionSchema);
