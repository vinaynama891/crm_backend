"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const models_1 = require("../models");
class NotificationService {
    /**
     * Create an in-app notification for a specific user profile
     */
    async createNotification(params) {
        console.log(`[NotificationService] Creating in-app notification for user ${params.userId}: "${params.title}"`);
        return await models_1.Notification.create({
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
    async notifyAdminsAndManagers(params) {
        console.log(`[NotificationService] Broad-notifying admins/managers in org ${params.organizationId}: "${params.title}"`);
        // Find all admins and managers in the organization
        const teamMembers = await models_1.TeamMember.find({
            organizationId: params.organizationId,
            role: {
                $in: ['ADMIN', 'SALES_MANAGER'],
            },
            status: 'ACTIVE',
        });
        const notifications = await Promise.all(teamMembers.map((member) => this.createNotification({
            organizationId: params.organizationId,
            userId: member.profileId.toString(),
            title: params.title,
            message: params.message,
            type: params.type,
        })));
        return notifications;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
