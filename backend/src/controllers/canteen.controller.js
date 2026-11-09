const canteenModel = require("../models/canteen.model");
const mongoose = require("mongoose");

// Treat search text as plain text, not as a regular expression from the user.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePage = (value, fallback, max) => {
  if (value === undefined) {
    return fallback;
  }
  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    return null;
  }
  return number;
};

const ownCanteenFilter = (req, id) => {
  const filter = { _id: id, isArchived: { $ne: true } };
  if (req.user.role !== "super_admin") {
    filter._id = req.user.canteenId;
  }
  return filter;
};

// 1. SuperAdmin: Create a new canteen
const createCanteen = async (req, res, next) => {
  try {
    const {
      name, collegeName, location, code,
      description, contactPhone, openingHours,
    } = req.body;

    const requiredFields = [name, collegeName, location, code];
    const hasMissingField = requiredFields.some(
      (value) => typeof value !== "string" || !value.trim()
    );
    if (hasMissingField) {
      return res.status(400).json({
        success: false,
        message: "name, collegeName, location, and code are required",
      });
    }

    const normalizedCode = code.toLowerCase().trim();
    const existingCanteen = await canteenModel.findOne({ code: normalizedCode });
    if (existingCanteen) {
      return res.status(400).json({
        success: false,
        message: "Canteen with this unique code already exists",
      });
    }

    const newCanteen = await canteenModel.create({
      name,
      collegeName,
      location,
      code: normalizedCode,
      description: description || "",
      contactPhone: contactPhone || "",
      openingHours: openingHours || "8:00 AM - 8:00 PM",
    });

    return res.status(201).json({
      success: true,
      message: "Canteen created successfully",
      canteen: newCanteen,
    });
  } catch (err) {
    next(err);
  }
};

// 2. Public / Students: Get all canteens (with search, college filter, pagination)
const getAllCanteens = async (req, res, next) => {
  try {
    const { search, collegeName, isOpen, page = 1, limit = 10 } = req.query;

    const filter = { isArchived: { $ne: true } };
    const pageNumber = parsePage(page, 1, 1000000);
    const limitNumber = parsePage(limit, 10, 50);
    const invalidOpenFilter = isOpen !== undefined && isOpen !== "true" && isOpen !== "false";
    const invalidSearch = search !== undefined &&
      (typeof search !== "string" || search.length > 80);
    const invalidCollege = collegeName !== undefined &&
      (typeof collegeName !== "string" || collegeName.length > 80);

    if (!pageNumber || !limitNumber || invalidOpenFilter || invalidSearch || invalidCollege) {
      return res.status(400).json({
        success: false,
        message: "Invalid search or pagination parameters",
      });
    }

    if (isOpen !== undefined) {
      filter.isOpen = isOpen === "true";
    }

    if (collegeName) {
      filter.collegeName = { $regex: escapeRegex(collegeName), $options: "i" };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { collegeName: { $regex: escapeRegex(search), $options: "i" } },
        { code: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [canteens, total] = await Promise.all([
      canteenModel.find(filter).sort({ isOpen: -1, collegeName: 1, name: 1 }).skip(skip).limit(limitNumber),
      canteenModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      count: canteens.length,
      canteens,
    });
  } catch (err) {
    next(err);
  }
};

// 3. Public: Get a single canteen by ID or unique code
const getCanteenById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Support lookup by MongoDB _id or canteen unique code
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let canteen;
    if (isObjectId) {
      canteen = await canteenModel.findOne({ _id: id, isArchived: { $ne: true } });
    } else {
      canteen = await canteenModel.findOne({
        code: id.toLowerCase().trim(),
        isArchived: { $ne: true },
      });
    }

    if (!canteen) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }

    return res.status(200).json({
      success: true,
      canteen,
    });
  } catch (err) {
    next(err);
  }
};

// 4. Admin / SuperAdmin: Update canteen profile details
const updateCanteen = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }
    const canteen = await canteenModel.findOne({ _id: id, isArchived: { $ne: true } });

    if (!canteen) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }

    // Role Guard: College Admin can ONLY update their own canteen
    if (req.user.role === "admin" && canteen._id.toString() !== req.user.canteenId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only update your own canteen",
      });
    }

    const allowedFields = [
      "name", "collegeName", "location", "description",
      "contactPhone", "openingHours", "isOpen",
    ];
    const changes = {};

    for (const field of allowedFields) {
      const value = req.body[field];
      if (value === undefined) {
        continue;
      }

      if (field === "isOpen") {
        if (typeof value !== "boolean") {
          return res.status(400).json({ success: false, message: "isOpen must be a boolean" });
        }
      } else if (typeof value !== "string" || value.length > 300) {
        return res.status(400).json({ success: false, message: `Invalid ${field}` });
      }

      changes[field] = value;
    }

    const updated = await canteenModel.findOneAndUpdate(
      ownCanteenFilter(req, id),
      { $set: changes },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "Canteen changed; retry" });
    }

    return res.status(200).json({
      success: true,
      message: "Canteen updated successfully",
      canteen: updated,
    });
  } catch (err) {
    next(err);
  }
};

// 5. Staff / Admin / SuperAdmin: Quick Toggle Open/Closed Status
const toggleCanteenStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof req.body.isOpen !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isOpen must be a boolean",
      });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }
    const canteen = await canteenModel.findOne({ _id: id, isArchived: { $ne: true } });

    if (!canteen) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }

    // Role Guard: Admin and Staff can only toggle their own canteen
    if (
      (req.user.role === "admin" || req.user.role === "canteen_staff") &&
      canteen._id.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only toggle status for your assigned canteen",
      });
    }

    const updated = await canteenModel.findOneAndUpdate(
      ownCanteenFilter(req, id),
      { $set: { isOpen: req.body.isOpen } },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "Canteen changed; retry" });
    }

    return res.status(200).json({
      success: true,
      message: `Canteen is now ${updated.isOpen ? "OPEN for orders" : "CLOSED"}`,
      isOpen: updated.isOpen,
    });
  } catch (err) {
    next(err);
  }
};

// 6. SuperAdmin: Archive a canteen so its old data stays available for records
const deleteCanteen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const canteen = await canteenModel.findOneAndUpdate(
      { _id: id, isArchived: { $ne: true } },
      { $set: { isArchived: true, isOpen: false } },
      { new: true }
    );

    if (!canteen) {
      return res.status(404).json({
        success: false,
        message: "Canteen not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Canteen archived successfully",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createCanteen,
  getAllCanteens,
  getCanteenById,
  updateCanteen,
  toggleCanteenStatus,
  deleteCanteen,
};
