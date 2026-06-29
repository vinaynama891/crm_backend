import { Notification, TeamMember, INotification } from '../models';

export class NotificationService {
  /**
   * Create an in-app notification for a specific user profile
   */
  async createNotification(params: {
    organizationId: string;
    userId: string;
    title: string;
    message: string;
    type: 'NEW_LEAD' | 'FOLLOWUP_DUE' | 'SITE_VISIT_REMINDER' | 'MISSED_LEAD' | 'PROPERTY_SHARED';
  }) {
    console.log(`[NotificationService] Creating in-app notification for user ${params.userId}: "${params.title}"`);
    return await Notification.create({
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      read: false,
    });
  }

  /**
   * Send notification to all active admins and sales managers in an organization
   */
  async notifyAdminsAndManagers(params: {
    organizationId: string;
    title: string;
    message: string;
    type: 'NEW_LEAD' | 'FOLLOWUP_DUE' | 'SITE_VISIT_REMINDER' | 'MISSED_LEAD' | 'PROPERTY_SHARED';
  }) {
    console.log(`[NotificationService] Broad-notifying admins/managers in org ${params.organizationId}: "${params.title}"`);
    
    // Find all admins and managers in the organization
    const teamMembers = await TeamMember.find({
      organizationId: params.organizationId,
      role: {
        $in: ['ADMIN', 'SALES_MANAGER'],
      },
      status: 'ACTIVE',
    });

    const notifications = await Promise.all(
      teamMembers.map((member) =>
        this.createNotification({
          organizationId: params.organizationId,
          userId: member.profileId.toString(),
          title: params.title,
          message: params.message,
          type: params.type,
        })
      )
    );

    return notifications;
  }
}

export const notificationService = new NotificationService();
