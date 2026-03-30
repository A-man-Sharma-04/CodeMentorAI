require("dotenv").config();
const express = require("express");
const cors = require("cors");

const chatRoute = require("./routes/chat");
const analyseRoute = require("./routes/analyse");
const explainRoute = require("./routes/explain");
const reviewRoute = require("./routes/review");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoute);
app.use("/api/analyse", analyseRoute);
app.use("/api/explain", explainRoute);
app.use("/api/review", reviewRoute);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    groqKeySet: !!process.env.GROQ_API_KEY 
  });
});

app.listen(5500, () => {
  console.log("Server running on http://localhost:5500");
  if (!process.env.GROQ_API_KEY) {
    console.warn("WARNING: GROQ_API_KEY not set in .env! API calls will fail.");
  } else {
    console.log("Groq API key configured.");
  }
});
