const express = require("express");
const router = express.Router();
const settings = require("../controllers/plannerSettingsController");

// Meta webhook verification + delivery status callbacks (no JWT; signature-checked)
router.get("/", settings.webhookVerify);
router.post("/", settings.webhookReceive);

module.exports = router;
