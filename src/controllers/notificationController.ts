import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { Notification } from '../models';

export class NotificationController {
  /**
   * GET /api/notifications
   * Fetch current user's in-app notifications
   */
  async getNotifications(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const orgId = req.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized context' });
    }

    try {
      const notifications = await Notification.find({
        organizationId: orgId,
        userId: userId,
      })
        .sort({ createdAt: -1 })
        .limit(50);

      return res.json(notifications);
    } catch (error) {
      console.error('[NotificationController] Get notifications error:', error);
      return res.status(500).json({ error: 'Internal server error fetching notifications' });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read
   */
  async markRead(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const notification = await Notification.findOne({ _id: id, userId });

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      notification.read = true;
      const updated = await notification.save();

      return res.json(updated);
    } catch (error) {
      console.error('[NotificationController] Mark read error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read for current user
   */
  async markReadAll(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.id;
    const orgId = req.orgId;

    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const result = await Notification.updateMany(
        {
          organizationId: orgId,
          userId: userId,
          read: false,
        },
        {
          $set: { read: true },
        }
      );

      return res.json({ success: true, count: result.modifiedCount });
    } catch (error) {
      console.error('[NotificationController] Mark read all error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const notificationController = new NotificationController();
