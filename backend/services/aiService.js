require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function safeJsonParse(content, fallback = { reply: "AI service error", fix: "", improved_code: "" }) {
  try {
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function chatWithAI(message, code, language) {
  const systemPrompt = `You are a senior software engineer and mentor.

Help the user by:
- Explaining concepts clearly
- Debugging code
- Suggesting improvements
- Giving optimized solutions

Always respond in JSON:
{
  "reply": "your response",
  "fix": "suggested fix explanation",
  "improved_code": "full improved code block"
}`;

  const userPrompt = `Question: ${message}

Language: ${language || "not specified"}

Code:
\`\`\`
${code || "No code provided"}
\`\`\``;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const content = response.choices[0].message.content;
  return safeJsonParse(content);
}

async function explainCode(code, language) {
  const systemPrompt = `You are an expert code explainer.

Explain the provided code step by step:
- What it does overall
- Key functions/algorithms
- Data flow
- Potential issues/improvements

Respond in JSON:
{
  "explanation": "detailed step-by-step explanation",
  "key_concepts": ["list", "of", "concepts"],
  "improvements": "suggested enhancements"
}`;

  const userPrompt = `Explain this code:

Language: ${language || "unknown"}

\`\`\`
${code}
\`\`\``;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const content = response.choices[0].message.content;
  return safeJsonParse(content, { explanation: "Explanation unavailable", key_concepts: [], improvements: "" });
}

async function analyseCode(code, language, issue) {
  const systemPrompt = `You are an expert code debugger and analyzer.

Analyze the code for:
- Bugs/errors
- Performance issues
- Best practices violations
- Security vulnerabilities

Provide fixes.

Respond in JSON:
{
  "analysis": "detailed issues found",
  "fixes": "step-by-step fixes",
  "fixed_code": "complete corrected code"
}`;

  const userPrompt = `Analyze and fix this code. Issue reported: ${issue || "general review"}

Language: ${language || "unknown"}

\`\`\`
${code}
\`\`\``;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const content = response.choices[0].message.content;
  return safeJsonParse(content, { analysis: "Analysis unavailable", fixes: "", fixed_code: code });
}

async function reviewCode(code, language) {
  const systemPrompt = `You are an expert code reviewer and senior engineer.

Perform a comprehensive code review including:
- Code quality score (0-100)
- Issues categorized by type (bug, performance, security, style, best practices) and severity (low/medium/high/critical)
- Actionable fix suggestions
- Refactoring opportunities
- Overall architecture feedback
- Readability and maintainability assessment

Language: ${language || 'unknown'}

Respond ONLY in valid JSON format:
{
  "score": 95,
  "summary": "Overall review summary",
  "issues": [
    {
      "type": "performance",
      "severity": "medium",
      "line": 42,
      "description": "Issue description",
      "fix": "Suggested fix code or explanation"
    }
  ],
  "improvements": ["List of general improvements"],
  "reviewed_code": "Original code with inline review comments",
  "refactored_code": "Fully refactored/improved code version"
}`;

  const userPrompt = `Review this code comprehensively:

Language: ${language || "unknown"}

\`\`\`
${code}
\`\`\``;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  });

  const content = response.choices[0].message.content;
  return safeJsonParse(content, { score: 0, summary: "Review unavailable", issues: [], improvements: [], reviewed_code: code, refactored_code: code });
}

module.exports = { chatWithAI, explainCode, analyseCode, reviewCode };
