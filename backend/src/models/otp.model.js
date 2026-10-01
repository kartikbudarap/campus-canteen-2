const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [ true, "Email is required"],
        lowercase: true,
        trim: true
    },
    purpose: {
        type: String,
        required: [true, "OTP purpose is required"],
        enum: ["EMAIL_VERIFICATION", "PASSWORD_RESET"]
    },
    otp: {
        type: String,
        required: [ true, "OTP is required"],
    },
    expiresAt: {
        type: Date,
        required: [ true, "Expiry time is required"],
    },
    attempts: {
        type: Number,
        default: 0
    }
},{timestamps: true});

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

const otpModel = mongoose.model('OTP', otpSchema);
module.exports = otpModel;