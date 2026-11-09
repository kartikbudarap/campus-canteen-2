const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const { generateOTP } = require("../utils/generateOtp");
const otpModel = require("../models/otp.model");
const revokedRefreshTokenModel = require("../models/revoked-refresh-token.model");
const { sendOTPEmail } = require("../services/email.service");
const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

const sendVerificationOtp = async (email) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  await otpModel.findOneAndUpdate(
    { email, purpose: "EMAIL_VERIFICATION" },
    {
      $set: {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      },
    },
    { upsert: true, new: true },
  );
  await sendOTPEmail(email, otp);
};

const register = async (req, res) => {
  try {
    const { name, email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }
    await userModel.create({
      name: name,
      email: email,
      password: password,
    });

    await sendVerificationOtp(email);

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred during registration.",
    });
  }
};

const resendVerification = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await userModel.findOne({ email });
    if (!user || user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "No unverified account exists for this email",
      });
    }

    await sendVerificationOtp(user.email);
    return res.status(200).json({
      success: true,
      message: "Verification OTP sent to your email",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while sending the verification OTP.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const user = await userModel.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }
    //Verify if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    //generate JWT token for the user
    //generate a JWT token for the user after successful verification
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    //save the refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "strict", // Prevent CSRF attacks
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken: accessToken,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "An error occurred during login.",
    });
  }
};

const verifyEmail = async (req, res) => {
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
      purpose: "EMAIL_VERIFICATION",
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new one.",
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

    // OTP is correct → verify user
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.emailVerified = true;
    await user.save();

    // OTP has been used → delete it
    await otpModel.deleteOne({ _id: otpRecord._id });

    //generate a JWT token for the user after successful verification
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    //save the refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "strict", // Prevent CSRF attacks
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      accessToken: accessToken,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "An error occurred during email verification.",
    });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      let decoded;

      try {
        decoded = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET,
        );
      } catch (error) {
        decoded = null;
      }

      if (decoded?.jti && decoded.exp) {
        await revokedRefreshTokenModel.updateOne(
          { jti: decoded.jti },
          {
            $setOnInsert: {
              jti: decoded.jti,
              expiresAt: new Date(decoded.exp * 1000),
            },
          },
          { upsert: true },
        );
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "An error occurred during logout.",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (!decoded.jti) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const revokedToken = await revokedRefreshTokenModel.findOne({
      jti: decoded.jti,
    });

    if (revokedToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked",
      });
    }

    const user = await userModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been invalidated",
      });
    }
    const accessToken = generateAccessToken(user);
    return res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching the current user.",
    });
  }
};

module.exports = {
  register,
  resendVerification,
  login,
  verifyEmail,
  logout,
  refreshAccessToken,
  getCurrentUser,
};
