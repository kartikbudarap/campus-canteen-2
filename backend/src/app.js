const express = require('express');
const app = express();
const authRoutes = require('./routes/auth.routes');
const cookieParser = require('cookie-parser');

//middleware
app.use(express.json());
app.use(cookieParser());

//routes    
app.use("/api",authRoutes);

module.exports = app;