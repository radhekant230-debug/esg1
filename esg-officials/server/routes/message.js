const express = require("express");

const router = express.Router();

const { protect } = require("../middlewares/auth");

const {
  getConversations,
  getMessages,
  sendMessage,
  markMessageAsRead,
  markConversationAsRead,
} = require("../controllers/messageController");

// ==========================================
// GET ALL CONVERSATIONS
// ==========================================
router.get(
  "/conversations",
  protect,
  getConversations
);

// ==========================================
// GET MESSAGES
//
// Query:
// ?userId=USER_ID
// ?projectId=PROJECT_ID
// ==========================================
router.get(
  "/",
  protect,
  getMessages
);

// ==========================================
// SEND MESSAGE
// ==========================================
router.post(
  "/",
  protect,
  sendMessage
);

// ==========================================
// MARK CONVERSATION AS READ
// IMPORTANT: This MUST come before /:id/read
// ==========================================
router.put(
  "/conversation/read",
  protect,
  markConversationAsRead
);

// ==========================================
// MARK ONE MESSAGE AS READ
// ==========================================
router.put(
  "/:id/read",
  protect,
  markMessageAsRead
);

module.exports = router;