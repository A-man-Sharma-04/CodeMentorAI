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

    // Full content if JSON-like - try this first as it's most likely
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      candidates.push(trimmed);
    }

    // Raw JSON blocks - improved to handle nested structures
    let braceCount = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) start = i;
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && start !== -1) {
          const block = text.substring(start, i + 1);
          if (block.length > 20) candidates.push(block.trim());
          start = -1;
        }
      }
    }

    // Dedupe, sort largest first, top 5
    const unique = [...new Set(candidates)].sort((a, b) => b.length - a.length).slice(0, 5);
    return unique;
  }

  function cleanControlCharacters(jsonString) {
    // Ultra-aggressive cleaning: Replace ALL literal newlines, carriage returns, and tabs
    // that appear in the JSON with a space character
    // This happens BEFORE we try to parse, so we don't break the JSON structure
    
    // Strategy: Process the string to escape or remove problem characters
    let result = '';
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      const code = char.charCodeAt(0);
      
      // Allow: normal printable ASCII (32-126) and DEL (127) and high Unicode
      // Replace: control characters (0-31) and DEL (127) with space
      if (code < 32 || code === 127) {
        // These are control characters - replace with space
        result += ' ';
      } else {
        // Keep everything else as-is
        result += char;
      }
    }
    
    return result;
  }

  const candidates = extractJsonCandidates(content);
  console.log(`🔍 JSON candidates: ${candidates.length} (content: ${content.length} chars)`);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      // Step 1: Remove comments
      let cleaned = candidate
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        .trim();

      // Step 2: Remove trailing commas
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

      // Step 3: Clean unescaped control characters
      cleaned = cleanControlCharacters(cleaned);

      // Step 4: Final normalization - remove any remaining problematic whitespace
      cleaned = cleaned
        .replace(/[\n\r]+/g, ' ')  // Replace newlines with spaces
        .replace(/\t+/g, ' ')      // Replace tabs with spaces
        .replace(/  +/g, ' ')      // Collapse multiple spaces
        .trim();

      // Step 5: Parse
      const parsed = JSON.parse(cleaned);

      // Validate that it's an object
      if (typeof parsed !== 'object' || parsed === null) {
        console.log(`⏭️ Attempt ${i + 1} failed: not an object`);
        continue;
      }

      // Check if it has at least some of the expected keys
      const expectedKeys = Object.keys(fallback);
      const hasExpectedKey = expectedKeys.some(key => key in parsed);
      
      if (hasExpectedKey || expectedKeys.length === 0) {
        console.log(`✅ Parsed successfully on attempt ${i + 1}`);
        return { ...fallback, ...parsed };
      }
    } catch (e) {
      console.log(`⏭️ Attempt ${i + 1} failed: ${e.message.substring(0, 60)}`);
    }
  }

  console.error(`❌ All parse attempts (${candidates.length}) failed. Using fallback. Raw sample:`, content.substring(0, 200) + '...');
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
