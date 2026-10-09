const mongoose = require("mongoose");

const canteenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    collegeName: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // e.g., "dtu-central", "nsut-main"
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const canteenModel = mongoose.model("canteen", canteenSchema);

module.exports = canteenModel;
