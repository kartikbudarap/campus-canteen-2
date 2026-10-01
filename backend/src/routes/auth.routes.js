const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const resetPasswordController = require('../controllers/reset-password.controller');
const resetPasswordMiddleware = require("../middlewares/resetPassword.middleware")

//register
router.post("/auth/register", authController.register);
//verify email
router.post("/auth/verify-email", authController.verifyEmail);
//login
router.post("/auth/login", authController.login);
//refresh access token
router.post("/auth/refresh-token", authController.refreshAccessToken);
//logout
router.post("/auth/logout", authController.logout);

//password reset
router.post("/auth/forgot-password", resetPasswordController.forgotPassword);
router.post("/auth/verify-reset-otp", resetPasswordController.verifyOtp);
router.post("/auth/reset-password", resetPasswordMiddleware, resetPasswordController.resetPassword);

module.exports = router;