"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoURI = process.env.DATABASE_URL;
if (!mongoURI) {
    console.error('[DB] DATABASE_URL not defined in environment variables');
    process.exit(1);
}
const connectDB = async () => {
    try {
        // Suppress warning alerts on strict queries
        mongoose_1.default.set('strictQuery', false);
        await mongoose_1.default.connect(mongoURI);
        console.log('=============================================');
        console.log(' DATABASE: Connected to MongoDB Atlas');
        console.log('=============================================');
    }
    catch (err) {
        console.error('[DB] Connection error:', err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
exports.default = mongoose_1.default;
