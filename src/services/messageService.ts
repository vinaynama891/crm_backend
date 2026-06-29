import { IntegrationSettings, Lead, Message, Activity } from '../models';
import twilio from 'twilio';
import { Resend } from 'resend';

export class MessageService {
  /**
   * Helper to resolve Twilio WhatsApp credentials
   */
  private async getTwilioWhatsAppConfig(organizationId: string) {
    const settings = await IntegrationSettings.findOne({ organizationId });

    const sid = settings?.twilioSid || process.env.TWILIO_ACCOUNT_SID;
    const token = settings?.twilioToken || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = settings?.whatsappNumber || process.env.WHATSAPP_PHONE_NUMBER;

    if (!sid || !token || !fromNumber || sid.startsWith('ACXXXXXX') || token === 'your_twilio_auth_token') {
      return null;
    }

    try {
      const client = twilio(sid, token);
      return { client, fromNumber };
    } catch {
      return null;
    }
  }

  /**
   * Helper to resolve Resend Email API credentials
   */
  private async getResendConfig(organizationId: string) {
    const settings = await IntegrationSettings.findOne({ organizationId });

    const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;

    if (!apiKey || apiKey.startsWith('re_12345')) {
      return null;
    }

    try {
      return new Resend(apiKey);
    } catch {
      return null;
    }
  }

  /**
   * Sends a templated WhatsApp message to a lead
   */
  async sendWhatsAppTemplate(params: {
    organizationId: string;
    leadId: string;
    agentId: string | null;
    templateName: 'Welcome' | 'FollowUp' | 'SiteVisit' | 'MissedCall';
    variables: Record<string, string>;
    dryRun?: boolean;
  }) {
    const { organizationId, leadId, agentId, templateName, variables, dryRun = false } = params;

    const lead = await Lead.findById(leadId);

    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    // Define template messages
    const templates = {
      Welcome: `Hi ${lead.fullName},\nThank you for your interest. I will assist you with suitable properties.`,
      FollowUp: `Hi ${lead.fullName},\nJust checking whether you reviewed the property details.`,
      SiteVisit: `Hi ${lead.fullName},\nReminder for your site visit scheduled today.`,
      MissedCall: `Hi ${lead.fullName},\nSorry I missed your call. I will try calling you back shortly.`,
    };

    let messageBody = templates[templateName] || '';
    // Replace custom variables if any
    for (const [key, value] of Object.entries(variables)) {
      messageBody = messageBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    const waConfig = await this.getTwilioWhatsAppConfig(organizationId);

    if (dryRun || !waConfig) {
      console.log(`[MessageService] [DRY RUN WHATSAPP] Sending template: "${templateName}" to ${lead.fullName} (${lead.phone})`);
      console.log(`[MessageService] [DRY RUN WHATSAPP] Content:\n"""\n${messageBody}\n"""`);

      // Log in messages table
      const msg = await Message.create({
        organizationId,
        leadId,
        agentId,
        templateName,
        messageBody,
        status: 'sent_simulated',
      });

      // Log in Lead Activity timeline
      await Activity.create({
        organizationId,
        leadId,
        agentId,
        type: 'WHATSAPP',
        content: `WhatsApp sent (Template: ${templateName}): "${messageBody.substring(0, 60)}..."`,
        referenceId: msg._id.toString(),
      });

      return { success: true, mode: 'dry_run', messageId: msg._id.toString() };
    }

    // Production Mode
    const { client, fromNumber } = waConfig;
    const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    const formattedTo = lead.phone.startsWith('whatsapp:') ? lead.phone : `whatsapp:${lead.phone}`;

    try {
      const response = await client.messages.create({
        from: formattedFrom,
        to: formattedTo,
        body: messageBody,
      });

      const msg = await Message.create({
        organizationId,
        leadId,
        agentId,
        templateName,
        messageBody,
        status: response.status || 'sent',
      });

      await Activity.create({
        organizationId,
        leadId,
        agentId,
        type: 'WHATSAPP',
        content: `WhatsApp sent (Template: ${templateName}): "${messageBody.substring(0, 60)}..."`,
        referenceId: msg._id.toString(),
      });

      return { success: true, mode: 'production', messageId: msg._id.toString(), sid: response.sid };
    } catch (error: any) {
      console.error('[MessageService] Production WhatsApp send failed:', error);
      // Fallback to simulated save
      const msg = await Message.create({
        organizationId,
        leadId,
        agentId,
        templateName,
        messageBody,
        status: 'failed',
      });
      return { success: false, mode: 'fallback', messageId: msg._id.toString(), error: error.message };
    }
  }

  /**
   * Sends an email using Resend
   */
  async sendEmail(params: {
    organizationId: string;
    leadId: string;
    subject: string;
    htmlContent: string;
    dryRun?: boolean;
  }) {
    const { organizationId, leadId, subject, htmlContent, dryRun = false } = params;

    const lead = await Lead.findById(leadId);

    if (!lead || !lead.email) {
      console.log(`[MessageService] Cannot send email, lead not found or has no email address`);
      return { success: false, reason: 'No email address' };
    }

    const resend = await this.getResendConfig(organizationId);

    if (dryRun || !resend) {
      console.log(`[MessageService] [DRY RUN EMAIL] Sending email to ${lead.fullName} (${lead.email})`);
      console.log(`[MessageService] [DRY RUN EMAIL] Subject: ${subject}`);
      console.log(`[MessageService] [DRY RUN EMAIL] Content Snippet: ${htmlContent.substring(0, 100)}...`);

      // Log in timeline
      await Activity.create({
        organizationId,
        leadId,
        type: 'NOTE',
        content: `Email sent (Simulated): "${subject}"`,
      });

      return { success: true, mode: 'dry_run' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'EstateFlow CRM <noreply@estateflow.app>', // Resend verified domain or default sandbox
        to: lead.email,
        subject,
        html: htmlContent,
      });

      if (error) {
        throw new Error(error.message);
      }

      await Activity.create({
        organizationId,
        leadId,
        type: 'NOTE',
        content: `Email sent: "${subject}"`,
      });

      return { success: true, mode: 'production', id: data?.id };
    } catch (error: any) {
      console.error('[MessageService] Production Email send failed:', error);
      return { success: false, mode: 'fallback', error: error.message };
    }
  }
}

export const messageService = new MessageService();
