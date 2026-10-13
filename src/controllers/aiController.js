import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client when API key is provided
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") return null;
  return new GoogleGenAI({ apiKey });
};

// Fallback intelligent DSA heuristics if GEMINI_API_KEY is not configured
const generateFallbackResponse = ({ action, problem, language, code, errorContext, hintLevel = 1, question }) => {
  const problemTitle = problem?.title || "Problem";
  const problemDifficulty = problem?.difficulty || "Medium";

  if (action === "hint") {
    if (hintLevel === 1) {
      return {
        reply: `💡 **Hint 1 (Intuition for "${problemTitle}")**:\n\n` +
          `• Read the constraints carefully. Notice if the input is sorted or if negative numbers are possible.\n` +
          `• Ask yourself: Can we trade space for time? A Hash Map (O(N) space) can often reduce an O(N²) brute force to O(N) time.\n` +
          `• If looking for pairs or subarrays, consider two pointers or a prefix sum.\n\n` +
          `*(Tip: Request Hint 2 for specific algorithmic data structures!)*`,
        level: 1,
      };
    } else if (hintLevel === 2) {
      return {
        reply: `🧠 **Hint 2 (Algorithmic Strategy & Data Structures)**:\n\n` +
          `• For ${problemDifficulty} questions like this, standard patterns include: **Two Pointers**, **Hash Map lookup**, or **Sliding Window**.\n` +
          `• Instead of re-scanning previous elements with nested loops, store previously visited states in an object/map.\n` +
          `• Check if a greedy choice or sorting the array simplifies finding the target.\n\n` +
          `*(Tip: Request Hint 3 for critical edge cases!)*`,
        level: 2,
      };
    } else {
      return {
        reply: `⚠️ **Hint 3 (Crucial Edge Cases & Boundary Conditions)**:\n\n` +
          `• Empty or single-element inputs (e.g., \`len == 0\` or \`len == 1\`).\n` +
          `• Duplicate elements causing unexpected key overwrites.\n` +
          `• Integer overflow or negative indices.\n` +
          `• Target not found / no valid answer: return expected fallback (e.g., \`[]\` or \`-1\`).`,
        level: 3,
      };
    }
  }

  if (action === "explain_bug") {
    const errorMsg = errorContext?.error || errorContext?.stderr || "Test case did not match expected output.";
    return {
      reply: `🔍 **Bug Analysis**:\n\n` +
        `**Observed Issue**: \`${errorMsg.slice(0, 150)}\`\n\n` +
        `• **Common Causes in ${language}**:\n` +
        `  1. Index Out of Bounds: Check if loop terminates at \`< len\` instead of \`<= len\`.\n` +
        `  2. Reusing the same index or element when problem requires distinct elements.\n` +
        `  3. Unhandled edge case when the target value is 0 or negative.\n\n` +
        `• **Actionable Fix**: Trace the failing test case step-by-step with print/console statements at line boundaries.`,
    };
  }

  if (action === "complexity") {
    const hasNestedLoops = /for.*for|while.*while|for.*while/s.test(code || "");
    const timeEst = hasNestedLoops ? "O(N²)" : "O(N)";
    const spaceEst = code && code.includes("new Map") || code && code.includes("set(") || code && code.includes("{}") ? "O(N)" : "O(1)";

    return {
      reply: `⏱️ **Complexity Analysis (${language})**:\n\n` +
        `• **Estimated Time Complexity**: **${timeEst}**\n` +
        `  ${hasNestedLoops ? "- Nested iterations detected. If input size N > 10⁴, this will trigger Time Limit Exceeded (TLE)." : "- Single pass iteration over the primary input elements."}\n\n` +
        `• **Estimated Space Complexity**: **${spaceEst}**\n` +
        `  ${spaceEst === "O(N)" ? "- Auxiliary storage allocated for state tracking (Hash Table / Array buffer)." : "- In-place execution with constant additional memory."}\n\n` +
        `• **LeetCode Pass Verdict**: Aim for O(N) or O(N log N) to comfortably pass large test suites.`,
    };
  }

  // General custom chat
  return {
    reply: `🤖 **AI Pair Programmer**: You asked: *"${question || "How to solve this?"}"*\n\n` +
      `For **${problemTitle}** in **${language}**, break the problem down into:\n` +
      `1. Understanding the base case.\n` +
      `2. Determining state transitions or optimal sub-structures.\n` +
      `3. Implementing without premature optimization first.\n\n` +
      `*(Note: To unlock live Gemini 3.8 Flash inference with full reasoning, configure \`GEMINI_API_KEY\` in \`server/.env\`)*`,
  };
};

