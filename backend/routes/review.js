const express = require("express");
const router = express.Router();
const { reviewCode } = require("../services/aiService");

router.post("/", async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Valid code is required" });
    }

    const response = await reviewCode(code, language);

    res.json(response);
  } catch (err) {
    console.error("Review error:", err);
    res.status(500).json({ error: "Review service failed. Check API key." });
  }
});

module.exports = router;
