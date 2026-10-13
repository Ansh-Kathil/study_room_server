import Submission from "../models/Submission.js";

// @desc    Record a new submission
// @route   POST /api/submissions
// @access  Private
export const createSubmission = async (req, res) => {
  try {
    const {
      room,
      problemFrontendId,
      problemTitle,
      problemTitleSlug,
      difficulty,
      language,
      code,
      status,
      passedCases,
      totalCases,
      executionTime,
    } = req.body;

    if (!problemTitle || !code || !language) {
      return res.status(400).json({ message: "Problem title, code, and language are required" });
    }

    const submission = await Submission.create({
      user: req.user._id,
      room: room || null,
      problemFrontendId: problemFrontendId || "",
      problemTitle,
      problemTitleSlug: problemTitleSlug || "",
      difficulty: difficulty || "Custom",
      language,
      code,
      status: status || "Submitted",
      passedCases: Number(passedCases) || 0,
      totalCases: Number(totalCases) || 0,
      executionTime: executionTime || "",
    });

    res.status(201).json({
      success: true,
      message: "Submission recorded successfully",
      submission,
    });
  } catch (err) {
    console.error("Error creating submission:", err);
    res.status(500).json({ message: "Failed to save submission" });
  }
};

// @desc    Get all submissions for the logged in user
// @route   GET /api/submissions/user
// @access  Private
export const getUserSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("room", "name joinCode")
      .limit(50);

    res.json({ success: true, submissions });
  } catch (err) {
    console.error("Error fetching user submissions:", err);
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};

// @desc    Get user submission stats (total solved, by difficulty)
// @route   GET /api/submissions/stats
// @access  Private
export const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Total submissions
    const totalSubmissions = await Submission.countDocuments({ user: userId });

    // Distinct accepted problems solved
    const acceptedSubmissions = await Submission.find({
      user: userId,
      status: "Accepted",
    });

    const solvedProblemIds = new Set();
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    acceptedSubmissions.forEach((sub) => {
      const key = sub.problemFrontendId || sub.problemTitle;
      if (!solvedProblemIds.has(key)) {
        solvedProblemIds.add(key);
        if (sub.difficulty === "Easy") easyCount++;
        else if (sub.difficulty === "Medium") mediumCount++;
        else if (sub.difficulty === "Hard") hardCount++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalSubmissions,
        totalSolved: solvedProblemIds.size,
        easy: easyCount,
        medium: mediumCount,
        hard: hardCount,
      },
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// @desc    Get submissions made in a specific room
// @route   GET /api/submissions/room/:roomId
// @access  Private
export const getRoomSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ room: req.params.roomId })
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .limit(30);

    res.json({ success: true, submissions });
  } catch (err) {
    console.error("Error fetching room submissions:", err);
    res.status(500).json({ message: "Failed to fetch room submissions" });
  }
};
