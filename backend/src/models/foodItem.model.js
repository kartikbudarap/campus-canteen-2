const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
  {

    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    
    description: {
      type: String,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Price must be an integer in the smallest currency unit",
      },
    },

    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Stock must be a whole number",
      },
      default: 0,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
    },
    
    // This field will store the public ID of the image in Cloudinary, which is useful for deleting or updating the image later.
    imagePublicId: {
      type: String,
      default: "",
    },

    isAvailable: {
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
  },
);

foodItemSchema.index({ canteenId: 1, isAvailable: 1 });
foodItemSchema.index({ isAvailable: 1, category: 1 });

module.exports = mongoose.model("FoodItem", foodItemSchema);
