"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followupController = exports.FollowupController = void 0;
const followupService_1 = require("../services/followupService");
const models_1 = require("../models");
class FollowupController {
    /**
     * Helper to build RLS filter
     */
    buildRLSQuery(req) {
        const orgId = req.orgId;
        const teamMember = req.teamMember;
        const query = {
            organizationId: orgId,
        };
        if (teamMember.role === 'SALES_AGENT') {
            query.agentId = teamMember.id;
        }
        return query;
    }
    /**
     * GET /api/followups
     * Get follow-up list with filters (status, date)
     */
    async getFollowUps(req, res) {
        try {
            const query = this.buildRLSQuery(req);
            const { status, due } = req.query;
            if (status) {
                query.status = status;
            }
            // If due=today, filter for scheduledAt <= today
            if (due === 'today') {
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                query.scheduledAt = {
                    $lte: todayEnd,
                };
                // Exclude completed ones for today's pending list
                if (!status) {
                    query.status = { $ne: 'COMPLETED' };
                }
            }
            const followups = await models_1.FollowUp.find(query)
                .populate('lead')
                .populate({
                path: 'agent',
                populate: { path: 'profileId', select: 'fullName' }
            })
                .sort({ scheduledAt: 1 });
            return res.json(followups);
        }
        catch (error) {
            console.error('[FollowupController] Get followups error:', error);
            return res.status(500).json({ error: 'Internal server error while fetching follow-ups' });
        }
    }
    /**
     * POST /api/followups
     * Create a new follow-up task
     */
    async createFollowUp(req, res) {
        const orgId = req.orgId;
        const agentId = req.teamMember?.id;
        const { leadId, title, notes, scheduledAt } = req.body;
        if (!leadId || !title || !scheduledAt) {
            return res.status(400).json({ error: 'Lead ID, title, and scheduled time are required' });
        }
        try {
            const leadQuery = {
                _id: leadId,
                organizationId: orgId,
            };
            if (req.teamMember?.role === 'SALES_AGENT') {
                leadQuery.assignedAgentId = agentId;
            }
            // Validate lead belongs to this org/agent
            const lead = await models_1.Lead.findOne(leadQuery);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            const followup = await followupService_1.followupService.createFollowUp({
                organizationId: orgId,
                leadId,
                agentId: req.body.agentId || agentId, // Managers can assign followups to other agents
                title,
                notes,
                scheduledAt: new Date(scheduledAt),
            });
            return res.status(201).json(followup);
        }
        catch (error) {
            console.error('[FollowupController] Create followup error:', error);
            return res.status(500).json({ error: 'Internal server error creating follow-up' });
        }
    }
    /**
     * POST /api/followups/:id/complete
     * Complete a follow-up
     */
    async completeFollowUp(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        try {
            const result = await followupService_1.followupService.completeFollowUp(orgId, id);
            return res.json(result);
        }
        catch (error) {
            console.error('[FollowupController] Complete followup error:', error);
            return res.status(500).json({ error: error.message || 'Failed to complete follow-up' });
        }
    }
    /**
     * POST /api/followups/:id/snooze
     * Snooze a follow-up by minutes
     */
    async snoozeFollowUp(req, res) {
        const { id } = req.params;
        const { minutes } = req.body;
        const orgId = req.orgId;
        if (!minutes) {
            return res.status(400).json({ error: 'Snooze duration in minutes is required' });
        }
        try {
            const result = await followupService_1.followupService.snoozeFollowUp(orgId, id, parseInt(minutes));
            return res.json(result);
        }
        catch (error) {
            console.error('[FollowupController] Snooze followup error:', error);
            return res.status(500).json({ error: error.message || 'Failed to snooze follow-up' });
        }
    }
    /**
     * POST /api/followups/:id/reschedule
     * Reschedule a follow-up
     */
    async rescheduleFollowUp(req, res) {
        const { id } = req.params;
        const { newDate } = req.body;
        const orgId = req.orgId;
        if (!newDate) {
            return res.status(400).json({ error: 'New scheduled date is required' });
        }
        try {
            const result = await followupService_1.followupService.rescheduleFollowUp(orgId, id, new Date(newDate));
            return res.json(result);
        }
        catch (error) {
            console.error('[FollowupController] Reschedule followup error:', error);
            return res.status(500).json({ error: error.message || 'Failed to reschedule follow-up' });
        }
    }
}
exports.FollowupController = FollowupController;
exports.followupController = new FollowupController();
