const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const canteenController = require("../controllers/canteen.controller");

//only super_admin can create canteen
router.post("/",authMiddleware,authorizeRoles("super_admin"),canteenController.createCanteen);

module.exports = router;