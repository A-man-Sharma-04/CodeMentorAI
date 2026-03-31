require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

async function safeJsonParse(content, fallback) {
  function extractJsonCandidates(text) {
    const candidates = [];

    // ```json ... ```
    let m = text.match(/```json\s*\n([\s\S]*?)\n\s*```/i);
    if (m && m[1]) candidates.push(m[1].trim());

    // ``` ... ```
    m = text.match(/```\s*\n([\s\S]*?)\n\s*```/i);
    if (m && m[1]) candidates.push(m[1].trim());

    // Raw JSON blocks
    let blocks = text.match(/\{[\s\S]*?\}/g);
    if (blocks) {
      blocks.filter(b => b.length > 20).forEach(b => candidates.push(b.trim()));
    }

    // Full content if JSON-like
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      candidates.push(trimmed);
    }

    // Dedupe, sort largest first, top 3
    const unique = [...new Set(candidates)].sort((a, b) => b.length - a.length).slice(0, 3);
    return unique;
  }

  const candidates = extractJsonCandidates(content);
  console.log(`🔍 JSON candidates: ${candidates.length} (content: ${content.length} chars)`);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      // Robust cleaning
      let cleaned = candidate
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') // comments
        .replace(/\s+/g, ' ')
        .replace(/,\s*([}\]])/g, '$1') // trailing commas
        .trim();

      const parsed = JSON.parse(cleaned);

      // Quick schema check - must have some expected fields from fallback
      if (Object.keys(fallback).some(key => parsed.hasOwnProperty(key))) {
        console.log(`✅ Parsed successfully on attempt ${i + 1}`);
        return parsed;
      }
    } catch (e) {
      console.log(`⏭️ Attempt ${i + 1} failed: ${e.message.substring(0, 50)}`);
    }
  }

  console.error(`❌ All parse attempts (${candidates.length}) failed. Raw sample:`, content.substring(0, 200) + '...');
  return fallback;
}

// ... (all other functions unchanged, with safeJsonParse(content, fallback) calls - chatWithAI, explainCode, analyseCode, reviewCode as before)

async function chatWithAI(message, code, language) {
  const systemPrompt = `You are a senior software engineer and mentor.

Help the user by:
- Explaining concepts clearly
- Debugging code
- Suggesting improvements
- Giving optimized solutions

IMPORTANT: Return ONLY valid JSON (no markdown, no code blocks, no extra text):
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

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const content = response.choices[0].message.content;
    return safeJsonParse(content, { reply: "AI service error", fix: "", improved_code: "" });
  } catch (error) {
    console.error("Groq API error:", JSON.stringify({ 
      message: error.message, 
      status: error.status, 
      timestamp: new Date().toISOString(),
      response: error.response?.data || error.response 
    }, null, 2));
    if (error.status === 401) {
      throw new Error("401 Incorrect API key. Check GROQ_API_KEY (should start with gsk_) in .env");
    }
    throw new Error(`AI service failed: ${error.message}`);
  }
}

async function explainCode(code, language) {
  const systemPrompt = `You are an expert code explainer.

Explain the provided code step by step:
- What it does overall
- Key functions/algorithms
- Data flow
- Potential issues/improvements

IMPORTANT: Return ONLY valid JSON (no markdown, no code blocks, no extra text):
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

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const content = response.choices[0].message.content;
    return safeJsonParse(content, { explanation: "Explanation unavailable", key_concepts: [], improvements: "" });
  } catch (error) {
    console.error("Groq API error:", JSON.stringify({ 
      message: error.message, 
      status: error.status, 
      timestamp: new Date().toISOString(),
      response: error.response?.data || error.response 
    }, null, 2));
    if (error.status === 401) {
      throw new Error("401 Incorrect API key. Check GROQ_API_KEY (should start with gsk_) in .env");
    }
    throw new Error(`AI service failed: ${error.message}`);
  }
}

async function analyseCode(code, language, issue) {
  const systemPrompt = `You are an expert code debugger and analyzer.

Analyze the code for:
- Bugs/errors
- Performance issues
- Best practices violations
- Security vulnerabilities

Provide fixes.

IMPORTANT: Return ONLY valid JSON (no markdown, no code blocks, no extra text):
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

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const content = response.choices[0].message.content;
    return safeJsonParse(content, { analysis: "Analysis unavailable", fixes: "", fixed_code: code });
  } catch (error) {
    console.error("Groq API error:", JSON.stringify({ 
      message: error.message, 
      status: error.status, 
      timestamp: new Date().toISOString(),
      response: error.response?.data || error.response 
    }, null, 2));
    if (error.status === 401) {
      throw new Error("401 Incorrect API key. Check GROQ_API_KEY (should start with gsk_) in .env");
    }
    throw new Error(`AI service failed: ${error.message}`);
  }
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

IMPORTANT: Return ONLY valid JSON (no markdown, no code blocks, no extra text):
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

  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const content = response.choices[0].message.content;
    return safeJsonParse(content, { score: 0, summary: "Review unavailable", issues: [], improvements: [], reviewed_code: code, refactored_code: code });
  } catch (error) {
    console.error("Groq API error:", JSON.stringify({ 
      message: error.message, 
      status: error.status, 
      timestamp: new Date().toISOString(),
      response: error.response?.data || error.response 
    }, null, 2));
    if (error.status === 401) {
      throw new Error("401 Incorrect API key. Check GROQ_API_KEY (should start with gsk_) in .env");
    }
    throw new Error(`AI service failed: ${error.message}`);
  }
}

module.exports = { chatWithAI, explainCode, analyseCode, reviewCode };
