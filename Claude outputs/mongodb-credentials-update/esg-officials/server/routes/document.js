const express = require("express");
const router = express.Router();
const { protect, adminOrManager } = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const {
    getAllDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
} = require("../controllers/documentController");

router.get("/", protect, getAllDocuments);
router.get("/:id", protect, getDocumentById);

// Accept either a real file upload (field name: "file") or a plain JSON body with a url string
router.post("/", protect, adminOrManager, upload.single("file"), createDocument);

router.put("/:id", protect, adminOrManager, updateDocument);
router.delete("/:id", protect, adminOrManager, deleteDocument);

module.exports = router;
