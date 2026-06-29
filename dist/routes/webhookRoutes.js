"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhookController_1 = require("../controllers/webhookController");
const router = (0, express_1.Router)();
// Public webhook to capture leads from Facebook, Zapier, MagicBricks, etc.
router.post('/leads', webhookController_1.webhookController.captureLead);
exports.default = router;
