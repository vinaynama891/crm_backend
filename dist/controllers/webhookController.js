"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookController = exports.WebhookController = void 0;
const models_1 = require("../models");
const leadAssignmentService_1 = require("../services/leadAssignmentService");
const callService_1 = require("../services/callService");
const notificationService_1 = require("../services/notificationService");
class WebhookController {
    /**
     * POST /api/webhooks/leads
     * Captured Leads Webhook Endpoint
     */
    async captureLead(req, res) {
        console.log('[WebhookController] Received lead capture payload:', JSON.stringify(req.body));
        const orgId = req.query.orgId || req.body.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Missing organization context (orgId query parameter required)' });
        }
        try {
            // 1. Fetch organization settings
            const settings = await models_1.IntegrationSettings.findOne({ organizationId: orgId });
            // 2. Validate webhook secret if configured
            if (settings?.webhookSecret) {
                const receivedSecret = req.headers['x-webhook-secret'] || req.query.secret;
                if (receivedSecret !== settings.webhookSecret) {
                    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
                }
            }
            // 3. Parse fields from various lead structures
            const payload = req.body;
            const fullName = payload.fullName || payload.name ||
                (payload.firstName ? `${payload.firstName} ${payload.lastName || ''}`.trim() : '') ||
                payload.lead_name || 'Anonymous Lead';
            const phone = payload.phone || payload.mobile || payload.phone_number || payload.contact;
            if (!phone) {
                return res.status(400).json({ error: 'Missing lead phone number' });
            }
            const email = payload.email || payload.email_id || null;
            // Auto detect source
            const rawSource = payload.source || req.headers['x-lead-source'] || req.query.source || 'Website Form';
            let source = String(rawSource);
            if (source.toLowerCase().includes('fb') || source.toLowerCase().includes('facebook')) {
                source = 'Facebook Lead Ads';
            }
            else if (source.toLowerCase().includes('insta') || source.toLowerCase().includes('instagram')) {
                source = 'Instagram Lead Ads';
            }
            else if (source.toLowerCase().includes('magic')) {
                source = 'MagicBricks';
            }
            else if (source.toLowerCase().includes('house') || source.toLowerCase().includes('housing')) {
                source = 'Housing.com';
            }
            else if (source.toLowerCase().includes('99')) {
                source = '99acres';
            }
            else if (source.toLowerCase().includes('zapier')) {
                source = 'Zapier';
            }
            else if (source.toLowerCase().includes('make')) {
                source = 'Make';
            }
            const propertyType = payload.propertyType || payload.property_type || payload.type || 'Apartment';
            const rawBudget = payload.budget || payload.price || 0;
            const budget = typeof rawBudget === 'string' ? parseFloat(rawBudget.replace(/[^0-9.]/g, '')) : Number(rawBudget);
            const preferredLocation = payload.preferredLocation || payload.location || payload.locality || payload.city || null;
            const notes = payload.notes || payload.message || `Lead interest captured from ${source}.`;
            // 4. Save Lead
            const lead = await models_1.Lead.create({
                organizationId: orgId,
                fullName,
                phone: String(phone).trim(),
                email: email ? String(email).trim() : undefined,
                source,
                propertyType,
                budget: budget || undefined,
                preferredLocation: preferredLocation || undefined,
                notes,
                status: 'New',
                temperature: 'Hot', // New leads are Hot by default
            });
            console.log(`[WebhookController] Saved lead: ${lead.fullName} (${lead._id.toString()})`);
            // 5. Auto Assign Agent
            const assignedLead = await leadAssignmentService_1.leadAssignmentService.assignLead({
                organizationId: orgId,
                leadId: lead._id.toString(),
            });
            if (assignedLead && assignedLead.assignedAgentId) {
                // 6. Trigger Instant Call Bridge Workflow
                console.log(`[WebhookController] Auto-assigned agent ${assignedLead.assignedAgentId}. Triggering Call Bridge...`);
                await callService_1.callService.initiateCallBridge({
                    organizationId: orgId,
                    leadId: lead._id.toString(),
                    agentId: assignedLead.assignedAgentId.toString(),
                    dryRun: true, // Always default to dryRun if not fully production setup
                });
            }
            else {
                // Notify managers about unassigned lead
                await notificationService_1.notificationService.notifyAdminsAndManagers({
                    organizationId: orgId,
                    title: 'Unassigned New Lead',
                    message: `A new lead ${lead.fullName} (${lead.source}) was captured but could not be assigned automatically.`,
                    type: 'NEW_LEAD',
                });
            }
            return res.status(201).json({
                success: true,
                message: 'Lead captured and queued successfully',
                leadId: lead._id.toString(),
                assignedAgentId: assignedLead?.assignedAgentId || null,
            });
        }
        catch (error) {
            console.error('[WebhookController] Lead capture error:', error);
            return res.status(500).json({ error: 'Internal server error while capturing lead' });
        }
    }
}
exports.WebhookController = WebhookController;
exports.webhookController = new WebhookController();
