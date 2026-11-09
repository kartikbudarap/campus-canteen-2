const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    return next();
  }
  return authMiddleware(req, res, next);
};
const authorizeRoles = require("../middlewares/role.middleware");
const upload = require("../middlewares/upload.middleware");
const {
  createMenuItem,
  getCanteenMenu,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/menu.controller");

// Public: View a canteen's menu
router.get("/canteen/:canteenId", optionalAuth, getCanteenMenu);

// Admin: Create item with image upload
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "super_admin"),
  upload.single("image"),
  createMenuItem
);

// Admin: Update item (optionally with new image)
router.patch(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "super_admin"),
  upload.single("image"),
  updateMenuItem
);

// Admin: Delete item
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "super_admin"),
  deleteMenuItem
);

module.exports = router;
