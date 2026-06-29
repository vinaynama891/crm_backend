import { FollowUp, Lead, Activity, IFollowUp } from '../models';
import { notificationService } from './notificationService';
import { messageService } from './messageService';

export class FollowupService {
  /**
   * Create a new follow-up task
   */
  async createFollowUp(params: {
    organizationId: string;
    leadId: string;
    agentId: string;
    title: string;
    notes?: string;
    scheduledAt: Date;
  }) {
    const { organizationId, leadId, agentId, title, notes, scheduledAt } = params;

    const followup = await FollowUp.create({
      organizationId,
      leadId,
      agentId,
      title,
      notes,
      scheduledAt,
      status: 'PENDING',
    });

    // Also update lead's next followupDate
    const lead = await Lead.findById(leadId);
    if (lead) {
      lead.followupDate = scheduledAt;
      await lead.save();
    }

    // Log to Lead activity timeline
    await Activity.create({
      organizationId,
      leadId,
      agentId,
      type: 'FOLLOWUP',
      content: `Scheduled follow-up: "${title}" for ${new Date(scheduledAt).toLocaleString()}`,
      referenceId: followup._id.toString(),
    });

    return followup;
  }

  /**
   * Complete a follow-up task
   */
  async completeFollowUp(organizationId: string, followupId: string) {
    const followup = await FollowUp.findById(followupId);

    if (!followup || followup.organizationId.toString() !== organizationId) {
      throw new Error('Follow-up not found or unauthorized');
    }

    followup.status = 'COMPLETED';
    const updated = await followup.save();

    // Log to Lead activity timeline
    await Activity.create({
      organizationId,
      leadId: followup.leadId,
      agentId: followup.agentId,
      type: 'FOLLOWUP',
      content: `Completed follow-up: "${followup.title}"`,
      referenceId: followup._id.toString(),
    });

    // Clear lead's followupDate if no other pending followups are scheduled
    const nextPending = await FollowUp.findOne({
      leadId: followup.leadId,
      status: 'PENDING',
    }).sort({ scheduledAt: 1 });

    const lead = await Lead.findById(followup.leadId);
    if (lead) {
      lead.followupDate = nextPending ? nextPending.scheduledAt : undefined;
      await lead.save();
    }

    return updated;
  }

  /**
   * Snooze a follow-up by a number of minutes
   */
  async snoozeFollowUp(organizationId: string, followupId: string, minutes: number) {
    const followup = await FollowUp.findById(followupId);

    if (!followup || followup.organizationId.toString() !== organizationId) {
      throw new Error('Follow-up not found or unauthorized');
    }

    const newDate = new Date(new Date().getTime() + minutes * 60 * 1000);

    followup.status = 'SNOOZED';
    followup.scheduledAt = newDate;
    const updated = await followup.save();

    const lead = await Lead.findById(followup.leadId);
    if (lead) {
      lead.followupDate = newDate;
      await lead.save();
    }

    // Log to Lead activity timeline
    await Activity.create({
      organizationId,
      leadId: followup.leadId,
      agentId: followup.agentId,
      type: 'FOLLOWUP',
      content: `Snoozed follow-up: "${followup.title}" by ${minutes} minutes (Rescheduled for ${newDate.toLocaleString()})`,
      referenceId: followup._id.toString(),
    });

    return updated;
  }

  /**
   * Reschedule a follow-up for a specific date
   */
  async rescheduleFollowUp(organizationId: string, followupId: string, newDate: Date) {
    const followup = await FollowUp.findById(followupId);

    if (!followup || followup.organizationId.toString() !== organizationId) {
      throw new Error('Follow-up not found or unauthorized');
    }

    followup.status = 'RESCHEDULED';
    followup.scheduledAt = newDate;
    const updated = await followup.save();

    const lead = await Lead.findById(followup.leadId);
    if (lead) {
      lead.followupDate = newDate;
      await lead.save();
    }

    // Log to Lead activity timeline
    await Activity.create({
      organizationId,
      leadId: followup.leadId,
      agentId: followup.agentId,
      type: 'FOLLOWUP',
      content: `Rescheduled follow-up: "${followup.title}" to ${new Date(newDate).toLocaleString()}`,
      referenceId: followup._id.toString(),
    });

    return updated;
  }

  /**
   * Triggers notifications for any follow-up that is due
   */
  async sendFollowUpNotifications() {
    const now = new Date();
    
    // Find all pending/snoozed/rescheduled followups due right now
    const dueFollowups = await FollowUp.find({
      status: {
        $in: ['PENDING', 'SNOOZED', 'RESCHEDULED'],
      },
      scheduledAt: {
        $lte: now,
      },
    }).populate({
      path: 'lead'
    }).populate({
      path: 'agent',
      populate: { path: 'profile' }
    });

    console.log(`[FollowupService] Processing ${dueFollowups.length} due follow-ups`);

    for (const followup of dueFollowups) {
      const { organizationId, lead, agent, title } = followup;

      if (!lead || !agent) continue;

      // 1. In-App Notification to Agent
      await notificationService.createNotification({
        organizationId: organizationId.toString(),
        userId: agent.profileId.toString(),
        title: 'Follow-Up Task Due',
        message: `Your follow-up "${title}" for lead ${lead.fullName} is due now!`,
        type: 'FOLLOWUP_DUE',
      });

      // 2. WhatsApp Notification (dry run default or real Twilio)
      await messageService.sendWhatsAppTemplate({
        organizationId: organizationId.toString(),
        leadId: lead._id.toString(),
        agentId: agent._id.toString(),
        templateName: 'FollowUp',
        variables: { leadName: lead.fullName },
        dryRun: true,
      });

      // 3. Email Notification to Agent
      if (agent.profile?.email) {
        await messageService.sendEmail({
          organizationId: organizationId.toString(),
          leadId: lead._id.toString(),
          subject: `Follow-Up Reminder: ${lead.fullName}`,
          htmlContent: `
            <p>Hi ${agent.profile.fullName},</p>
            <p>This is a reminder that your follow-up task <strong>"${title}"</strong> with lead <strong>${lead.fullName}</strong> is due.</p>
            <p>Lead Phone: ${lead.phone}</p>
            <p>Lead Email: ${lead.email || 'N/A'}</p>
          `,
          dryRun: true,
        });
      }

      // Auto snooze 1 hour to avoid duplicate notification loops
      followup.scheduledAt = new Date(now.getTime() + 60 * 60 * 1000);
      followup.status = 'SNOOZED';
      await followup.save();
    }
  }
}

export const followupService = new FollowupService();
