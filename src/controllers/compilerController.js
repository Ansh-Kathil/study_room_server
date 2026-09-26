const JUDGE0_URL = "https://ce.judge0.com/submissions?base64_encoded=true&wait=true";

const decodeBase64 = (b64) => (b64 ? Buffer.from(b64, "base64").toString("utf-8") : "");

// Map our language IDs to Judge0 language IDs
const LANGUAGE_MAP = {
  javascript: 63, // Node.js
  typescript: 74, // TypeScript
  python: 71,     // Python 3
  cpp: 54,        // C++ (GCC 9.2.0)
  java: 62,       // Java (OpenJDK 13.0.1)
};

// --- C++ Helper Functions ---
const jsonToCppLiteral = (val) => {
  if (typeof val === "string") return JSON.stringify(val);
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    const items = val.map((item) => jsonToCppLiteral(item)).join(", ");
    return `{${items}}`;
  }
  return String(val);
};

const cleanCppType = (typeStr) => {
  return typeStr.replace(/\bconst\b/g, "").replace(/[&*]/g, "").trim();
};

const splitCppParams = (paramsStr) => {
  if (!paramsStr || !paramsStr.trim()) return [];
  const params = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < paramsStr.length; i++) {
    const c = paramsStr[i];
    if (c === "<") depth++;
    else if (c === ">") depth--;
    else if (c === "," && depth === 0) {
      params.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) params.push(current.trim());
  return params;
};

