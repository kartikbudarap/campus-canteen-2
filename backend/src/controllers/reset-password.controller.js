const { generateOTP } = require("../utils/generateOtp");
const otpModel = require("../models/otp.model");
const { sendOTPEmail } = require("../services/email.service");
const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const { generateResetToken } = require("../utils/token");
const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }
  const user = await userModel.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found, please register first",
    });
  }

  //now we need to generate a otp and send it to the user email
  const otp = generateOTP();
  //hash the otp before saving it to the database
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  await otpModel.findOneAndUpdate(
    { email, purpose: "PASSWORD_RESET" },
    { $set: { otp: hashedOtp, expiresAt: otpExpiry, attempts: 0 } },
    { upsert: true, new: true },
  );
  await sendOTPEmail(email, otp);

  return res.status(200).json({
    success: true,
    message: "OTP sent to your email, please check your inbox",
  });

  //now we need to create a route for verifying the otp and resetting the password
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }
    const otpRecord = await otpModel.findOne({
      email,
      purpose: "PASSWORD_RESET",
    });
    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "OTP not found",
      });
    }
    // Check maximum attempts
    if (otpRecord.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please request a new OTP.",
      });
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Compare entered OTP with hashed OTP
    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    // OTP is correct → generate a reset token and send it to the user
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = generateResetToken(user); // Token valid for 10 minutes
    
    // OTP has been used → delete it
    await otpModel.deleteOne({ _id: otpRecord._id });
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully, you can now reset your password",
      token: resetToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await userModel.findOneAndUpdate(
      { email: req.user.email, tokenVersion: req.user.tokenVersion },
      { $set: { password: hashedPassword }, $inc: { tokenVersion: 1 } },
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Reset token has already been used or invalidated",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  forgotPassword,
  verifyOtp,
  resetPassword,
};
