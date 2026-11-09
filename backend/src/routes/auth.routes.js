const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const resetPasswordController = require('../controllers/reset-password.controller');
const resetPasswordMiddleware = require("../middlewares/resetPassword.middleware")
const authMiddleware = require("../middlewares/auth.middleware");
const rateLimit = require("../middlewares/rateLimit.middleware");

const loginLimit = rateLimit(20, 15 * 60 * 1000);
const emailLimit = rateLimit(5, 60 * 60 * 1000);
const otpLimit = rateLimit(10, 15 * 60 * 1000);

//register
router.post("/auth/register", emailLimit, authController.register);
router.post("/auth/resend-verification", emailLimit, authController.resendVerification);
//verify email
router.post("/auth/verify-email", otpLimit, authController.verifyEmail);
//login
router.post("/auth/login", loginLimit, authController.login);
//refresh access token
router.post("/auth/refresh-token", authController.refreshAccessToken);
//logout
router.post("/auth/logout", authController.logout);
//current authenticated user
router.get("/auth/me", authMiddleware, authController.getCurrentUser);

//password reset
router.post("/auth/forgot-password", emailLimit, resetPasswordController.forgotPassword);
router.post("/auth/verify-reset-otp", otpLimit, resetPasswordController.verifyOtp);
router.post("/auth/reset-password", otpLimit, resetPasswordMiddleware, resetPasswordController.resetPassword);



module.exports = router;
