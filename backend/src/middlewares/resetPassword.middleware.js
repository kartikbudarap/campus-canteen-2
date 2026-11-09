const jwt = require("jsonwebtoken");

const resetPasswordMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Reset token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.RESET_PASSWORD_TOKEN_SECRET
    );

    // Make sure this token was specifically created for password reset
    if (decoded.purpose !== "password-reset" || !Number.isInteger(decoded.tokenVersion)) {
      return res.status(403).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    // Store the identity for resetPassword controller
    req.user = {
      email: decoded.email,
      tokenVersion: decoded.tokenVersion,
    };

    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Reset token has expired. Please request a new one.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid reset token",
    });
  }
};

module.exports = resetPasswordMiddleware;
