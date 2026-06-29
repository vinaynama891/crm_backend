"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = exports.ReportService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
class ReportService {
    /**
     * Get Conversion Funnel Analytics
     */
    async getConversionFunnel(organizationId) {
        const orgIdObj = new mongoose_1.default.Types.ObjectId(organizationId);
        const totalLeads = await models_1.Lead.countDocuments({ organizationId: orgIdObj });
        // Status ranges that qualify for each stage
        const contactedCount = await models_1.Lead.countDocuments({
            organizationId: orgIdObj,
            status: { $in: ['Contacted', 'Interested', 'SiteVisitScheduled', 'Negotiation', 'Booked'] },
        });
        const interestedCount = await models_1.Lead.countDocuments({
            organizationId: orgIdObj,
            status: { $in: ['Interested', 'SiteVisitScheduled', 'Negotiation', 'Booked'] },
        });
        const siteVisitsCount = await models_1.Lead.countDocuments({
            organizationId: orgIdObj,
            status: { $in: ['SiteVisitScheduled', 'Negotiation', 'Booked'] },
        });
        const negotiationCount = await models_1.Lead.countDocuments({
            organizationId: orgIdObj,
            status: { $in: ['Negotiation', 'Booked'] },
        });
        const bookedCount = await models_1.Lead.countDocuments({
            organizationId: orgIdObj,
            status: 'Booked',
        });
        const stages = [
            { name: 'Leads', count: totalLeads },
            { name: 'Contacted', count: contactedCount },
            { name: 'Interested', count: interestedCount },
            { name: 'Site Visits', count: siteVisitsCount },
            { name: 'Negotiation', count: negotiationCount },
            { name: 'Booked', count: bookedCount },
        ];
        // Calculate rates
        const funnelData = stages.map((stage, index) => {
            const conversionRate = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
            let dropOffRate = 0;
            if (index > 0) {
                const prevCount = stages[index - 1].count;
                dropOffRate = prevCount > 0 ? ((prevCount - stage.count) / prevCount) * 100 : 0;
            }
            return {
                ...stage,
                conversionRate: parseFloat(conversionRate.toFixed(1)),
                dropOffRate: parseFloat(dropOffRate.toFixed(1)),
            };
        });
        return funnelData;
    }
    /**
     * Get Lead Source Performance
     */
    async getLeadsBySource(organizationId) {
        const orgIdObj = new mongoose_1.default.Types.ObjectId(organizationId);
        const leads = await models_1.Lead.aggregate([
            { $match: { organizationId: orgIdObj } },
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ]);
        const bookedLeads = await models_1.Lead.aggregate([
            { $match: { organizationId: orgIdObj, status: 'Booked' } },
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ]);
        const bookedMap = new Map(bookedLeads.map((item) => [item._id, item.count]));
        return leads.map((item) => {
            const count = item.count;
            const booked = bookedMap.get(item._id) || 0;
            const conversionRate = count > 0 ? (booked / count) * 100 : 0;
            return {
                source: item._id,
                count,
                booked,
                conversionRate: parseFloat(conversionRate.toFixed(1)),
            };
        });
    }
    /**
     * Get Response Time Analytics
     */
    async getResponseTimeAnalytics(organizationId) {
        const orgIdObj = new mongoose_1.default.Types.ObjectId(organizationId);
        // Select leads that have firstCallAt populated
        const respondedLeads = await models_1.Lead.find({
            organizationId: orgIdObj,
            firstCallAt: { $ne: null },
        }).populate({
            path: 'assignedAgent',
            populate: { path: 'profile' }
        });
        if (respondedLeads.length === 0) {
            return {
                averageResponseTimeMinutes: 0,
                fastestAgent: 'N/A',
                slowestAgent: 'N/A',
                trends: [],
            };
        }
        // Calculate response time in minutes for each
        const times = respondedLeads.map((lead) => {
            const diffMs = lead.firstCallAt.getTime() - lead.createdAt.getTime();
            return {
                agentId: lead.assignedAgentId?.toString(),
                agentName: lead.assignedAgent?.profile?.fullName || 'Unassigned',
                minutes: diffMs / (1000 * 60),
            };
        });
        const avgTime = times.reduce((sum, t) => sum + t.minutes, 0) / times.length;
        // Group by agent to find fastest/slowest
        const agentTimes = {};
        times.forEach((t) => {
            if (t.agentId) {
                if (!agentTimes[t.agentId]) {
                    agentTimes[t.agentId] = { name: t.agentName, sum: 0, count: 0 };
                }
                agentTimes[t.agentId].sum += t.minutes;
                agentTimes[t.agentId].count += 1;
            }
        });
        const agentAverages = Object.keys(agentTimes).map((id) => ({
            name: agentTimes[id].name,
            avg: agentTimes[id].sum / agentTimes[id].count,
        }));
        agentAverages.sort((a, b) => a.avg - b.avg);
        const fastestAgent = agentAverages.length > 0 ? `${agentAverages[0].name} (${agentAverages[0].avg.toFixed(1)} mins)` : 'N/A';
        const slowestAgent = agentAverages.length > 0 ? `${agentAverages[agentAverages.length - 1].name} (${agentAverages[agentAverages.length - 1].avg.toFixed(1)} mins)` : 'N/A';
        return {
            averageResponseTimeMinutes: parseFloat(avgTime.toFixed(1)),
            fastestAgent,
            slowestAgent,
        };
    }
    /**
     * Get Agent Performance Dashboard
     */
    async getAgentPerformance(organizationId) {
        const orgIdObj = new mongoose_1.default.Types.ObjectId(organizationId);
        const agents = await models_1.TeamMember.find({
            organizationId: orgIdObj,
            role: 'SALES_AGENT',
        }).populate('profile');
        const performanceData = await Promise.all(agents.map(async (agent) => {
            const assignedCount = await models_1.Lead.countDocuments({
                organizationId: orgIdObj,
                assignedAgentId: agent._id
            });
            const bookingsCount = await models_1.Lead.countDocuments({
                organizationId: orgIdObj,
                assignedAgentId: agent._id,
                status: 'Booked'
            });
            const callsMade = await models_1.Call.countDocuments({
                organizationId: orgIdObj,
                agentId: agent._id
            });
            const callsConnected = await models_1.Call.countDocuments({
                organizationId: orgIdObj,
                agentId: agent._id,
                outcome: 'completed'
            });
            const followupsCompleted = await models_1.FollowUp.countDocuments({
                organizationId: orgIdObj,
                agentId: agent._id,
                status: 'COMPLETED'
            });
            const siteVisitsScheduled = await models_1.SiteVisit.countDocuments({
                organizationId: orgIdObj,
                agentId: agent._id
            });
            const conversionRate = assignedCount > 0 ? (bookingsCount / assignedCount) * 100 : 0;
            return {
                agentId: agent._id.toString(),
                name: agent.profile?.fullName || 'Anonymous Agent',
                email: agent.profile?.email || 'N/A',
                leadsAssigned: assignedCount,
                callsMade,
                callsConnected,
                followupsCompleted,
                siteVisitsScheduled,
                bookingsGenerated: bookingsCount,
                conversionRate: parseFloat(conversionRate.toFixed(1)),
            };
        }));
        // Sort by bookings generated descending
        performanceData.sort((a, b) => b.bookingsGenerated - a.bookingsGenerated);
        return performanceData;
    }
    /**
     * Export report data as CSV text
     */
    async exportReportCSV(organizationId, reportType) {
        const orgIdObj = new mongoose_1.default.Types.ObjectId(organizationId);
        if (reportType === 'leads') {
            const leads = await models_1.Lead.find({ organizationId: orgIdObj }).populate({
                path: 'assignedAgent',
                populate: { path: 'profile' },
            });
            const headers = 'ID,Full Name,Phone,Email,Source,Property Type,Budget,Location,Status,Temperature,Agent,Created At\n';
            const rows = leads.map((l) => {
                return `"${l._id}","${l.fullName}","${l.phone}","${l.email || ''}","${l.source}","${l.propertyType || ''}",${l.budget || 0},"${l.preferredLocation || ''}","${l.status}","${l.temperature}","${l.assignedAgent?.profile?.fullName || 'Unassigned'}","${l.createdAt.toISOString()}"`;
            });
            return headers + rows.join('\n');
        }
        if (reportType === 'agents') {
            const agentPerf = await this.getAgentPerformance(organizationId);
            const headers = 'Agent Name,Email,Leads Assigned,Calls Made,Calls Connected,Followups Completed,Site Visits Scheduled,Bookings,Conversion %\n';
            const rows = agentPerf.map((a) => {
                return `"${a.name}","${a.email}",${a.leadsAssigned},${a.callsMade},${a.callsConnected},${a.followupsCompleted},${a.siteVisitsScheduled},${a.bookingsGenerated},${a.conversionRate}`;
            });
            return headers + rows.join('\n');
        }
        if (reportType === 'funnel') {
            const funnel = await this.getConversionFunnel(organizationId);
            const headers = 'Funnel Stage,Count,Conversion Rate %,Drop Off Rate %\n';
            const rows = funnel.map((f) => {
                return `"${f.name}",${f.count},${f.conversionRate},${f.dropOffRate}`;
            });
            return headers + rows.join('\n');
        }
        return '';
    }
}
exports.ReportService = ReportService;
exports.reportService = new ReportService();
