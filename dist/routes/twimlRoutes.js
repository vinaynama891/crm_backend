"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const twimlController_1 = require("../controllers/twimlController");
const router = (0, express_1.Router)();
// Public routes accessed by Twilio voice API
router.post('/agent-confirm', twimlController_1.twiMLController.agentConfirm);
router.post('/connect-lead', twimlController_1.twiMLController.connectLead);
router.post('/agent-call-status', twimlController_1.twiMLController.agentCallStatus);
router.post('/call-completed', twimlController_1.twiMLController.callCompleted);
router.post('/recording-callback', twimlController_1.twiMLController.recordingCallback);
exports.default = router;
