const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const {
  createInvitation,
  acceptInvitation,
} = require("../controllers/invitation.controller");

// Only super_admin or admin can invite
router.post("/",authMiddleware,authorizeRoles("super_admin", "admin"),createInvitation);

// Public: invitee accepts the invite with their token
router.post("/accept", acceptInvitation);

module.exports = router;