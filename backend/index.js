require("dotenv").config();

// Validate required environment variables
function validateEnvironment() {
  const required = ['GROQ_API_KEY'];
  const optional = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }
  
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn('⚠️ WARNING: Missing optional environment variables:');
    missingOptional.forEach(key => console.warn(`  - ${key} (GitHub features disabled)`));
  }
}

validateEnvironment();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const rateLimit = require("express-rate-limit");

const chatRoute = require("./routes/chat");
const analyseRoute = require("./routes/analyse");
const explainRoute = require("./routes/explain");
const reviewRoute = require("./routes/review");
const githubRoute = require("./routes/github");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim()).filter(Boolean)
  : [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]);

app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server calls or tools with no Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));
app.use(cookieParser());
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  console.error('❌ FATAL: SESSION_SECRET must be set in production.');
  process.exit(1);
}

const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret';

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET not set. Using development fallback secret.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use("/api/chat", chatRoute);
app.use("/api/analyse", analyseRoute);
app.use("/api/explain", explainRoute);
app.use("/api/review", reviewRoute);
app.use("/api/github", githubRoute);

app.get('/auth/github', (req, res) => {
  res.redirect('/api/github/oauth');
});


app.get('/auth/github/callback', async (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  const callbackPath = query ? `/api/github/callback?${query}` : '/api/github/callback';
  res.redirect(callbackPath);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Backend is running with GitHub integration!',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      data: '/api/data',
      chat: '/api/chat',
      analyse: '/api/analyse',
      explain: '/api/explain',
      review: '/api/review',
      github: '/api/github'
    }
  });
});

// Example API route for testing
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    message: 'Example API endpoint',
    data: {
      timestamp: new Date().toISOString(),
      sampleData: [
        { id: 1, name: 'Sample Item 1' },
        { id: 2, name: 'Sample Item 2' },
        { id: 3, name: 'Sample Item 3' }
      ]
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    groqKeySet: !!process.env.GROQ_API_KEY,
    githubConfig: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
  });
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
  console.log('🧠 AI Endpoints: /api/chat, /api/review, /api/analyse, /api/explain');
  console.log('🔗 GitHub: /api/github/oauth, /api/github/repos, /api/github/analyze-file');
  if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY not set in .env! AI calls will fail.");
  } else {
    console.log("✅ Groq AI configured.");
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("WARNING: GITHUB_CLIENT_ID/SECRET not set! GitHub features disabled.");
  } else {
    console.log("✅ GitHub OAuth configured.");
  }
});

