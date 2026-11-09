const canteenModel = require("../models/canteen.model");

const createCanteen = async (req,res) => {
    try{
        const {name , collegeName, location, code} = req.body;
        if(!name || !collegeName || !location || !code){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }
        //check if canteen with same code already exists
        const existingCanteen = await canteenModel.findOne({
            code
        });

        if(existingCanteen){
            return res.status(400).json({
                success: false,
                message: "Canteen with this code already exists"
            });
        }

        const newCanteen = await canteenModel.create({
            name,
            collegeName,
            location,
            code
        });

        return res.status(201).json({
            success: true,
            message: "Canteen created successfully",
            data: newCanteen
        });
    }
    catch(err){
        return res.status(500).json({
            success: false,
            message: "An error occurred while creating the canteen.",
        });
    }
}

module.exports = {
    createCanteen
}
