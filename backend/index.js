require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const chatRoute = require("./routes/chat");
const analyseRoute = require("./routes/analyse");
const explainRoute = require("./routes/explain");
const reviewRoute = require("./routes/review");
const githubRoute = require("./routes/github");
const { exchangeCodeForToken } = require("./services/githubService");

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5500',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5500',
      'https://codementorai-n3b6.onrender.com',
      'https://ai-codementor.netlify.app/' // Update with your actual Netlify domain
    ];
    
    // Allow requests with no origin (like mobile apps, file://, or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 1 day
}));

app.use("/api/chat", chatRoute);
app.use("/api/analyse", analyseRoute);
app.use("/api/explain", explainRoute);
app.use("/api/review", reviewRoute);
app.use("/api/github", githubRoute);

// ============================================================================
// 🔐 GitHub OAuth Callback Route (matches GitHub app settings)
// ============================================================================
app.get('/auth/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Error from GitHub
  if (error) {
    console.error('❌ GitHub OAuth error:', error);
    return res.redirect(`http://localhost:5500/review.html?error=${error}`);
  }
  
  // Missing code
  if (!code) {
    console.error('❌ No authorization code received');
    return res.redirect('http://localhost:5500/review.html?error=no_code');
  }

  try {
    console.log('🔄 Exchanging code for GitHub token...');
    
    // Exchange code for access token
    await exchangeCodeForToken(code, state || req.sessionID);
    
    // Mark session as connected
    req.session.githubConnected = true;
    req.session.githubCode = code;
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
    });

    console.log('✅ GitHub OAuth successful! Redirecting to review.html');
    
    // Redirect to frontend with success status
    res.redirect('http://localhost:5500/review.html?github=connected');
  } catch (err) {
    console.error('❌ OAuth token exchange failed:', err.message);
    res.redirect(`http://localhost:5500/review.html?error=${encodeURIComponent(err.message)}`);
  }
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

