const mongoose = require("mongoose");

/**
 * Atomic sequence counters (used for human-readable IDs such as SA-2026-0001).
 * findOneAndUpdate with $inc is atomic, so concurrent creates never collide.
 */
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

counterSchema.statics.next = async function next(name, session) {
  const doc = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session }
  );
  return doc.seq;
};

module.exports = mongoose.models.Counter || mongoose.model("Counter", counterSchema);
