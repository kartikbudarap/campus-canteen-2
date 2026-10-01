const jwt = require('jsonwebtoken');
const userModel = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
    try{
        const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
        if(!token){
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await userModel.findById(decoded.id).select("-password");
        if(!user){
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }
        if (decoded.tokenVersion !== user.tokenVersion) {
            return res.status(401).json({
                success: false,
                message: "Session has been invalidated",
            });
        }
        req.user = user; // attach user to request object, what is this for? ans: This allows subsequent middleware or route handlers to access the authenticated user's information without needing to query the database again.
        next();
    }
    catch(err){
        console.log(err);
        return res.status(401).json({
            success: false,
            message: "Invalid token"
        });
    }
}

module.exports = authMiddleware;
