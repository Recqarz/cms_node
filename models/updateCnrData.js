const mongoose = require("mongoose");

const updateCnrDataSchema = new mongoose.Schema(
  {
    cnrNumber: { type: String, required: true, unique: true },
    cnrDetails: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const updateCnrData = mongoose.models.CnrDetails || mongoose.model('CnrDetails', updateCnrDataSchema);

module.exports = updateCnrData;
