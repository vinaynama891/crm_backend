"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
// Configure CORS
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins for easier local demo testing
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-webhook-secret'],
}));
// Configure urlencoded for Twilio POST webhooks (which send urlencoded form payloads)
app.use(express_1.default.urlencoded({ extended: true }));
// Configure JSON for standard REST client request payloads
app.use(express_1.default.json());
// API Health Check route
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'EstateFlow API', timestamp: new Date() });
});
// Root check route
app.get('/', (req, res) => {
    res.send('EstateFlow Real Estate Lead Conversion CRM API');
});
// Register all API modular routes
app.use('/api', routes_1.default);
exports.default = app;
