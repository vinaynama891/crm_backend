import { Router } from 'express';
import { twiMLController } from '../controllers/twimlController';

const router = Router();

// Public routes accessed by Twilio voice API
router.post('/agent-confirm', twiMLController.agentConfirm);
router.post('/connect-lead', twiMLController.connectLead);
router.post('/agent-call-status', twiMLController.agentCallStatus);
router.post('/call-completed', twiMLController.callCompleted);
router.post('/recording-callback', twiMLController.recordingCallback);

export default router;
