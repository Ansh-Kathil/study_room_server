import mongoose from "mongoose";

const mockInterviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trackId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    transcript: [
      {
        speaker: {
          type: String,
          enum: ["interviewer", "candidate"],
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    report: {
      overallScore: { type: Number, default: 0 },
      verdict: { type: String, default: "In Review" },
      summary: { type: String, default: "" },
      technicalDepthScore: { type: Number, default: 0 },
      problemSolvingScore: { type: Number, default: 0 },
      communicationScore: { type: Number, default: 0 },
      tradeoffsScore: { type: Number, default: 0 },
      strengths: [{ type: String }],
      areasForImprovement: [{ type: String }],
      modelAnswers: [
        {
          question: { type: String },
          candidateSummary: { type: String },
          feedback: { type: String },
          idealAnswer: { type: String },
        },
      ],
      recommendedTopics: [{ type: String }],
    },
    status: {
      type: String,
      enum: ["completed", "in_progress", "abandoned"],
      default: "completed",
    },
  },
  { timestamps: true }
);

export default mongoose.model("MockInterview", mockInterviewSchema);
