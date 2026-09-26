// Service to query LeetCode's public GraphQL API
const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

const HEADERS = {
  "Content-Type": "application/json",
  Referer: "https://leetcode.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
};

// 1. Search problems by keyword (e.g., "tree", "two sum", "graph")
export const searchLeetCodeProblems = async (keyword = "", limit = 15) => {
  const query = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          questionFrontendId
          title
          titleSlug
          difficulty
          topicTags {
            name
          }
        }
      }
    }
  `;

  const filters = keyword.trim() ? { searchKeywords: keyword.trim() } : {};

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      query,
      variables: {
        categorySlug: "",
        limit,
        skip: 0,
        filters,
      },
    }),
  });

  const data = await response.json();
  return data?.data?.problemsetQuestionList?.questions || [];
};

// Helper to extract expected outputs from problem HTML content
export const extractExpectedOutputs = (content) => {
  if (!content) return [];
  const outputs = [];
  const regex = /<strong>\s*Output:\s*<\/strong>\s*([\s\S]*?)(?=<strong>|Explanation|<\/pre>|$)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    let out = match[1]
      .replace(/<[^>]+>/g, "") // strip html tags
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    const firstLine = out.split("\n")[0].trim();
    if (firstLine) {
      outputs.push(firstLine);
    }
  }
  return outputs;
};

// 2. Fetch full problem details by title slug (e.g., "two-sum", "lru-cache")
export const getLeetCodeProblemDetails = async (titleSlug) => {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        exampleTestcaseList
        sampleTestCase
        topicTags {
          name
        }
        codeSnippets {
          lang
          langSlug
          code
        }
      }
    }
  `;

  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      query,
      variables: { titleSlug },
    }),
  });

  const data = await response.json();
  const problem = data?.data?.question || null;
  if (problem) {
    problem.expectedOutputs = extractExpectedOutputs(problem.content);
  }
  return problem;
};