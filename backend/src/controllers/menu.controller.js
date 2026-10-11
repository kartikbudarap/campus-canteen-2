const foodItemModel = require("../models/foodItem.model");
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

    let imageUrl = "";
    let imagePublicId = "";

    // If an image file was attached via form-data
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadRes.url;
      imagePublicId = uploadRes.publicId;
    }

    // Save item to DB
    const foodItem = await foodItemModel.create({
      canteenId,
      name,
      description: description || "",
      price: Number(price),
      stock: Number(stock),
      category,
      image: imageUrl,
      imagePublicId,
    });

    return res.status(201).json({
      success: true,
      message: "Food item created successfully",
      foodItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating food item",
      error: error.message,
    });
  }
};

// 2. Public / Students view menu for a specific canteen
const getCanteenMenu = async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { category } = req.query;

    const filter = { canteenId };

    // Only return available items unless admin/staff is viewing
    const isStaffOrAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "canteen_staff");

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
      error: error.message,
    });
  }
};

// 3. Admin updates food item (price, stock, details, or new photo)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const foodItem = await foodItemModel.findById(id);

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Security check: Admin can ONLY update items in their OWN canteen
    if (
      req.user.role === "admin" &&
      foodItem.canteenId.toString() !== req.user.canteenId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only update menu items for your own canteen",
      });
    }

    // If a new image was uploaded, delete old one from Cloudinary first
    if (req.file) {
      if (foodItem.imagePublicId) {
        await deleteFromCloudinary(foodItem.imagePublicId);
      }
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      foodItem.image = uploadRes.url;
      foodItem.imagePublicId = uploadRes.publicId;
    }

    // Update other fields
    const fields = ["name", "description", "price", "stock", "category", "isAvailable"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        foodItem[field] =
          field === "price" || field === "stock"
            ? Number(req.body[field])
            : req.body[field];
      }
    });

    await foodItem.save();

    return res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      foodItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update menu item",
      error: error.message,
    });
  }
};

// 4. Admin deletes food item (and cleans up image from Cloudinary)
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const foodItem = await foodItemModel.findById(id);

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Security check: Admin can ONLY delete items in their OWN canteen
    if (
      req.user.role === "admin" &&
      foodItem.canteenId.toString() !== req.user.canteenId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only delete menu items for your own canteen",
      });
    }

    // Clean up Cloudinary asset
    if (foodItem.imagePublicId) {
      await deleteFromCloudinary(foodItem.imagePublicId);
    }

    await foodItemModel.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
      error: error.message,
    });
  }
};

module.exports = {
  createMenuItem,
  getCanteenMenu,
  updateMenuItem,
  deleteMenuItem,
};