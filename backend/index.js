require("dotenv").config();
const express = require("express");
const cors = require("cors");

const chatRoute = require("./routes/chat");
const analyseRoute = require("./routes/analyse");
const explainRoute = require("./routes/explain");
const reviewRoute = require("./routes/review");

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5500',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5500',
      'https://codementorai-n3b6.onrender.com',
      'https://ai-codementor.app' // Update with your actual Netlify domain
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

app.use("/api/chat", chatRoute);
app.use("/api/analyse", analyseRoute);
app.use("/api/explain", explainRoute);
app.use("/api/review", reviewRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Backend is running',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      data: '/api/data',
      chat: '/api/chat',
      analyse: '/api/analyse',
      explain: '/api/explain',
      review: '/api/review'
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
    groqKeySet: !!process.env.GROQ_API_KEY 
  });
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY not set in .env! API calls will fail.");
  } else {
    console.log("Groq API key configured.");
  }
});
