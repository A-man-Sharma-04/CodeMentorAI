const express = require("express");
const router = express.Router();
const { analyseCode } = require("../services/aiService");

router.post("/", async (req, res) => {
  try {
    const { code, language, issue } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Valid code is required" });
    }

    const response = await analyseCode(code, language, issue);

    res.json(response);
  } catch (err) {
    console.error("Analyse error:", err);
    res.status(500).json({ error: "Analyse service failed. Check API key." });
  }
});

module.exports = router;
