const mongoose = require("mongoose");

const revokedRefreshTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

revokedRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const revokedRefreshTokenModel = mongoose.model(
  "RevokedRefreshToken",
  revokedRefreshTokenSchema,
);

module.exports = revokedRefreshTokenModel;