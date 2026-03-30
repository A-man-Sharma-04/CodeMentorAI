const express = require("express");
const router = express.Router();
const { chatWithAI } = require("../services/aiService");

router.post("/", async (req, res) => {
  try {
    const { message, code, language } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Valid message is required" });
    }

    const response = await chatWithAI(message, code, language);

    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Chat service failed. Check API key." });
  }
});

module.exports = router;
