"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = exports.NotificationController = void 0;
const models_1 = require("../models");
class NotificationController {
    /**
     * GET /api/notifications
     * Fetch current user's in-app notifications
     */
    async getNotifications(req, res) {
        const userId = req.user?.id;
        const orgId = req.orgId;
        if (!userId || !orgId) {
            return res.status(401).json({ error: 'Unauthorized context' });
        }
        try {
            const notifications = await models_1.Notification.find({
                organizationId: orgId,
                userId: userId,
            })
                .sort({ createdAt: -1 })
                .limit(50);
            return res.json(notifications);
        }
        catch (error) {
            console.error('[NotificationController] Get notifications error:', error);
            return res.status(500).json({ error: 'Internal server error fetching notifications' });
        }
    }
    /**
     * PUT /api/notifications/:id/read
     * Mark a notification as read
     */
    async markRead(req, res) {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        try {
            const notification = await models_1.Notification.findOne({ _id: id, userId });
            if (!notification) {
                return res.status(404).json({ error: 'Notification not found' });
            }
            notification.read = true;
            const updated = await notification.save();
            return res.json(updated);
        }
        catch (error) {
            console.error('[NotificationController] Mark read error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * PUT /api/notifications/read-all
     * Mark all notifications as read for current user
     */
    async markReadAll(req, res) {
        const userId = req.user?.id;
        const orgId = req.orgId;
        if (!userId || !orgId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        try {
            const result = await models_1.Notification.updateMany({
                organizationId: orgId,
                userId: userId,
                read: false,
            }, {
                $set: { read: true },
            });
            return res.json({ success: true, count: result.modifiedCount });
        }
        catch (error) {
            console.error('[NotificationController] Mark read all error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.NotificationController = NotificationController;
exports.notificationController = new NotificationController();
