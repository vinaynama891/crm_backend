import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { SiteVisit, Lead, Property, Activity } from '../models';
import { notificationService } from '../services/notificationService';

export class SiteVisitController {
  /**
   * Helper to build RLS filter
   */
  private buildRLSQuery(req: AuthenticatedRequest) {
    const orgId = req.orgId!;
    const teamMember = req.teamMember!;

    const query: any = {
      organizationId: orgId,
    };

    if (teamMember.role === 'SALES_AGENT') {
      query.agentId = teamMember.id;
    }

    return query;
  }

  /**
   * GET /api/sitevisits
   * List site visits
   */
  async getSiteVisits(req: AuthenticatedRequest, res: Response) {
    try {
      const query = this.buildRLSQuery(req);
      const { status } = req.query;

      if (status) {
        query.status = status as string;
      }

      const visits = await SiteVisit.find(query)
        .populate('lead')
        .populate('property')
        .populate({
          path: 'agent',
          populate: { path: 'profileId', select: 'fullName' }
        })
        .sort({ scheduledAt: 1 });

      return res.json(visits);
    } catch (error) {
      console.error('[SiteVisitController] Get site visits error:', error);
      return res.status(500).json({ error: 'Internal server error while fetching site visits' });
    }
  }

  /**
   * POST /api/sitevisits
   * Schedule a site visit
   */
  async createSiteVisit(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    const agentId = req.teamMember?.id!;
    const { leadId, propertyId, scheduledAt, notes } = req.body;

    if (!leadId || !propertyId || !scheduledAt) {
      return res.status(400).json({ error: 'Lead ID, Property ID, and Scheduled At datetime are required' });
    }

    try {
      const leadQuery: any = {
        _id: leadId,
        organizationId: orgId,
      };
      if (req.teamMember?.role === 'SALES_AGENT') {
        leadQuery.assignedAgentId = agentId;
      }

      // Validate lead
      const lead = await Lead.findOne(leadQuery);

      if (!lead) {
        return res.status(404).json({ error: 'Lead not found or unauthorized' });
      }

      // Validate property
      const property = await Property.findOne({ _id: propertyId, organizationId: orgId });

      if (!property) {
        return res.status(404).json({ error: 'Property not found in inventory' });
      }

      const visit = await SiteVisit.create({
        organizationId: orgId,
        leadId,
        agentId: req.body.agentId || agentId,
        propertyId,
        scheduledAt: new Date(scheduledAt),
        status: 'Scheduled',
        notes: notes || '',
      });

      await visit.populate({
        path: 'agent',
        populate: { path: 'profileId' }
      });

      const agentData: any = visit.agent;

      // Update lead status to SiteVisitScheduled
      lead.status = 'SiteVisitScheduled';
      await lead.save();

      // Log in timeline
      await Activity.create({
        organizationId: orgId,
        leadId,
        agentId: visit.agentId,
        type: 'SITE_VISIT',
        content: `Site visit scheduled for property "${property.title}" on ${new Date(scheduledAt).toLocaleString()}.`,
        referenceId: visit._id.toString(),
      });

      // Trigger status change log
      await Activity.create({
        organizationId: orgId,
        leadId,
        agentId: visit.agentId,
        type: 'STATUS_CHANGE',
        content: 'Lead status updated to Site Visit Scheduled.',
      });

      // Notify agent
      await notificationService.createNotification({
        organizationId: orgId,
        userId: agentData?.profileId?.toString() || '',
        title: 'New Site Visit Scheduled',
        message: `Site visit scheduled for lead ${lead.fullName} at "${property.title}".`,
        type: 'SITE_VISIT_REMINDER',
      });

      return res.status(201).json(visit);
    } catch (error) {
      console.error('[SiteVisitController] Create site visit error:', error);
      return res.status(500).json({ error: 'Internal server error creating site visit' });
    }
  }

  /**
   * PUT /api/sitevisits/:id/status
   * Update status of site visit (Scheduled, Completed, Cancelled, NoShow)
   */
  async updateStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, notes } = req.body;
    const orgId = req.orgId!;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    try {
      const visit = await SiteVisit.findOne({ _id: id, organizationId: orgId })
        .populate('lead')
        .populate('property');

      if (!visit) {
        return res.status(404).json({ error: 'Site visit not found or unauthorized' });
      }

      visit.status = status as any;
      if (notes !== undefined) visit.notes = notes;
      
      const updated = await visit.save();

      const propertyData: any = visit.property;
      const leadData: any = visit.lead;

      // Log in timeline
      await Activity.create({
        organizationId: orgId,
        leadId: visit.leadId,
        agentId: req.teamMember?.id,
        type: 'SITE_VISIT',
        content: `Site visit to "${propertyData?.title}" updated to status: ${status}.`,
        referenceId: visit._id.toString(),
      });

      // Update lead status based on visit outcome
      if (status === 'Completed') {
        // If completed, check if lead status should move to Negotiation
        if (leadData && (leadData.status === 'SiteVisitScheduled' || leadData.status === 'Interested')) {
          await Lead.updateOne(
            { _id: visit.leadId },
            { $set: { status: 'Negotiation' } }
          );

          await Activity.create({
            organizationId: orgId,
            leadId: visit.leadId,
            agentId: req.teamMember?.id,
            type: 'STATUS_CHANGE',
            content: 'Lead status auto-updated to Negotiation after site visit completion.',
          });
        }
      }

      return res.json(updated);
    } catch (error) {
      console.error('[SiteVisitController] Update status error:', error);
      return res.status(500).json({ error: 'Internal server error updating site visit' });
    }
  }
}

export const siteVisitController = new SiteVisitController();
