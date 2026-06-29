import { 
  Lead, 
  TeamMember, 
  IntegrationSettings, 
  Activity, 
  ILead, 
  ITeamMember 
} from '../models';
import { notificationService } from './notificationService';

export class LeadAssignmentService {
  /**
   * Automatically assigns a lead to an agent based on the organization's strategy
   */
  async assignLead(params: {
    organizationId: string;
    leadId: string;
    overrideStrategy?: 'ROUND_ROBIN' | 'LEAST_BUSY' | 'MANUAL';
  }) {
    const { organizationId, leadId, overrideStrategy } = params;

    const lead = await Lead.findById(leadId);

    if (!lead) {
      throw new Error(`Lead with ID ${leadId} not found`);
    }

    // Resolve assignment strategy
    let strategy = overrideStrategy;
    if (!strategy) {
      const settings = await IntegrationSettings.findOne({ organizationId });
      strategy = settings?.assignmentMode || 'ROUND_ROBIN';
    }

    if (strategy === 'MANUAL') {
      console.log(`[LeadAssignmentService] Manual assignment selected for lead ${lead.fullName}. Skipping auto-assignment.`);
      return null;
    }

    // Find all active sales agents in the organization
    const agents = await TeamMember.find({
      organizationId,
      role: 'SALES_AGENT',
      status: 'ACTIVE',
    }).populate('profile');

    if (agents.length === 0) {
      console.warn(`[LeadAssignmentService] No active Sales Agents found in organization ${organizationId}. Lead unassigned.`);
      return null;
    }

    let selectedAgent = agents[0];

    if (strategy === 'ROUND_ROBIN') {
      // Find the agent who was assigned a lead least recently (or has no assignments)
      const agentAssignmentTimes = await Promise.all(
        agents.map(async (agent) => {
          const lastLead = await Lead.findOne({
            organizationId,
            assignedAgentId: agent._id,
          })
            .sort({ createdAt: -1 })
            .select('createdAt');
            
          return {
            agent,
            lastAssignedAt: lastLead ? lastLead.createdAt.getTime() : 0, // 0 means never assigned (highest priority)
          };
        })
      );

      // Sort by lastAssignedAt ascending
      agentAssignmentTimes.sort((a, b) => a.lastAssignedAt - b.lastAssignedAt);
      selectedAgent = agentAssignmentTimes[0].agent;

      console.log(`[LeadAssignmentService] Round-Robin selected agent: ${selectedAgent.profile?.fullName}`);
    } else if (strategy === 'LEAST_BUSY') {
      // Find the agent with the fewest active leads
      // Active statuses = New, Contacted, Interested, SiteVisitScheduled, Negotiation
      const activeStatuses = ['New', 'Contacted', 'Interested', 'SiteVisitScheduled', 'Negotiation'];
      
      const agentActiveCounts = await Promise.all(
        agents.map(async (agent) => {
          const count = await Lead.countDocuments({
            organizationId,
            assignedAgentId: agent._id,
            status: { $in: activeStatuses },
          });
          
          // Tie-breaker: find when they were last assigned a lead
          const lastLead = await Lead.findOne({ 
            organizationId, 
            assignedAgentId: agent._id 
          })
            .sort({ createdAt: -1 })
            .select('createdAt');

          return {
            agent,
            activeCount: count,
            lastAssignedAt: lastLead ? lastLead.createdAt.getTime() : 0,
          };
        })
      );

      // Sort by activeCount ascending, then by lastAssignedAt ascending
      agentActiveCounts.sort((a, b) => {
        if (a.activeCount !== b.activeCount) {
          return a.activeCount - b.activeCount;
        }
        return a.lastAssignedAt - b.lastAssignedAt;
      });

      selectedAgent = agentActiveCounts[0].agent;
      console.log(`[LeadAssignmentService] Least-Busy selected agent: ${selectedAgent.profile?.fullName} (Active leads: ${agentActiveCounts[0].activeCount})`);
    }

    // Perform assignment in DB
    lead.assignedAgentId = selectedAgent._id as any;
    const updatedLead = await lead.save();

    // Populate assignedAgent virtual
    await updatedLead.populate({
      path: 'assignedAgent',
      populate: { path: 'profile' }
    });

    // Log to Lead timeline
    await Activity.create({
      organizationId,
      leadId,
      agentId: selectedAgent._id,
      type: 'STATUS_CHANGE',
      content: `Lead automatically assigned to Agent ${selectedAgent.profile?.fullName} via ${strategy} strategy.`,
    });

    // Notify agent via in-app alert
    await notificationService.createNotification({
      organizationId,
      userId: selectedAgent.profileId.toString(),
      title: 'New Lead Assigned',
      message: `You have been assigned a new lead: ${lead.fullName} (${lead.source}). Respond instantly!`,
      type: 'NEW_LEAD',
    });

    return updatedLead;
  }
}

export const leadAssignmentService = new LeadAssignmentService();
