const crypto = require("crypto");
const mongoose = require("mongoose");
const invitationModel = require("../models/invitation.model");
const userModel = require("../models/user.model");
const canteenModel = require("../models/canteen.model");
const { sendInvitationEmail } = require("../services/email.service");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const createInvitation = async (req, res) => {
  try {
    const { role, canteenId } = req.body;
    const email = typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email and role are required",
      });
    }
    let targetCanteenId = canteenId;
    // Enforce role boundaries
    if (req.user.role === "admin") {
      // College admin can ONLY invite staff to their OWN canteen
      if (role !== "canteen_staff") {
        return res.status(403).json({
          success: false,
          message: "College admins can only invite canteen_staff",
        });
      }
      targetCanteenId = req.user.canteenId;
    } else if (req.user.role === "super_admin") {
      // SuperAdmin must specify which canteen they are inviting for
      if (!targetCanteenId) {
        return res.status(400).json({
          success: false,
          message: "canteenId is required when inviting as super_admin",
        });
      }
    }
    // Verify canteen exists
    const canteen = await canteenModel.findOne({ _id: targetCanteenId, isArchived: { $ne: true } });
    if (!canteen) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }
    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    // Check if active pending invite exists
    await invitationModel.updateMany(
      { email, status: "pending", expiresAt: { $lte: new Date() } },
      { $set: { status: "expired" } }
    );
    const existingInvite = await invitationModel.findOne({
      email,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message: "An active invitation has already been sent to this email",
      });
    }
    // Generate secure token (64 hex characters) and 24h expiration
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const invitation = await invitationModel.create({
      email,
      role,
      canteenId: targetCanteenId,
      token,
      expiresAt,
    });
    // Send email
    try {
      await sendInvitationEmail(email, token, canteen.name, role);
    } catch (error) {
      await invitationModel.deleteOne({ _id: invitation._id });
      throw error;
    }
    return res.status(201).json({
      success: true,
      message: `Invitation sent successfully to ${email}`,
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        canteenId: invitation.canteenId,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message: error.code === 11000 ? "An active invitation already exists" : "Failed to send invitation",
    });
  }
};
const acceptInvitation = async (req, res) => {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "Token, name, and password are required",
      });
    }
    let newUser;
    await mongoose.connection.transaction(async (session) => {
      // Claim the invite and create the account together.
      const invitation = await invitationModel.findOneAndUpdate(
        { token, status: "pending", expiresAt: { $gt: new Date() } },
        { $set: { status: "accepted" } },
        { new: true, session }
      );

      if (!invitation) {
        const error = new Error("Invalid, expired, or already used invitation token");
        error.status = 400;
        throw error;
      }

      const canteen = await canteenModel.exists({
        _id: invitation.canteenId,
        isArchived: { $ne: true },
      }).session(session);
      if (!canteen) {
        const error = new Error("Canteen is unavailable");
        error.status = 400;
        throw error;
      }

      [newUser] = await userModel.create([{
        name,
        email: invitation.email,
        password,
        role: invitation.role,
        canteenId: invitation.canteenId,
        emailVerified: true,
      }], { session });
    });
    // Auto-login: generate tokens (canteenId will be included)
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(201).json({
      success: true,
      message: "Account created and invitation accepted successfully",
      accessToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        canteenId: newUser.canteenId,
      },
    });
  } catch (error) {
    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
      success: false,
      message: error.status ? error.message : "Failed to accept invitation",
    });
  }
};
module.exports = {
  createInvitation,
  acceptInvitation,
};
