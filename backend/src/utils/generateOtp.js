const crypto = require('crypto');

/**
 * Generates a secure, random numeric OTP.
 * @param {number} length - The length of the OTP (default is 6)
 * @returns {string} The generated OTP
 */
const generateOTP = (length = 6) => {
  // Generates cryptographically strong random numbers
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }
  
  return otp;
};

module.exports = {generateOTP};