// Helper to inject function call if user writes a pure function with testcase input
const prepareExecutableCode = (code, language, input) => {
  // 1. C++ (GCC 9.2.0)
  if (language === "cpp") {
    // If the user already wrote their own main(), don't inject a second one
    if (/\bmain\s*\(/.test(code)) {
      return `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <cmath>

using namespace std;

${code}`;
    }

    const commonHeaders = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <numeric>
#include <sstream>

using namespace std;

// Generic C++ Result Printer
template <typename T>
void printResult(const T& val) {
    cout << val;
}
void printResult(bool val) {
    cout << (val ? "true" : "false");
}
void printResult(const string& val) {
    cout << "\\"" << val << "\\"";
}
void printResult(char val) {
    cout << "'" << val << "'";
}
template <typename T>
void printResult(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        printResult(vec[i]);
        if (i + 1 < vec.size()) cout << ", ";
    }
    cout << "]";
}
`;

    // Find class Solution method: e.g. vector<int> twoSum(vector<int>& nums, int target) {
    const methodMatch = code.match(/(?:public:\s*)?([a-zA-Z0-9_:<>*\s&]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/);
    if (!methodMatch) {
      return `${commonHeaders}\n${code}\nint main() { return 0; }`;
    }

    const returnType = methodMatch[1].trim();
    const methodName = methodMatch[2].trim();
    const rawParams = methodMatch[3].trim();

    const paramList = splitCppParams(rawParams);
    const inputLines = input ? input.trim().split("\n").filter((l) => l.trim().length > 0) : [];

    let argDeclarations = "";
    const argNames = [];

    paramList.forEach((param, idx) => {
      const rawType = param.replace(/\s+([a-zA-Z0-9_]+)$/, "");
      const cleanType = cleanCppType(rawType) || "auto";
      const argName = `__arg${idx}`;
      argNames.push(argName);

      const inputLine = inputLines[idx];
      let literal = "{}";
      if (inputLine !== undefined) {
        try {
          const parsed = JSON.parse(inputLine);
          literal = jsonToCppLiteral(parsed);
        } catch {
          literal = JSON.stringify(inputLine);
        }
      }

      argDeclarations += `    ${cleanType} ${argName} = ${literal};\n`;
    });

    const isVoid = returnType === "void";
    let invocationCode = "";
    if (isVoid) {
      invocationCode = `
    sol.${methodName}(${argNames.join(", ")});
    cout << "Output: ";
    if (${argNames.length} > 0) {
        printResult(${argNames[0]});
    }
    cout << endl;`;
    } else {
      invocationCode = `
    auto __res = sol.${methodName}(${argNames.join(", ")});
    cout << "Output: ";
    printResult(__res);
    cout << endl;`;
    }

    return `${commonHeaders}

${code}

int main() {
    Solution sol;
${argDeclarations}${invocationCode}
    return 0;
}
`;
  }

  // 2. Python (Python 3)
  if (language === "python") {
    const pythonPrefix = `from typing import *
import json, sys, math, collections, heapq, bisect
true = True
false = False
null = None
`;

    if (!input || !input.trim()) {
      return `${pythonPrefix}\n${code}`;
    }

    // Match all def functions that are NOT __init__
    const allDefs = [...code.matchAll(/def\s+([a-zA-Z0-9_]+)\s*\(/g)];
    const validDef = allDefs.find((m) => m[1] !== "__init__");

    if (validDef) {
      const fnName = validDef[1];
      const lines = input.trim().split("\n");
      const args = lines.map((l) => l.trim()).join(", ");

      return `${pythonPrefix}
${code}

# --- Auto-Generated Testcase Runner ---
try:
    if 'Solution' in globals():
        sol = Solution()
        res = sol.${fnName}(${args})
        print("Output:", json.dumps(res) if res is not None else "")
    else:
        res = ${fnName}(${args})
        print("Output:", json.dumps(res) if res is not None else "")
except Exception as e:
    print("Execution Error:", str(e))
`;
    }

    return `${pythonPrefix}\n${code}`;
  }

  // 3. Java (OpenJDK 13)
  if (language === "java") {
    if (/\bstatic\s+void\s+main\s*\(/.test(code)) {
      return code;
    }
    return `import java.util.*;
import java.io.*;

${code}

public class Main {
    public static void main(String[] args) {
        System.out.println("Java execution ready.");
    }
}
`;
  }

  if (!input || !input.trim()) return code;

  // 4. JavaScript / TypeScript
  if (language === "javascript" || language === "typescript") {
    // Check for LeetCode style: var/const/let fnName = function or () =>
    const assignMatch = code.match(/(?:const|var|let)\s+([a-zA-Z0-9_]+)\s*=\s*(?:function|\()/);
    
    // Or regular function fnName( excluding ListNode, TreeNode helper comments
    const allFuncs = [...code.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/g)];
    const validFunc = allFuncs.find(
      (m) => m[1] !== "ListNode" && m[1] !== "TreeNode" && !m[1].startsWith("_")
    );

    const fnName = assignMatch ? assignMatch[1] : validFunc ? validFunc[1] : null;

    if (fnName) {
      const lines = input.trim().split("\n");
      const args = lines
        .map((l) => {
          try {
            return JSON.stringify(JSON.parse(l));
          } catch {
            return JSON.stringify(l);
          }
        })
        .join(", ");

      return `
${code}

// --- Auto-Generated Testcase Runner ---
try {
  const __result = ${fnName}(${args});
  if (__result !== undefined) {
    console.log("Output:", JSON.stringify(__result));
  }
} catch (err) {
  console.error("Execution Error:", err.message);
}
`;
    }
  }

  return code;
};

// --- Output Normalization and Expected Output Matcher ---
const normalizeOutput = (rawOutput) => {
  if (!rawOutput) return "";
  let clean = rawOutput.trim();
  const match = clean.match(/Output:\s*([\s\S]*)$/i);
  if (match) {
    clean = match[1].trim();
  }
  return clean;
};

const areOutputsEqual = (actualRaw, expectedRaw) => {
  if (!expectedRaw) return true;
  const actual = normalizeOutput(actualRaw);
  const expected = normalizeOutput(expectedRaw);

  if (actual === expected) return true;
  if (actual.replace(/\s+/g, "") === expected.replace(/\s+/g, "")) return true;

  // Try parsing both as JSON
  try {
    const actObj = JSON.parse(actual);
    const expObj = JSON.parse(expected);

    // If both are arrays
    if (Array.isArray(actObj) && Array.isArray(expObj)) {
      if (actObj.length !== expObj.length) return false;
      if (JSON.stringify(actObj) === JSON.stringify(expObj)) return true;
      // Order-independent match for numbers (e.g. [0, 1] vs [1, 0])
      const actSorted = [...actObj].sort((a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b))));
      const expSorted = [...expObj].sort((a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b))));
      if (JSON.stringify(actSorted) === JSON.stringify(expSorted)) return true;
    }

    if (actObj === expObj) return true;
  } catch {}

  // Case-insensitive comparison for booleans
  if (actual.toLowerCase() === expected.toLowerCase()) return true;

  return false;
};

// @desc    Compile & Run Code with Testcase Input(s)
// @route   POST /api/compiler/run
export const runCode = async (req, res) => {
  try {
    const { code, language = "javascript", input = "", inputs = [], expectedOutputs = [] } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: "Code cannot be empty" });
    }

    const languageId = LANGUAGE_MAP[language] || 63;
    const testCases = Array.isArray(inputs) && inputs.length > 0 ? inputs : [input || ""];
    const expectedList = Array.isArray(expectedOutputs) ? expectedOutputs : [];

    // Run all test cases
    const results = await Promise.all(
      testCases.map(async (testInput, idx) => {
        const finalSource = prepareExecutableCode(code, language, testInput);

        const response = await fetch(JUDGE0_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source_code: Buffer.from(finalSource).toString("base64"),
            language_id: languageId,
            stdin: Buffer.from(testInput || "").toString("base64"),
          }),
        });

        const result = await response.json();
        const stdout = decodeBase64(result.stdout);
        const stderr = decodeBase64(result.stderr);
        const compileOutput = decodeBase64(result.compile_output);
        const message = decodeBase64(result.message) || result.message || "";

        const isCompileError = result.status?.id === 6 || !!compileOutput.trim();
        const isRuntimeError =
          (result.status?.id >= 7 && result.status?.id <= 12) ||
          (!isCompileError && result.status?.id !== 3 && !!stderr.trim());

        const rawOutput = (compileOutput || stderr || stdout || message || "").trim();
        const actualValue = normalizeOutput(stdout.trim() || rawOutput);
        const expected = expectedList[idx] || "";

        const execClean = result.status?.id === 3 && !isCompileError && !isRuntimeError;
        const matchesExpected = expected ? areOutputsEqual(actualValue, expected) : true;
        const isPassed = execClean && matchesExpected;

        let caseStatus = result.status?.description || "Completed";
        if (isCompileError) {
          caseStatus = "Compilation Error";
        } else if (isRuntimeError) {
          caseStatus = result.status?.description || "Runtime Error";
        } else if (execClean && !matchesExpected) {
          caseStatus = "Wrong Answer";
        }

        return {
          caseIndex: idx,
          input: testInput,
          expected: expected || null,
          actual: actualValue || rawOutput || "No output",
          rawOutput,
          compileError: isCompileError ? compileOutput.trim() || rawOutput : null,
          runtimeError: isRuntimeError ? stderr.trim() || rawOutput : null,
          passed: isPassed,
          status: caseStatus,
          time: result.time ? `${result.time}s` : "0.01s",
          memory: result.memory ? `${Math.round(result.memory / 1024)} MB` : "N/A",
        };
      })
    );

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    const allPassed = passedCount === totalCount;

    let overallStatus = "Accepted";
    let compileError = null;
    let runtimeError = null;

    if (!allPassed) {
      const compileErrObj = results.find((r) => r.compileError);
      const runtimeErrObj = results.find((r) => r.runtimeError);

      if (compileErrObj) {
        overallStatus = "Compilation Error";
        compileError = compileErrObj.compileError;
      } else if (runtimeErrObj) {
        overallStatus = runtimeErrObj.status || "Runtime Error";
        runtimeError = runtimeErrObj.runtimeError;
      } else {
        overallStatus = "Wrong Answer";
      }
    }

    const firstResult = results[0] || {};

    res.json({
      success: allPassed,
      status: overallStatus,
      passedCount,
      totalCount,
      compileError,
      runtimeError,
      results,
      output: compileError || runtimeError || firstResult.actual || firstResult.rawOutput || "",
      time: firstResult.time || "0.01s",
      memory: firstResult.memory || "N/A",
    });
  } catch (error) {
    res.status(500).json({ message: "Code execution failed", error: error.message });
  }
};