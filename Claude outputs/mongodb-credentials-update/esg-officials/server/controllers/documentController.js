const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");
const Document = require("../models/Document");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");

// Upload a buffer to Cloudinary and return { url, publicId }
function uploadToCloudinary(buffer, originalname, mimetype) {
    return new Promise((resolve, reject) => {
        const resourceType = mimetype.startsWith("image/") ? "image" : "raw";

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "esg-documents",
                resource_type: resourceType,
                use_filename: true,
                unique_filename: true,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
}

// ==========================================
// GET ALL DOCUMENTS
// Admin → All | Manager → Assigned projects | Client → Own projects
// ==========================================
exports.getAllDocuments = async (req, res) => {
    try {
        const filters = {};

        if (req.user.role === "manager") {
            const projects = await Project.find({ assignedManager: req.user.id }).select("_id");
            filters.project = { $in: projects.map((p) => p._id) };
        }

        if (req.user.role === "client") {
            const projects = await Project.find({ client: req.user.id }).select("_id");
            filters.project = { $in: projects.map((p) => p._id) };
        }

        if (req.query.project) {
            if (filters.project) {
                const allowed = await Project.find({
                    _id: req.query.project,
                    ...(req.user.role === "manager"
                        ? { assignedManager: req.user.id }
                        : req.user.role === "client"
                        ? { client: req.user.id }
                        : {}),
                });
                if (!allowed.length) {
                    return res.status(403).json({ message: "You are not authorized to access this project" });
                }
            }
            filters.project = req.query.project;
        }

        if (req.query.task) {
            filters.task = req.query.task;
        }

        const documents = await Document.find(filters)
            .populate("project", "projectId name client assignedManager")
            .populate("task", "taskId title")
            .populate("uploadedBy", "name email role")
            .sort({ createdAt: -1 });

        res.json(documents);
    } catch (error) {
        console.error("Get Documents Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ==========================================
// GET DOCUMENT BY ID
// ==========================================
exports.getDocumentById = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id)
            .populate("project", "projectId name client assignedManager")
            .populate("task", "taskId title")
            .populate("uploadedBy", "name email role");

        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        const project = await Project.findById(document.project._id);
        if (!project) {
            return res.status(404).json({ message: "Associated project not found" });
        }

        if (req.user.role === "client" && project.client.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "You are not authorized to access this document" });
        }

        if (
            req.user.role === "manager" &&
            (!project.assignedManager || project.assignedManager.toString() !== req.user.id.toString())
        ) {
            return res.status(403).json({ message: "You are not authorized to access this document" });
        }

        res.json(document);
    } catch (error) {
        console.error("Get Document Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ==========================================
// UPLOAD / CREATE DOCUMENT
// Accepts multipart/form-data (file) or JSON (pre-hosted url)
// Admin / Manager only
// ==========================================
exports.createDocument = async (req, res) => {
    try {
        const { project, task, name, description } = req.body;
        let { url, publicId, fileType, fileSize } = req.body;

        if (!project || !name) {
            return res.status(400).json({ message: "Project and document name are required" });
        }

        // Handle real file upload via multer
        if (req.file) {
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
                return res.status(503).json({
                    message: "File upload is not configured. Set Cloudinary credentials in the server .env file.",
                });
            }

            const uploaded = await uploadToCloudinary(req.file.buffer, req.file.originalname, req.file.mimetype);
            url = uploaded.url;
            publicId = uploaded.publicId;
            fileType = req.file.mimetype;
            fileSize = req.file.size;
        }

        if (!url) {
            return res.status(400).json({ message: "A file or URL is required" });
        }

        const projectData = await Project.findById(project);
        if (!projectData) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (
            req.user.role === "manager" &&
            (!projectData.assignedManager || projectData.assignedManager.toString() !== req.user.id.toString())
        ) {
            return res.status(403).json({ message: "You can only upload documents to projects assigned to you" });
        }

        if (task) {
            const taskData = await Task.findOne({ _id: task, project });
            if (!taskData) {
                return res.status(404).json({ message: "Task not found in this project" });
            }
        }

        const document = await Document.create({
            project,
            task: task || null,
            uploadedBy: req.user.id,
            name,
            url,
            publicId: publicId || "",
            fileType: fileType || "",
            fileSize: fileSize || 0,
            description: description || "",
        });

        await Notification.create({
            recipient: projectData.client,
            type: "document",
            title: "New Document Uploaded",
            message: `"${name}" has been uploaded to your project.`,
            project,
            task: task || null,
        });

        await ActivityLog.create({
            user: req.user.id,
            action: "UPLOAD_DOCUMENT",
            entityType: "Document",
            entityId: document._id,
            description: `Uploaded document "${name}".`,
            metadata: { project, task: task || null },
        });

        const populated = await Document.findById(document._id)
            .populate("project", "projectId name client assignedManager")
            .populate("task", "taskId title")
            .populate("uploadedBy", "name email role");

        res.status(201).json({ message: "Document uploaded successfully", document: populated });
    } catch (error) {
        console.error("Create Document Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ==========================================
// UPDATE DOCUMENT DETAILS
// Admin / Manager (assigned project)
// ==========================================
exports.updateDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        if (req.user.role === "client") {
            return res.status(403).json({ message: "Clients cannot modify documents" });
        }

        const project = await Project.findById(document.project);
        if (!project) {
            return res.status(404).json({ message: "Associated project not found" });
        }

        if (
            req.user.role === "manager" &&
            (!project.assignedManager || project.assignedManager.toString() !== req.user.id.toString())
        ) {
            return res.status(403).json({ message: "You are not authorized to modify this document" });
        }

        const allowedFields = ["name", "description", "url", "publicId", "fileType", "fileSize"];
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) document[field] = req.body[field];
        });

        await document.save();

        await Notification.create({
            recipient: project.client,
            type: "document",
            title: "Document Updated",
            message: `Document "${document.name}" has been updated.`,
            project: project._id,
            task: document.task || null,
        });

        await ActivityLog.create({
            user: req.user.id,
            action: "UPDATE_DOCUMENT",
            entityType: "Document",
            entityId: document._id,
            description: `Updated document "${document.name}".`,
            metadata: req.body,
        });

        const updated = await Document.findById(document._id)
            .populate("project", "projectId name client assignedManager")
            .populate("task", "taskId title")
            .populate("uploadedBy", "name email role");

        res.json({ message: "Document updated successfully", document: updated });
    } catch (error) {
        console.error("Update Document Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

// ==========================================
// DELETE DOCUMENT (+ Cloudinary asset cleanup)
// Admin / Manager (assigned project)
// ==========================================
exports.deleteDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        const project = await Project.findById(document.project);
        if (!project) {
            return res.status(404).json({ message: "Associated project not found" });
        }

        if (req.user.role === "client") {
            return res.status(403).json({ message: "Clients cannot delete documents" });
        }

        if (
            req.user.role === "manager" &&
            (!project.assignedManager || project.assignedManager.toString() !== req.user.id.toString())
        ) {
            return res.status(403).json({ message: "You are not authorized to delete this document" });
        }

        // Remove file from Cloudinary if it was uploaded there
        if (document.publicId && process.env.CLOUDINARY_CLOUD_NAME) {
            const resourceType = (document.fileType || "").startsWith("image/") ? "image" : "raw";
            try {
                await cloudinary.uploader.destroy(document.publicId, { resource_type: resourceType });
            } catch (cloudErr) {
                console.error("Cloudinary deletion failed (non-fatal):", cloudErr.message);
            }
        }

        await Document.findByIdAndDelete(document._id);

        await ActivityLog.create({
            user: req.user.id,
            action: "DELETE_DOCUMENT",
            entityType: "Document",
            entityId: document._id,
            description: `Deleted document "${document.name}".`,
            metadata: { project: document.project, task: document.task || null },
        });

        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        console.error("Delete Document Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
