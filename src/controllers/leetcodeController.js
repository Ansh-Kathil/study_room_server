import { searchLeetCodeProblems, getLeetCodeProblemDetails } from "../services/leetcodeService.js";

// @desc    Search any LeetCode problem
// @route   GET /api/leetcode/search?q=...
export const searchProblems = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const problems = await searchLeetCodeProblems(q.trim());
    res.json({ problems });
  } catch (error) {
    res.status(500).json({ message: "Failed to search LeetCode problems", error: error.message });
  }
};

// @desc    Get detailed LeetCode problem description & starter code
// @route   GET /api/leetcode/:slug
export const getProblemDetails = async (req, res) => {
  try {
    const { slug } = req.params;
    const problem = await getLeetCodeProblemDetails(slug);
    if (!problem) {
      return res.status(404).json({ message: "LeetCode problem not found" });
    }
    res.json({ problem });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch LeetCode problem", error: error.message });
  }
};