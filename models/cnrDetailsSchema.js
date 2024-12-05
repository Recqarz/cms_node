const mongoose = require("mongoose");

const cnrDetailsSchema = new mongoose.Schema(
  {
    cnrNumber: { type: String, required: true, unique: true },
    cnrDetails: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    userID: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true,
    },
  },
  { timestamps: false }
);

const cnrDetailsCollection = mongoose.model("CnrDetails", cnrDetailsSchema);

module.exports = cnrDetailsCollection;
