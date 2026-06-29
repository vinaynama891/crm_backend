"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twiMLController = exports.TwiMLController = void 0;
const twilio_1 = __importDefault(require("twilio"));
const callService_1 = require("../services/callService");
const notificationService_1 = require("../services/notificationService");
const models_1 = require("../models");
class TwiMLController {
    /**
     * POST /api/twiml/agent-confirm
     * Called by Twilio when the agent answers the call.
     * Plays prompt and gathers DTMF digit.
     */
    async agentConfirm(req, res) {
        const { leadId, agentId, orgId } = req.query;
        const response = new twilio_1.default.twiml.VoiceResponse();
        try {
            const lead = await models_1.Lead.findById(leadId);
            const source = lead?.source || 'external source';
            const gather = response.gather({
                numDigits: 1,
                action: `/api/twiml/connect-lead?leadId=${leadId}&agentId=${agentId}&orgId=${orgId}`,
                method: 'POST',
                timeout: 10,
            });
            gather.say(`New lead received from ${source}. Press any key to connect.`);
            // If no input received, hangup
            response.say('No confirmation received. Hanging up.');
            response.hangup();
            res.type('text/xml');
            return res.send(response.toString());
        }
        catch (error) {
            console.error('[TwiMLController] agentConfirm error:', error);
            response.say('An error occurred. Hanging up.');
            response.hangup();
            res.type('text/xml');
            return res.send(response.toString());
        }
    }
    /**
     * POST /api/twiml/connect-lead
     * Called when agent presses a key. Dial the lead and bridge the calls.
     */
    async connectLead(req, res) {
        const { leadId, agentId, orgId } = req.query;
        const digits = req.body.Digits;
        const response = new twilio_1.default.twiml.VoiceResponse();
        if (!digits) {
            response.say('No input key detected. Hanging up.');
            response.hangup();
            res.type('text/xml');
            return res.send(response.toString());
        }
        try {
            const lead = await models_1.Lead.findById(leadId);
            if (!lead) {
                response.say('Lead not found. Hanging up.');
                response.hangup();
                res.type('text/xml');
                return res.send(response.toString());
            }
            response.say('Connecting you to the lead. Please wait.');
            // Dial lead, start dual-leg recording, set callback URLs
            const dial = response.dial({
                record: 'record-from-answer-dual',
                recordingStatusCallback: `/api/twiml/recording-callback?leadId=${leadId}&agentId=${agentId}&orgId=${orgId}`,
                action: `/api/twiml/call-completed?leadId=${leadId}&agentId=${agentId}&orgId=${orgId}`,
                method: 'POST',
            });
            // Insert target lead number
            dial.number(lead.phone);
            res.type('text/xml');
            return res.send(response.toString());
        }
        catch (error) {
            console.error('[TwiMLController] connectLead error:', error);
            response.say('Could not bridge calls. Hanging up.');
            response.hangup();
            res.type('text/xml');
            return res.send(response.toString());
        }
    }
    /**
     * POST /api/twiml/agent-call-status
     * Status callback for agent call leg (answered, failed, no-answer)
     */
    async agentCallStatus(req, res) {
        const { leadId, agentId, orgId } = req.query;
        const callStatus = req.body.CallStatus; // 'completed', 'no-answer', 'failed', 'busy'
        console.log(`[TwiMLController] Agent Call Status: ${callStatus} for agent: ${agentId}`);
        try {
            if (['no-answer', 'failed', 'busy'].includes(callStatus)) {
                console.log(`[TwiMLController] Call to agent ${agentId} failed/missed. Creating alert.`);
                const agent = await models_1.TeamMember.findById(agentId);
                // 1. Notify agent they missed it
                if (agent) {
                    await notificationService_1.notificationService.createNotification({
                        organizationId: orgId,
                        userId: agent.profileId.toString(),
                        title: 'Missed Call Bridge',
                        message: `You missed a call bridge connection for a new lead.`,
                        type: 'MISSED_LEAD',
                    });
                }
                // 2. Notify managers
                await notificationService_1.notificationService.notifyAdminsAndManagers({
                    organizationId: orgId,
                    title: 'Agent Missed Connection',
                    message: `An agent missed an automatic call bridge connection. Lead requires attention.`,
                    type: 'MISSED_LEAD',
                });
            }
        }
        catch (err) {
            console.error('[TwiMLController] agentCallStatus error handler failed:', err);
        }
        return res.sendStatus(200);
    }
    /**
     * POST /api/twiml/call-completed
     * Twilio action callback when dial/bridge leg finishes
     */
    async callCompleted(req, res) {
        const { leadId, agentId, orgId } = req.query;
        const callSid = req.body.CallSid;
        const dialCallDuration = req.body.DialCallDuration || '0';
        const dialCallStatus = req.body.DialCallStatus || 'completed';
        console.log(`[TwiMLController] Call Bridge completed. Duration: ${dialCallDuration}s, Status: ${dialCallStatus}`);
        try {
            // Create call log record
            const duration = parseInt(dialCallDuration);
            await callService_1.callService.logCall({
                organizationId: orgId,
                leadId: leadId,
                agentId: agentId,
                callSid: callSid || `TWILIO_SID_${Date.now()}`,
                duration,
                outcome: dialCallStatus,
                startedAt: new Date(Date.now() - duration * 1000),
                endedAt: new Date(),
            });
        }
        catch (error) {
            console.error('[TwiMLController] callCompleted log error:', error);
        }
        const response = new twilio_1.default.twiml.VoiceResponse();
        response.hangup();
        res.type('text/xml');
        return res.send(response.toString());
    }
    /**
     * POST /api/twiml/recording-callback
     * Twilio webhook notifying when recording is processed
     */
    async recordingCallback(req, res) {
        const callSid = req.body.CallSid;
        const recordingUrl = req.body.RecordingUrl;
        console.log(`[TwiMLController] Recording callback received. SID: ${callSid}, URL: ${recordingUrl}`);
        try {
            // Find matching call log and update recording link
            const call = await models_1.Call.findOne({ callSid });
            if (call) {
                call.recordingUrl = recordingUrl;
                await call.save();
                // Also update activity timeline description with recording link
                const activity = await models_1.Activity.findOne({ referenceId: callSid });
                if (activity) {
                    activity.content = `${activity.content} Recording link: ${recordingUrl}`;
                    await activity.save();
                }
            }
        }
        catch (error) {
            console.error('[TwiMLController] recordingCallback update error:', error);
        }
        return res.sendStatus(200);
    }
}
exports.TwiMLController = TwiMLController;
exports.twiMLController = new TwiMLController();
