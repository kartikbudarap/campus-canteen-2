const foodItemModel = require("../models/foodItem.model");
const canteenModel = require("../models/canteen.model");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");

// Admin creates food item for their canteen
const createMenuItem = async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;

    if (!name || !price || stock === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: "name, price, stock, and category are required",
      });
    }

    // Determine canteenId: College admin uses their own canteen
    const canteenId = req.user.role === "super_admin" 
      ? req.body.canteenId 
      : req.user.canteenId;

    if (!canteenId) {
      return res.status(400).json({
        success: false,
        message: "canteenId is required",
      });
    }

    let imageUrl = "";
    let imagePublicId = "";

    // If an image was uploaded via multipart/form-data
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadRes.url;
      imagePublicId = uploadRes.publicId;
    }

    const foodItem = await foodItemModel.create({
      canteenId,
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      category,
      image: imageUrl,
      imagePublicId,
    });

    return res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      foodItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create menu item",
      error: error.message,
    });
  }
};

// Public: Get menu of a specific canteen
const getCanteenMenu = async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { category } = req.query;

    const filter = { canteenId };
    
    // Only return available items unless staff/admin is viewing
    const isStaffOrAdmin = req.user && (req.user.role === "admin" || req.user.role === "canteen_staff");
    if (!isStaffOrAdmin) {
      filter.isAvailable = true;
    }

    if (category) {
      filter.category = category;
    }

    const menu = await foodItemModel.find(filter).sort({ category: 1, name: 1 });

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

// Admin updates a food item (price, stock, details, or new photo)
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

    // Security check: Admin can only update items in their OWN canteen
    if (req.user.role === "admin" && foodItem.canteenId.toString() !== req.user.canteenId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update menu items for your own canteen",
      });
    }

    // If new image uploaded, remove old image from Cloudinary and upload new
    if (req.file) {
      if (foodItem.imagePublicId) {
        await deleteFromCloudinary(foodItem.imagePublicId);
      }
      const uploadRes = await uploadToCloudinary(req.file.buffer);
      foodItem.image = uploadRes.url;
      foodItem.imagePublicId = uploadRes.publicId;
    }

    const fields = ["name", "description", "price", "stock", "category", "isAvailable"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        foodItem[field] = field === "price" || field === "stock" ? Number(req.body[field]) : req.body[field];
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

// Admin deletes a food item
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

    // Security check: Admin can only delete items in their OWN canteen
    if (req.user.role === "admin" && foodItem.canteenId.toString() !== req.user.canteenId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete menu items for your own canteen",
      });
    }

    // Clean up image from Cloudinary
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