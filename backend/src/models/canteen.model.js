// src/models/canteen.model.js
const mongoose = require("mongoose");

const canteenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Canteen name is required"],
      trim: true,
    },
    collegeName: {
      type: String,
      required: [true, "College name is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location inside campus is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Canteen unique code is required"],
      unique: true,
      lowercase: true,
      trim: true,
      // e.g., "dtu-central", "nsut-main"
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },
    openingHours: {
      type: String,
      trim: true,
      default: "8:00 AM - 8:00 PM",
    },
    bannerImage: {
      type: String,
      default: "",
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Multi-tenant search & filtering indexes
canteenSchema.index({ collegeName: 1, isOpen: 1 });
canteenSchema.index({ name: "text", collegeName: "text" });

const canteenModel = mongoose.model("Canteen", canteenSchema);

module.exports = canteenModel;
