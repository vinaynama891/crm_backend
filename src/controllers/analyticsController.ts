import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { reportService } from '../services/reportService';
import { Lead, Call, FollowUp, SiteVisit, Property, Activity } from '../models';

export class AnalyticsController {
  /**
   * GET /api/analytics/dashboard
   * Fetch modern CRM dashboard KPIs
   */
  async getDashboardKPIs(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    const teamMember = req.teamMember!;

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Construct RLS base query filters
      const rlsBase: any = { organizationId: orgId };
      const leadRlsBase: any = { organizationId: orgId };

      if (teamMember.role === 'SALES_AGENT') {
        rlsBase.agentId = teamMember.id;
        leadRlsBase.assignedAgentId = teamMember.id;
      }

      // 1. New Leads Today
      const newLeadsToday = await Lead.countDocuments({
        ...leadRlsBase,
        createdAt: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      });

      // 2. Hot Leads
      const hotLeads = await Lead.countDocuments({
        ...leadRlsBase,
        temperature: 'Hot',
      });

      // 3. Calls Today
      const callsToday = await Call.countDocuments({
        ...rlsBase,
        createdAt: {
          $gte: todayStart,
          $lte: todayEnd,
        },
      });

      // 4. Follow-Ups Due (Today)
      const followUpsDue = await FollowUp.countDocuments({
        ...rlsBase,
        status: { $ne: 'COMPLETED' },
        scheduledAt: { $lte: todayEnd },
      });

      // 5. Site Visits Scheduled (Today/Upcoming)
      const siteVisitsScheduled = await SiteVisit.countDocuments({
        ...rlsBase,
        status: 'Scheduled',
      });

      // 6. Total Active Properties (Org wide)
      const totalActiveProperties = await Property.countDocuments({
        organizationId: orgId,
        availability: 'Available',
      });

      // 7. Conversion Rate (Booked / Total leads)
      const totalLeads = await Lead.countDocuments(leadRlsBase);
      const bookedLeads = await Lead.countDocuments({
        ...leadRlsBase,
        status: 'Booked',
      });
      const conversionRate = totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0;

      // 8. Lead Response Time
      const responseTimeStats = await reportService.getResponseTimeAnalytics(orgId);

      // 9. Recent Activities feed
      const activityQuery: any = { organizationId: orgId };
      
      if (teamMember.role === 'SALES_AGENT') {
        const myLeads = await Lead.find({ assignedAgentId: teamMember.id }).select('_id');
        const myLeadIds = myLeads.map((l) => l._id);
        activityQuery.leadId = { $in: myLeadIds };
      }

      const recentActivities = await Activity.find(activityQuery)
        .populate('leadId', 'fullName')
        .populate({
          path: 'agentId',
          populate: { path: 'profileId', select: 'fullName' }
        })
        .sort({ createdAt: -1 })
        .limit(8);

      return res.json({
        newLeadsToday,
        hotLeads,
        callsToday,
        followUpsDue,
        siteVisitsScheduled,
        totalActiveProperties,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        averageResponseTimeMinutes: responseTimeStats.averageResponseTimeMinutes,
        recentActivities: recentActivities.map((act) => {
          const leadData: any = act.leadId;
          const agentData: any = act.agentId;
          return {
            id: act._id.toString(),
            type: act.type,
            content: act.content,
            leadName: leadData?.fullName || 'Deleted Lead',
            leadId: leadData?._id?.toString() || '',
            agentName: agentData?.profileId?.fullName || 'System',
            createdAt: act.createdAt,
          };
        }),
      });

    } catch (error) {
      console.error('[AnalyticsController] Get dashboard KPIs error:', error);
      return res.status(500).json({ error: 'Internal server error calculating dashboard KPIs' });
    }
  }

  /**
   * GET /api/analytics/funnel
   * Fetch Funnel report
   */
  async getFunnel(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    try {
      const funnel = await reportService.getConversionFunnel(orgId);
      return res.json(funnel);
    } catch (error) {
      console.error('[AnalyticsController] Get funnel error:', error);
      return res.status(500).json({ error: 'Internal server error calculating funnel' });
    }
  }

  /**
   * GET /api/analytics/responsetime
   * Response Time Analytics
   */
  async getResponseTime(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    try {
      const stats = await reportService.getResponseTimeAnalytics(orgId);
      return res.json(stats);
    } catch (error) {
      console.error('[AnalyticsController] Get response time error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/analytics/agents
   * Leaderboard performance
   */
  async getAgentLeaderboard(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    try {
      const leaderboard = await reportService.getAgentPerformance(orgId);
      return res.json(leaderboard);
    } catch (error) {
      console.error('[AnalyticsController] Get agent leaderboard error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/analytics/export
   * Export reports as CSV attachment
   */
  async exportReport(req: AuthenticatedRequest, res: Response) {
    const orgId = req.orgId!;
    const { type } = req.query;

    if (!type || !['leads', 'agents', 'funnel'].includes(String(type))) {
      return res.status(400).json({ error: 'Invalid report type (leads, agents, funnel)' });
    }

    try {
      const csvContent = await reportService.exportReportCSV(orgId, type as any);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="estateflow_report_${type}_${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('[AnalyticsController] Export CSV error:', error);
      return res.status(500).json({ error: 'Failed to export report' });
    }
  }
}

export const analyticsController = new AnalyticsController();
