/**
 * Stores original uploaded spreadsheets in MongoDB GridFS (bucket
 * "salesImportFiles"). Files stay private: they are only streamed back through
 * an authenticated, permission-checked API route — never a public URL — and no
 * extra cloud credentials are needed. The structured, validated rows are saved
 * separately as SalesRecord documents; the file is kept as an attachment for
 * the import history and audits.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");

const BUCKET = "salesImportFiles";

function bucket() {
  if (!mongoose.connection || !mongoose.connection.db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

const safeName = (name) =>
  String(name || "upload")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .slice(0, 180);

/** Saves a buffer; resolves { fileId, filename, size, mimeType, sha256 } */
function saveFile(buffer, { filename, mimeType, uploadedBy, importJobId }) {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const name = safeName(filename);
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(name, {
      contentType: mimeType,
      metadata: { uploadedBy: uploadedBy ? String(uploadedBy) : null, importJobId: importJobId ? String(importJobId) : null, sha256 },
    });
    stream.once("error", reject);
    stream.once("finish", () => resolve({ fileId: stream.id, filename: name, size: buffer.length, mimeType, sha256 }));
    stream.end(buffer);
  });
}

/** Streams a stored file to an Express response. */
async function streamFile(fileId, res, { downloadName, mimeType } = {}) {
  const id = typeof fileId === "string" ? new mongoose.Types.ObjectId(fileId) : fileId;
  const files = await bucket().find({ _id: id }).limit(1).toArray();
  if (!files.length) {
    const e = new Error("The original file is no longer available.");
    e.status = 404;
    throw e;
  }
  res.setHeader("Content-Type", mimeType || files[0].contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName(downloadName || files[0].filename)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  await new Promise((resolve, reject) => {
    bucket().openDownloadStream(id).once("error", reject).once("end", resolve).pipe(res);
  });
}

async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    await bucket().delete(typeof fileId === "string" ? new mongoose.Types.ObjectId(fileId) : fileId);
  } catch (err) {
    if (!/FileNotFound|not found/i.test(err.message || "")) throw err;
  }
}

module.exports = { saveFile, streamFile, deleteFile, BUCKET };
