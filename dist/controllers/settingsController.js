"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = exports.SettingsController = void 0;
const models_1 = require("../models");
class SettingsController {
    /**
     * GET /api/settings
     * Retrieve integration settings for organization
     */
    async getSettings(req, res) {
        const orgId = req.orgId;
        try {
            let settings = await models_1.IntegrationSettings.findOne({ organizationId: orgId });
            // If settings don't exist yet, create default empty configuration
            if (!settings) {
                settings = await models_1.IntegrationSettings.create({
                    organizationId: orgId,
                    assignmentMode: 'ROUND_ROBIN',
                });
            }
            return res.json(settings);
        }
        catch (error) {
            console.error('[SettingsController] Get settings error:', error);
            return res.status(500).json({ error: 'Internal server error fetching settings' });
        }
    }
    /**
     * PUT /api/settings
     * Upsert integration settings for organization
     */
    async updateSettings(req, res) {
        const orgId = req.orgId;
        const { twilioSid, twilioToken, twilioNumber, whatsappNumber, resendApiKey, webhookSecret, assignmentMode } = req.body;
        try {
            const settings = await models_1.IntegrationSettings.findOneAndUpdate({ organizationId: orgId }, {
                $set: {
                    twilioSid,
                    twilioToken,
                    twilioNumber,
                    whatsappNumber,
                    resendApiKey,
                    webhookSecret,
                    assignmentMode: assignmentMode || 'ROUND_ROBIN',
                }
            }, { upsert: true, new: true });
            return res.json(settings);
        }
        catch (error) {
            console.error('[SettingsController] Update settings error:', error);
            return res.status(500).json({ error: 'Internal server error updating settings' });
        }
    }
}
exports.SettingsController = SettingsController;
exports.settingsController = new SettingsController();
