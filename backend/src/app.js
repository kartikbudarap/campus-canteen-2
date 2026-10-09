const express = require('express');
const app = express();
const authRoutes = require('./routes/auth.routes');
const canteenRoutes = require('./routes/canteen.routes');
const invitationRoutes = require('./routes/invitation.routes');
const cookieParser = require('cookie-parser');


//middleware
app.use(express.json());
app.use(cookieParser());

//routes    
app.use("/api",authRoutes);
app.use("/api/canteens",canteenRoutes);
app.use("/api/invitations",invitationRoutes);

module.exports = app;