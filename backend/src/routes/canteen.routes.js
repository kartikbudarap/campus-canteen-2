const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const {
  createCanteen,
  getAllCanteens,
  getCanteenById,
  updateCanteen,
  toggleCanteenStatus,
  deleteCanteen,
} = require("../controllers/canteen.controller");

// 1. Public Routes (Students browsing)
router.get("/", getAllCanteens);
router.get("/:id", getCanteenById);

// 2. SuperAdmin Only Routes
router.post("/", authMiddleware, authorizeRoles("super_admin"), createCanteen);
router.delete("/:id", authMiddleware, authorizeRoles("super_admin"), deleteCanteen);

// 3. Admin & SuperAdmin Routes
router.patch("/:id", authMiddleware, authorizeRoles("super_admin", "admin"), updateCanteen);

// 4. Staff, Admin & SuperAdmin Routes (Quick Kitchen Toggle)
router.patch(
  "/:id/toggle-status",
  authMiddleware,
  authorizeRoles("super_admin", "admin", "canteen_staff"),
  toggleCanteenStatus
);

module.exports = router;