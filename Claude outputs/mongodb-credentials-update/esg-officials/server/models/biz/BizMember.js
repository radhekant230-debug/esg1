const mongoose = require("mongoose");
const { Schema } = mongoose;

const bizMemberSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "manager", "cashier", "staff"],
      default: "staff",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bizMemberSchema.index({ business: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("BizMember", bizMemberSchema);
