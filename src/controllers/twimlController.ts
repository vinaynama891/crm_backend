import { Request, Response } from 'express';
import twilio from 'twilio';
import { callService } from '../services/callService';
import { notificationService } from '../services/notificationService';
import { Lead, TeamMember, Call, Activity } from '../models';

export class TwiMLController {
  /**
   * POST /api/twiml/agent-confirm
   * Called by Twilio when the agent answers the call.
   * Plays prompt and gathers DTMF digit.
   */
  async agentConfirm(req: Request, res: Response) {
    const { leadId, agentId, orgId } = req.query;

    const response = new twilio.twiml.VoiceResponse();

    try {
      const lead = await Lead.findById(leadId as string);

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
    } catch (error) {
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
  async connectLead(req: Request, res: Response) {
    const { leadId, agentId, orgId } = req.query;
    const digits = req.body.Digits;

    const response = new twilio.twiml.VoiceResponse();

    if (!digits) {
      response.say('No input key detected. Hanging up.');
      response.hangup();
      res.type('text/xml');
      return res.send(response.toString());
    }

    try {
      const lead = await Lead.findById(leadId as string);

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
    } catch (error) {
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
  async agentCallStatus(req: Request, res: Response) {
    const { leadId, agentId, orgId } = req.query;
    const callStatus = req.body.CallStatus; // 'completed', 'no-answer', 'failed', 'busy'

    console.log(`[TwiMLController] Agent Call Status: ${callStatus} for agent: ${agentId}`);

    try {
      if (['no-answer', 'failed', 'busy'].includes(callStatus)) {
        console.log(`[TwiMLController] Call to agent ${agentId} failed/missed. Creating alert.`);
        
        const agent = await TeamMember.findById(agentId as string);

        // 1. Notify agent they missed it
        if (agent) {
          await notificationService.createNotification({
            organizationId: orgId as string,
            userId: agent.profileId.toString(),
            title: 'Missed Call Bridge',
            message: `You missed a call bridge connection for a new lead.`,
            type: 'MISSED_LEAD',
          });
        }

        // 2. Notify managers
        await notificationService.notifyAdminsAndManagers({
          organizationId: orgId as string,
          title: 'Agent Missed Connection',
          message: `An agent missed an automatic call bridge connection. Lead requires attention.`,
          type: 'MISSED_LEAD',
        });
      }
    } catch (err) {
      console.error('[TwiMLController] agentCallStatus error handler failed:', err);
    }

    return res.sendStatus(200);
  }

  /**
   * POST /api/twiml/call-completed
   * Twilio action callback when dial/bridge leg finishes
   */
  async callCompleted(req: Request, res: Response) {
    const { leadId, agentId, orgId } = req.query;
    const callSid = req.body.CallSid;
    const dialCallDuration = req.body.DialCallDuration || '0';
    const dialCallStatus = req.body.DialCallStatus || 'completed';

    console.log(`[TwiMLController] Call Bridge completed. Duration: ${dialCallDuration}s, Status: ${dialCallStatus}`);

    try {
      // Create call log record
      const duration = parseInt(dialCallDuration);
      
      await callService.logCall({
        organizationId: orgId as string,
        leadId: leadId as string,
        agentId: agentId as string,
        callSid: callSid || `TWILIO_SID_${Date.now()}`,
        duration,
        outcome: dialCallStatus,
        startedAt: new Date(Date.now() - duration * 1000),
        endedAt: new Date(),
      });
    } catch (error) {
      console.error('[TwiMLController] callCompleted log error:', error);
    }

    const response = new twilio.twiml.VoiceResponse();
    response.hangup();
    res.type('text/xml');
    return res.send(response.toString());
  }

  /**
   * POST /api/twiml/recording-callback
   * Twilio webhook notifying when recording is processed
   */
  async recordingCallback(req: Request, res: Response) {
    const callSid = req.body.CallSid;
    const recordingUrl = req.body.RecordingUrl;

    console.log(`[TwiMLController] Recording callback received. SID: ${callSid}, URL: ${recordingUrl}`);

    try {
      // Find matching call log and update recording link
      const call = await Call.findOne({ callSid });

      if (call) {
        call.recordingUrl = recordingUrl;
        await call.save();

        // Also update activity timeline description with recording link
        const activity = await Activity.findOne({ referenceId: callSid });

        if (activity) {
          activity.content = `${activity.content} Recording link: ${recordingUrl}`;
          await activity.save();
        }
      }
    } catch (error) {
      console.error('[TwiMLController] recordingCallback update error:', error);
    }

    return res.sendStatus(200);
  }
}

export const twiMLController = new TwiMLController();
