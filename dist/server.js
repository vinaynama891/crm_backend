"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./config/db");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
async function startServer() {
    // Connect to MongoDB Atlas
    await (0, db_1.connectDB)();
    app_1.default.listen(PORT, () => {
        console.log(`=============================================`);
        console.log(` ESTATEFLOW CRM SERVER RUNNING ON PORT ${PORT}`);
        console.log(` Mode: Development`);
        console.log(` Database: MongoDB via Mongoose`);
        console.log(`=============================================`);
    });
}
startServer().catch((err) => {
    console.error('[Server] Boot failure:', err);
    process.exit(1);
});
