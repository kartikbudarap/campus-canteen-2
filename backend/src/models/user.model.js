const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: ["user", "super_admin", "admin", "canteen_staff"],
      default: "user",
    },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "canteen",
      default: null,
      // super_admin → null (manages entire platform)
      // admin → their college's canteen
      // canteen_staff → their college's canteen
      // user → null (they select canteen when browsing/ordering)
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    avatarPublicId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

//copied from google
// Hash password before saving
userSchema.pre("save", async function () {
  // Skip if password was not modified
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Optional: Method to compare password during login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const userModel = mongoose.model("User", userSchema);

module.exports = userModel;
