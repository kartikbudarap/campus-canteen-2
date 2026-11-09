const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth.routes");
const canteenRoutes = require("./routes/canteen.routes");
const invitationRoutes = require("./routes/invitation.routes");
const menuRoutes = require("./routes/menu.routes");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isSafeInteger(hops) || hops < 0) throw new Error("Invalid TRUST_PROXY_HOPS");
  app.set("trust proxy", hops);
}

// 1. CORS Configuration (Allows frontend React app with cookies)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. API Routes
app.use("/api", authRoutes);
app.use("/api/canteens", canteenRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/menu", menuRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Campus Canteen API is healthy" });
});
app.get("/ready", (req, res) => {
  const ready = mongoose.connection.readyState === 1 && !app.locals.shuttingDown;
  res.status(ready ? 200 : 503).json({ ready });
});

// 4. 404 & Centralized Error Handlers (must be at the bottom)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
