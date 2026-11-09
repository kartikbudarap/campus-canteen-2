const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app')
const connectDB = require("./src/config/db")
const mongoose = require("mongoose");
const PORT = process.env.PORT || 3000;

async function start() {
    if (process.env.NODE_ENV === "production") {
        const requiredSettings = [
            "CLIENT_URL",
            "ACCESS_TOKEN_SECRET",
            "REFRESH_TOKEN_SECRET",
            "RESET_PASSWORD_TOKEN_SECRET",
            "EMAIL_USER",
            "EMAIL_PASSWORD",
        ];

        for (const name of requiredSettings) {
            if (!process.env[name]) {
                throw new Error(`${name} is required in production`);
            }
        }
    }

    await connectDB();

    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    const shutdown = () => {
        app.locals.shuttingDown = true;
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}

start().catch((error) => {
    console.error("Startup failed:", error);
    process.exit(1);
});