// @desc    AI Coding Coach endpoint
// @route   POST /api/ai/coach
export const aiCoachHandler = async (req, res) => {
  try {
    const {
      action = "hint",
      code = "",
      language = "javascript",
      problem = null,
      errorContext = null,
      hintLevel = 1,
      question = "",
    } = req.body;

    const client = getGeminiClient();

    // If no API key configured, use intelligent DSA fallback
    if (!client) {
      const fallback = generateFallbackResponse({
        action,
        problem,
        language,
        code,
        errorContext,
        hintLevel,
        question,
      });
      return res.json({
        success: true,
        source: "fallback",
        notice: "Add GEMINI_API_KEY to server/.env to enable live Gemini 3.8 Flash model",
        ...fallback,
      });
    }

    // Prepare system instructions and prompt tailored to DSA mentoring
    const problemContext = problem
      ? `LeetCode Problem: #${problem.questionFrontendId || ""} ${problem.title || "DSA Problem"} (${problem.difficulty || "Medium"})\n` +
        `Problem Summary: ${problem.content ? problem.content.replace(/<[^>]*>?/gm, "").slice(0, 600) : "N/A"}\n`
      : "General DSA Coding Task\n";

    let userPrompt = "";

    if (action === "hint") {
      userPrompt = `You are an elite DSA interviewer and coding mentor. A student is working on this LeetCode problem in ${language}:\n\n` +
        problemContext +
        `\nCurrent Student Code:\n\`\`\`${language}\n${code || "// No code yet"}\n\`\`\`\n\n` +
        `The student is asking for Hint Level ${hintLevel} (1 = High-level intuition only without code; 2 = Algorithmic pattern and data structures to consider; 3 = Tricky edge cases and boundary conditions).\n` +
        `Provide a helpful, encouraging Hint Level ${hintLevel}. DO NOT give away the full final solution code — teach them to solve it themselves!`;
    } else if (action === "explain_bug") {
      userPrompt = `You are a patient code debugging mentor. A student's code failed for this problem in ${language}:\n\n` +
        problemContext +
        `\nCurrent Student Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n` +
        `Error/Execution Info: ${JSON.stringify(errorContext || "Failed test case")}\n\n` +
        `Explain clearly:\n1. Where the bug or logical flaw is located.\n2. Why it happens.\n3. What specific correction or check should be made (without rewriting their entire solution).`;
    } else if (action === "complexity") {
      userPrompt = `You are a DSA performance expert. Analyze the Time and Space complexity of this ${language} code:\n\n` +
        problemContext +
        `\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\`\n\n` +
        `Provide:\n` +
        `1. Time Complexity with Big-O notation and mathematical explanation.\n` +
        `2. Space Complexity with Big-O notation and explanation.\n` +
        `3. Whether this will pass typical LeetCode time limits (usually 10^8 operations / 1-2 seconds).\n` +
        `4. Quick bottleneck optimization tip if applicable.`;
    } else {
      userPrompt = `You are an interactive coding coach inside a collaborative study room. The student is asking: "${question}"\n\n` +
        problemContext +
        `\nCurrent Language: ${language}\n` +
        `Current Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n` +
        `Provide a concise, clear, and helpful response formatted with Markdown bullet points and code snippets if relevant.`;
    }

    // Call Gemini 3.8 Flash model
    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userPrompt,
    });

    const reply = response.text || "No response received from Gemini.";

    return res.json({
      success: true,
      source: "gemini-3.8-flash",
      reply,
      level: hintLevel,
    });
  } catch (error) {
    console.error("AI Coach error:", error);
    // Fall back gracefully on API error
    const fallback = generateFallbackResponse(req.body);
    return res.json({
      success: true,
      source: "fallback",
      error: error.message,
      ...fallback,
    });
  }
};
