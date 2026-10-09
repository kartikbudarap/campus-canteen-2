const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const userModel = require("../src/models/user.model");
const connectDB = require("../src/config/db");

const seedSuperAdmin = async () => {
    try {
        await connectDB();

        const existing = await userModel.findOne({ role: "super_admin" });
        if (existing) {
            console.log("SuperAdmin already exists:", existing.email);
            process.exit(0);
        }

        const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = process.env;
        if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
            console.error("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env");
            process.exit(1);
        }

        const superAdmin = await userModel.create({
            name: "Super Admin",
            email: SUPERADMIN_EMAIL,
            password: SUPERADMIN_PASSWORD, // hashed automatically by your pre-save hook
            role: "super_admin",
            emailVerified: true, // no need to verify yourself
        });

        console.log("SuperAdmin created successfully:", superAdmin.email);
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error.message);
        process.exit(1);
    }
};

seedSuperAdmin();