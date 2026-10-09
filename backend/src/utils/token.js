const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const generateRefreshToken = (user) => {
    const payload = {
        id: user._id,
        role: user.role,
        canteenId: user.canteenId,
        tokenVersion: user.tokenVersion,
        jti: crypto.randomUUID(),
    };
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return refreshToken;
}

const generateAccessToken = (user) => {
    const payload = {
        id: user._id,
        role: user.role,
        canteenId: user.canteenId,
        tokenVersion: user.tokenVersion,
    };
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    return accessToken;
}

const generateResetToken = (email) => {
    const payload = {
        email: email,
        purpose: 'password-reset',
    };
    const resetToken = jwt.sign(payload, process.env.RESET_PASSWORD_TOKEN_SECRET, { expiresIn: '10m' });
    return resetToken;
}


module.exports = {
    generateRefreshToken,
    generateAccessToken,
    generateResetToken
};
