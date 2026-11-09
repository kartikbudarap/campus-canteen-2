const foodItemModel = require("../models/foodItem.model");
const canteenModel = require("../models/canteen.model");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");

// 1. Admin creates food item for their canteen
const createMenuItem = async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;

    // Check required fields (stock can be 0, so check !== undefined)
    if (!name || !price || stock === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: "name, price, stock, and category are required",
      });
    }

    // Determine canteenId: College admin uses their own canteen; super_admin can specify in body
    const canteenId =
      req.user.role === "super_admin"
        ? req.body.canteenId
        : req.user.canteenId;

    if (!canteenId) {
      return res.status(400).json({
        success: false,
        message: "Canteen ID is required or admin is not bound to a canteen",
      });
    }
    if (!await canteenModel.exists({ _id: canteenId, isArchived: { $ne: true } })) {
      return res.status(404).json({ success: false, message: "Canteen not found" });
    }

    let imageUrl = "";
    let imagePublicId = "";

    // If an image file was attached via form-data
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadRes.url;
      imagePublicId = uploadRes.publicId;
    }

    // Save item to DB
    let foodItem;
    try {
      foodItem = await foodItemModel.create({
        canteenId,
        name,
        description: description || "",
        price: Number(price),
        stock: Number(stock),
        category,
        image: imageUrl,
        imagePublicId,
      });
    } catch (error) {
      if (imagePublicId) await deleteFromCloudinary(imagePublicId);
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Food item created successfully",
      foodItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating food item",
    });
  }
};

// 2. Public / Students view menu for a specific canteen
const getCanteenMenu = async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { category } = req.query;
    if (!await canteenModel.exists({ _id: canteenId, isArchived: { $ne: true } })) {
      return res.status(404).json({ success: false, message: "Canteen not found" });
    }

    const filter = { canteenId, isArchived: { $ne: true } };

    // Only return available items unless admin/staff is viewing
    const isStaffOrAdmin = req.user && (req.user.role === "super_admin" ||
      (["admin", "canteen_staff"].includes(req.user.role) &&
        String(req.user.canteenId) === String(canteenId)));

    if (!isStaffOrAdmin) {
      filter.isAvailable = true;
    }

    if (category) {
      filter.category = category;
    }

    const menu = await foodItemModel
      .find(filter)
      .sort({ category: 1, name: 1 });

    return res.status(200).json({
      success: true,
      count: menu.length,
      menu,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch menu",
    });
  }
};

// 3. Admin updates food item (price, stock, details, or new photo)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const foodItem = await foodItemModel.findOne({ _id: id, isArchived: { $ne: true } });

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }
    if (!await canteenModel.exists({ _id: foodItem.canteenId, isArchived: { $ne: true } })) {
      return res.status(404).json({ success: false, message: "Canteen not found" });
    }

    // Security check: Admin can ONLY update items in their OWN canteen
    if (
      req.user.role === "admin" &&
      foodItem.canteenId.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only update menu items for your own canteen",
      });
    }

    const fields = ["name", "description", "price", "stock", "category", "isAvailable"];
    const changes = {};

    for (const field of fields) {
      if (req.body[field] === undefined) {
        continue;
      }

      changes[field] = field === "price" || field === "stock"
        ? Number(req.body[field])
        : req.body[field];
    }

    if (changes.stock !== undefined &&
        (!Number.isSafeInteger(changes.stock) || changes.stock < 0)) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative integer",
      });
    }

    let newImagePublicId = "";
    if (req.file) {
      const uploadedImage = await uploadToCloudinary(req.file.buffer);
      changes.image = uploadedImage.url;
      changes.imagePublicId = uploadedImage.publicId;
      newImagePublicId = uploadedImage.publicId;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(200).json({
        success: true,
        message: "Menu item updated successfully",
        foodItem,
      });
    }

    let updated;
    try {
      const filter = { _id: id, isArchived: { $ne: true } };

      // If stock changed since we loaded the item, ask the admin to retry.
      if (changes.stock !== undefined) {
        filter.stock = foodItem.stock;
      }

      updated = await foodItemModel.findOneAndUpdate(
        filter,
        { $set: changes },
        { new: true, runValidators: true }
      );

      if (!updated) {
        if (newImagePublicId) {
          await deleteFromCloudinary(newImagePublicId);
        }
        return res.status(409).json({
          success: false,
          message: "Menu item changed; retry",
        });
      }
    } catch (error) {
      if (newImagePublicId) {
        await deleteFromCloudinary(newImagePublicId);
      }
      throw error;
    }

    if (newImagePublicId && foodItem.imagePublicId) {
      await deleteFromCloudinary(foodItem.imagePublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      foodItem: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update menu item",
    });
  }
};

// 4. Admin removes a food item from the menu
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const foodItem = await foodItemModel.findOne({ _id: id, isArchived: { $ne: true } });

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }
    if (!await canteenModel.exists({ _id: foodItem.canteenId, isArchived: { $ne: true } })) {
      return res.status(404).json({ success: false, message: "Canteen not found" });
    }

    // Security check: Admin can ONLY delete items in their OWN canteen
    if (
      req.user.role === "admin" &&
      foodItem.canteenId.toString() !== req.user.canteenId?.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only delete menu items for your own canteen",
      });
    }

    // Keep the item in the database because old orders may still refer to it.
    await foodItemModel.updateOne(
      { _id: id, isArchived: { $ne: true } },
      { $set: { isArchived: true, isAvailable: false } }
    );

    return res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
    });
  }
};

module.exports = {
  createMenuItem,
  getCanteenMenu,
  updateMenuItem,
  deleteMenuItem,
};
