const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const sendOTPEmail = async (email, otp) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Verification Code",
        text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
    });
};

const sendInvitationEmail = async (email, inviteToken, canteenName, role) => {
  // In production, this points to your frontend URL
  const inviteLink = `http://localhost:5173/accept-invite?token=${inviteToken}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Invitation to join ${canteenName} as ${role}`,
    html: `
      <h2>You've been invited!</h2>
      <p>You have been invited to join <strong>${canteenName}</strong> as <strong>${role}</strong>.</p>
      <p>Click the link below to accept the invitation and set up your password. This link is valid for 24 hours.</p>
      <a href="${inviteLink}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">Accept Invitation</a>
      <p style="margin-top:10px;">Or copy and paste this token directly: <code>${inviteToken}</code></p>
    `,
  });
};

module.exports = { sendOTPEmail, sendInvitationEmail };