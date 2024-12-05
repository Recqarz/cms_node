const mongoose = require("mongoose");

const unsavedCnrSchema = new mongoose.Schema(
  {
    cnrNumber: { type: String, required: true, unique: true },
  },
  { timestamps: false }
);

const UnsaveCnrCollection = mongoose.model("UnsavedCnrNumber", unsavedCnrSchema);

module.exports = UnsaveCnrCollection;
