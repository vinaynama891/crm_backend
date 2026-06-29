import { IntegrationSettings, Lead, TeamMember, Call, Activity } from '../models';
import twilio from 'twilio';
import { notificationService } from './notificationService';

export class CallService {
  /**
   * Helper to get Twilio client for an organization
   * Falls back to env variables or returns null for Dry Run
   */
  private async getTwilioClient(organizationId: string) {
    const settings = await IntegrationSettings.findOne({ organizationId });

    const sid = settings?.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const token = settings?.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const number = settings?.twilioNumber || process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !number || sid.startsWith('ACXXXXXX') || token === 'your_twilio_auth_token') {
      return null; // Force Dry Run Mode
    }

    try {
      const client = twilio(sid, token);
      return { client, twilioNumber: number };
    } catch (error) {
      console.error('[CallService] Error initializing Twilio client:', error);
      return null;
    }
  }

  /**
   * Initiates the call bridge:
   * 1. Check Dry Run vs Production mode.
   * 2. In Production: call agent, play message, gather input.
   * 3. In Dry Run: simulate the bridge process asynchronously.
   */
  async initiateCallBridge(params: {
    organizationId: string;
    leadId: string;
    agentId: string;
    dryRun?: boolean;
  }) {
    const { organizationId, leadId, agentId, dryRun = false } = params;

    const lead = await Lead.findById(leadId);
    const agent = await TeamMember.findById(agentId).populate('profile');

    if (!lead || !agent) {
      throw new Error('Lead or Agent not found for call bridge');
    }

    const twilioConfig = await this.getTwilioClient(organizationId);

    // If dryRun is requested OR no Twilio config exists, execute Dry Run Mode
    if (dryRun || !twilioConfig) {
      console.log(`[CallService] [DRY RUN] Initiating Call Bridge for Lead: ${lead.fullName} (${lead.phone}) and Agent: ${agent.profile?.fullName} (${agent.profile?.phone || 'No Phone'})`);
      
      // Update first contact attempt if not set (for response time analytics)
      if (!lead.firstCallAt) {
        lead.firstCallAt = new Date();
        await lead.save();
      }

      // Simulate a call bridging in the background
      this.simulateDryRunCallBridge(organizationId, leadId, agentId, lead.source);
      return { mode: 'dry_run', status: 'initiated' };
    }

    // Production Mode
    const { client, twilioNumber } = twilioConfig;
    const agentPhone = agent.profile?.phone;
    if (!agentPhone) {
      throw new Error(`Agent ${agent.profile?.fullName} does not have a phone number configured.`);
    }

    try {
      // Use API url for callbacks (this would be your public deployment url)
      const host = process.env.API_HOST || 'http://localhost:5000';
      
      // Make call to agent first
      const call = await client.calls.create({
        to: agentPhone,
        from: twilioNumber,
        url: `${host}/api/twiml/agent-confirm?leadId=${leadId}&agentId=${agentId}&orgId=${organizationId}`,
        statusCallback: `${host}/api/twiml/agent-call-status?leadId=${leadId}&agentId=${agentId}&orgId=${organizationId}`,
        statusCallbackEvent: ['completed', 'failed', 'no-answer', 'busy'],
      });

      console.log(`[CallService] Production call initiated with SID: ${call.sid}`);

      // Update lead firstCallAt if not set
      if (!lead.firstCallAt) {
        lead.firstCallAt = new Date();
        await lead.save();
      }

      return { mode: 'production', status: 'initiated', callSid: call.sid };
    } catch (error: any) {
      console.error('[CallService] Production Twilio error, falling back to simulated Dry Run:', error);
      this.simulateDryRunCallBridge(organizationId, leadId, agentId, lead.source);
      return { mode: 'dry_run_fallback', status: 'initiated', error: error.message };
    }
  }

  /**
   * Helper to simulate the Twilio call flow in dry-run mode
   */
  private simulateDryRunCallBridge(organizationId: string, leadId: string, agentId: string, source: string) {
    // Run asynchronously to simulate actual network calls
    setTimeout(async () => {
      try {
        console.log(`[CallService] [DRY RUN] Call ringing on Agent's phone...`);
        
        // Randomly simulate whether the agent answers (90% success rate)
        const agentAnswers = Math.random() < 0.9;
        
        if (!agentAnswers) {
          console.log(`[CallService] [DRY RUN] Agent did not answer call. Triggering retry/alert flow.`);
          const agentMember = await TeamMember.findById(agentId);
          await notificationService.createNotification({
            organizationId,
            userId: agentMember?.profileId.toString() || '',
            title: 'Missed Call Bridge Alert',
            message: `You missed an instant call bridge request for a new lead from ${source}.`,
            type: 'MISSED_LEAD',
          });

          await notificationService.notifyAdminsAndManagers({
            organizationId,
            title: 'Agent Missed Call Bridge',
            message: `Agent missed an instant call bridge. Reassigning lead or reviewing queue.`,
            type: 'MISSED_LEAD',
          });
          return;
        }

        console.log(`[CallService] [DRY RUN] Agent answered call and pressed key to confirm.`);
        console.log(`[CallService] [DRY RUN] Dialing Lead phone number...`);
        console.log(`[CallService] [DRY RUN] Call connected and recording started.`);

        const duration = Math.floor(Math.random() * 120) + 30; // 30s to 2.5m call
        const startedAt = new Date();
        const endedAt = new Date(startedAt.getTime() + duration * 1000);
        const callSid = `MOCK_SID_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
        const recordingUrl = `https://api.twilio.com/mock/recordings/${callSid}.mp3`;

        // Wait for simulated call duration to record log
        setTimeout(async () => {
          await Call.create({
            organizationId,
            leadId,
            agentId,
            callSid,
            duration,
            recordingUrl,
            outcome: 'completed',
            startedAt,
            endedAt,
          });

          // Log in timeline
          await Activity.create({
            organizationId,
            leadId,
            agentId,
            type: 'CALL',
            content: `Outgoing call completed by agent. Duration: ${Math.floor(duration / 60)}m ${duration % 60}s.`,
            referenceId: callSid,
          });

          // Automatically update lead status to 'Contacted' if it was 'New'
          const lead = await Lead.findById(leadId);
          if (lead && lead.status === 'New') {
            lead.status = 'Contacted';
            await lead.save();

            await Activity.create({
              organizationId,
              leadId,
              agentId,
              type: 'STATUS_CHANGE',
              content: 'Lead status auto-updated to Contacted after first call.',
            });
          }

          console.log(`[CallService] [DRY RUN] Call logs saved successfully for SID: ${callSid}`);
        }, 2000); // Save log after 2s delay
      } catch (err) {
        console.error('[CallService] Error in dry run simulation:', err);
      }
    }, 1500);
  }

  /**
   * Log completed real calls in database (called by Twilio webhooks)
   */
  async logCall(params: {
    organizationId: string;
    leadId: string;
    agentId: string;
    callSid: string;
    duration: number;
    recordingUrl?: string;
    outcome: string;
    startedAt: Date;
    endedAt: Date;
  }) {
    const call = await Call.create(params);

    await Activity.create({
      organizationId: params.organizationId,
      leadId: params.leadId,
      agentId: params.agentId,
      type: 'CALL',
      content: `Call completed with outcome: ${params.outcome}. Duration: ${Math.floor(params.duration / 60)}m ${params.duration % 60}s.`,
      referenceId: params.callSid,
    });

    // Update lead status to Contacted if it is New
    const lead = await Lead.findById(params.leadId);
    if (lead && lead.status === 'New') {
      lead.status = 'Contacted';
      await lead.save();

      await Activity.create({
        organizationId: params.organizationId,
        leadId: params.leadId,
        agentId: params.agentId,
        type: 'STATUS_CHANGE',
        content: 'Lead status auto-updated to Contacted after call.',
      });
    }

    return call;
  }
}

export const callService = new CallService();
