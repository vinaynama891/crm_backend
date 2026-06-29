"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadController = exports.LeadController = void 0;
const models_1 = require("../models");
const callService_1 = require("../services/callService");
const propertyShareService_1 = require("../services/propertyShareService");
const leadAssignmentService_1 = require("../services/leadAssignmentService");
const messageService_1 = require("../services/messageService");
class LeadController {
    /**
     * Helper to build the search/filter query where clauses
     * Enforces Row Level Security (RLS) based on User Role
     */
    buildRLSQuery(req) {
        const orgId = req.orgId;
        const teamMember = req.teamMember;
        if (!orgId || !teamMember) {
            throw new Error('Unauthorized RLS context');
        }
        const query = {
            organizationId: orgId,
        };
        // If role is SALES_AGENT, they can ONLY see their assigned leads
        if (teamMember.role === 'SALES_AGENT') {
            query.assignedAgentId = teamMember.id;
        }
        return query;
    }
    /**
     * GET /api/leads
     * Get all leads with filtering, search, and pagination
     */
    async getLeads(req, res) {
        try {
            const baseQuery = this.buildRLSQuery(req);
            const { status, source, temperature, agentId, search } = req.query;
            // Apply Filters
            if (status)
                baseQuery.status = status;
            if (source)
                baseQuery.source = source;
            if (temperature)
                baseQuery.temperature = temperature;
            if (agentId)
                baseQuery.assignedAgentId = agentId;
            // Apply Search (Full Name, Phone, Email, Location)
            if (search) {
                const regex = new RegExp(String(search), 'i');
                baseQuery.$or = [
                    { fullName: regex },
                    { phone: regex },
                    { email: regex },
                    { preferredLocation: regex },
                ];
            }
            const leads = await models_1.Lead.find(baseQuery)
                .populate({
                path: 'assignedAgent',
                populate: { path: 'profileId', select: 'fullName email' }
            })
                .sort({ createdAt: -1 });
            return res.json(leads);
        }
        catch (error) {
            console.error('[LeadController] Get leads error:', error);
            return res.status(500).json({ error: 'Internal server error while fetching leads' });
        }
    }
    /**
     * GET /api/leads/:id
     * Get single lead by ID (enforcing RLS)
     */
    async getLeadById(req, res) {
        const { id } = req.params;
        try {
            const baseQuery = this.buildRLSQuery(req);
            baseQuery._id = id;
            const lead = await models_1.Lead.findOne(baseQuery).populate({
                path: 'assignedAgent',
                populate: { path: 'profileId' }
            });
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized access' });
            }
            // Fetch related records asynchronously
            const activities = await models_1.Activity.find({ leadId: lead._id })
                .populate({
                path: 'agentId',
                populate: { path: 'profileId' }
            })
                .sort({ createdAt: -1 });
            const calls = await models_1.Call.find({ leadId: lead._id }).sort({ createdAt: -1 });
            const messages = await models_1.Message.find({ leadId: lead._id }).sort({ createdAt: -1 });
            const followups = await models_1.FollowUp.find({ leadId: lead._id }).sort({ createdAt: -1 });
            const sitevisits = await models_1.SiteVisit.find({ leadId: lead._id }).populate('propertyId').sort({ createdAt: -1 });
            const shares = await models_1.PropertyShare.find({ leadId: lead._id }).populate('propertyId').sort({ createdAt: -1 });
            // Transform Mongoose document to JSON object and append child collections
            const leadObj = lead.toObject();
            leadObj.activities = activities.map(act => {
                const actObj = act.toObject();
                actObj.agent = actObj.agentId; // map virtual name compatibility
                delete actObj.agentId;
                return actObj;
            });
            leadObj.calls = calls;
            leadObj.messages = messages;
            leadObj.followups = followups;
            leadObj.sitevisits = sitevisits;
            leadObj.shares = shares;
            return res.json(leadObj);
        }
        catch (error) {
            console.error('[LeadController] Get lead details error:', error);
            return res.status(500).json({ error: 'Internal server error while fetching lead details' });
        }
    }
    /**
     * POST /api/leads
     * Create a new lead manually (agent/manager entry)
     */
    async createLead(req, res) {
        const orgId = req.orgId;
        const { fullName, phone, email, source, propertyType, budget, preferredLocation, notes } = req.body;
        if (!fullName || !phone || !source) {
            return res.status(400).json({ error: 'Full name, phone, and lead source are required' });
        }
        try {
            const newLead = await models_1.Lead.create({
                organizationId: orgId,
                fullName,
                phone,
                email: email || undefined,
                source,
                propertyType: propertyType || undefined,
                budget: budget ? Number(budget) : undefined,
                preferredLocation: preferredLocation || undefined,
                notes: notes || undefined,
                status: 'New',
                temperature: 'Cold',
            });
            // Log in timeline
            await models_1.Activity.create({
                organizationId: orgId,
                leadId: newLead._id,
                agentId: req.teamMember?.id,
                type: 'NOTE',
                content: `Lead manually registered by agent ${req.user?.email}.`,
            });
            // Run automatic round-robin / least-busy assignment
            const assignedLead = await leadAssignmentService_1.leadAssignmentService.assignLead({
                organizationId: orgId,
                leadId: newLead._id.toString(),
            });
            const result = assignedLead || newLead;
            // Auto-trigger call bridge if agent assigned & settings permit
            if (assignedLead && assignedLead.assignedAgentId) {
                console.log(`[LeadController] Instantly triggering call bridge for newly assigned lead ${result.fullName}`);
                await callService_1.callService.initiateCallBridge({
                    organizationId: orgId,
                    leadId: result._id.toString(),
                    agentId: assignedLead.assignedAgentId.toString(),
                    dryRun: true, // safe default dry run
                });
            }
            return res.status(201).json(result);
        }
        catch (error) {
            console.error('[LeadController] Create lead error:', error);
            return res.status(500).json({ error: 'Internal server error while creating lead' });
        }
    }
    /**
     * PUT /api/leads/:id
     * Update lead fields (e.g. status, temperature)
     */
    async updateLead(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        try {
            const baseQuery = this.buildRLSQuery(req);
            baseQuery._id = id;
            const lead = await models_1.Lead.findOne(baseQuery);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            const { fullName, phone, email, propertyType, budget, preferredLocation, status, temperature, notes } = req.body;
            // Track status and temperature shifts to log in timeline
            const previousStatus = lead.status;
            const previousTemp = lead.temperature;
            if (fullName !== undefined)
                lead.fullName = fullName;
            if (phone !== undefined)
                lead.phone = phone;
            if (email !== undefined)
                lead.email = email;
            if (propertyType !== undefined)
                lead.propertyType = propertyType;
            if (budget !== undefined)
                lead.budget = Number(budget);
            if (preferredLocation !== undefined)
                lead.preferredLocation = preferredLocation;
            if (status !== undefined)
                lead.status = status;
            if (temperature !== undefined)
                lead.temperature = temperature;
            if (notes !== undefined)
                lead.notes = notes;
            const updatedLead = await lead.save();
            // Log status changes
            if (status !== undefined && status !== previousStatus) {
                await models_1.Activity.create({
                    organizationId: orgId,
                    leadId: lead._id,
                    agentId: req.teamMember?.id,
                    type: 'STATUS_CHANGE',
                    content: `Lead status updated from "${previousStatus}" to "${status}".`,
                });
            }
            // Log temperature changes
            if (temperature !== undefined && temperature !== previousTemp) {
                await models_1.Activity.create({
                    organizationId: orgId,
                    leadId: lead._id,
                    agentId: req.teamMember?.id,
                    type: 'STATUS_CHANGE',
                    content: `Lead temperature rating changed from "${previousTemp}" to "${temperature}".`,
                });
            }
            return res.json(updatedLead);
        }
        catch (error) {
            console.error('[LeadController] Update lead error:', error);
            return res.status(500).json({ error: 'Internal server error during lead update' });
        }
    }
    /**
     * POST /api/leads/:id/call
     * Triggers Twilio outbound agent call bridge
     */
    async callLead(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        const dryRun = req.body.dryRun !== false; // defaults to true unless explicitly false
        try {
            const baseQuery = this.buildRLSQuery(req);
            baseQuery._id = id;
            const lead = await models_1.Lead.findOne(baseQuery);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            const agentId = lead.assignedAgentId || req.teamMember?.id;
            if (!agentId) {
                return res.status(400).json({ error: 'Cannot trigger call. No agent is assigned to this lead.' });
            }
            const result = await callService_1.callService.initiateCallBridge({
                organizationId: orgId,
                leadId: lead._id.toString(),
                agentId: agentId.toString(),
                dryRun,
            });
            return res.json(result);
        }
        catch (error) {
            console.error('[LeadController] Call trigger error:', error);
            return res.status(500).json({ error: error.message || 'Twilio calling service execution failed' });
        }
    }
    /**
     * POST /api/leads/:id/share
     * Shares property specifications to lead
     */
    async shareProperty(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        const { propertyId, channel } = req.body; // channel: 'WHATSAPP' | 'EMAIL'
        const agentId = req.teamMember?.id;
        if (!propertyId || !channel) {
            return res.status(400).json({ error: 'Property ID and channel are required' });
        }
        if (!agentId) {
            return res.status(403).json({ error: 'Active agent session required to share listings' });
        }
        try {
            const baseQuery = this.buildRLSQuery(req);
            baseQuery._id = id;
            const lead = await models_1.Lead.findOne(baseQuery);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            const result = await propertyShareService_1.propertyShareService.shareProperty({
                organizationId: orgId,
                leadId: lead._id.toString(),
                agentId,
                propertyId,
                channel,
                dryRun: true, // defaults to dry run messaging
            });
            return res.json(result);
        }
        catch (error) {
            console.error('[LeadController] Share property error:', error);
            return res.status(500).json({ error: error.message || 'Listing sharing execution failed' });
        }
    }
    /**
     * POST /api/leads/:id/notes
     * Append a quick discussion note to the timeline
     */
    async addNote(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ error: 'Note content is required' });
        }
        try {
            const baseQuery = this.buildRLSQuery(req);
            baseQuery._id = id;
            const lead = await models_1.Lead.findOne(baseQuery);
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            const activity = await models_1.Activity.create({
                organizationId: orgId,
                leadId: lead._id,
                agentId: req.teamMember?.id,
                type: 'NOTE',
                content: note,
            });
            return res.status(201).json(activity);
        }
        catch (error) {
            console.error('[LeadController] Add timeline note error:', error);
            return res.status(500).json({ error: 'Internal server error while logging note' });
        }
    }
    /**
     * POST /api/leads/:id/assign
     * Reassigns lead to a different agent (Admin/Manager only)
     */
    async assignAgent(req, res) {
        const { id } = req.params;
        const { agentId } = req.body;
        const orgId = req.orgId;
        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID is required' });
        }
        try {
            // Find lead ensuring organization check
            const lead = await models_1.Lead.findOne({ _id: id, organizationId: orgId });
            if (!lead) {
                return res.status(404).json({ error: 'Lead not found or unauthorized' });
            }
            // Check agent exists and belongs to organization
            const agent = await models_1.TeamMember.findOne({ _id: agentId, organizationId: orgId }).populate('profileId');
            if (!agent) {
                return res.status(404).json({ error: 'Target Sales Agent not found in organization' });
            }
            const profileData = agent.profileId;
            lead.assignedAgentId = agent._id;
            const updatedLead = await lead.save();
            // Log in timeline
            await models_1.Activity.create({
                organizationId: orgId,
                leadId: lead._id,
                agentId: req.teamMember?.id,
                type: 'STATUS_CHANGE',
                content: `Lead manually assigned to Agent ${profileData.fullName} by ${req.user?.email}.`,
            });
            return res.json(updatedLead);
        }
        catch (error) {
            console.error('[LeadController] Reassign agent error:', error);
            return res.status(500).json({ error: 'Internal server error during agent assignment' });
        }
    }
    /**
     * POST /api/leads/:id/whatsapp
     * Send WhatsApp template to lead
     */
    async sendWhatsApp(req, res) {
        const { id } = req.params;
        const { templateName, variables } = req.body;
        const orgId = req.orgId;
        const agentId = req.teamMember?.id || null;
        if (!templateName) {
            return res.status(400).json({ error: 'Template Name is required' });
        }
        try {
            const result = await messageService_1.messageService.sendWhatsAppTemplate({
                organizationId: orgId,
                leadId: id,
                agentId,
                templateName,
                variables: variables || {},
                dryRun: req.body.dryRun !== false,
            });
            return res.json(result);
        }
        catch (error) {
            console.error('[LeadController] Send WhatsApp error:', error);
            return res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
        }
    }
}
exports.LeadController = LeadController;
exports.leadController = new LeadController();
