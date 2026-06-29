import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { IntegrationSettings } from '../models';

export class SettingsController {
  /**
   * GET /api/settings
   * Retrieve integration settings for organization
   */
  async getSettings(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;

    try {
      let settings = await IntegrationSettings.findOne({ organizationId: orgId });

      // If settings don't exist yet, create default empty configuration
      if (!settings) {
        settings = await IntegrationSettings.create({
          organizationId: orgId,
          assignmentMode: 'ROUND_ROBIN',
        });
      }

      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] Get settings error:', error);
      return res.status(500).json({ error: 'Internal server error fetching settings' });
    }
  }

  /**
   * PUT /api/settings
   * Upsert integration settings for organization
   */
  async updateSettings(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    const { 
      twilioSid, 
      twilioToken, 
      twilioNumber, 
      whatsappNumber, 
      resendApiKey, 
      webhookSecret, 
      assignmentMode 
    } = req.body;

    try {
      const settings = await IntegrationSettings.findOneAndUpdate(
        { organizationId: orgId },
        {
          $set: {
            twilioSid,
            twilioToken,
            twilioNumber,
            whatsappNumber,
            resendApiKey,
            webhookSecret,
            assignmentMode: assignmentMode || 'ROUND_ROBIN',
          }
        },
        { upsert: true, new: true }
      );

      return res.json(settings);
    } catch (error) {
      console.error('[SettingsController] Update settings error:', error);
      return res.status(500).json({ error: 'Internal server error updating settings' });
    }
  }
}

export const settingsController = new SettingsController();
