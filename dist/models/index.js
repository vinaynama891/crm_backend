"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationSettings = exports.Notification = exports.SiteVisit = exports.FollowUp = exports.Message = exports.Call = exports.Activity = exports.PropertyShare = exports.Property = exports.Lead = exports.TeamMember = exports.Profile = exports.Organization = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrganizationSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true }
}, { timestamps: true });
exports.Organization = mongoose_1.default.model('Organization', OrganizationSchema);
const ProfileSchema = new mongoose_1.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String },
    avatarUrl: { type: String }
}, { timestamps: true });
exports.Profile = mongoose_1.default.model('Profile', ProfileSchema);
const TeamMemberSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    profileId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile', required: true },
    role: { type: String, enum: ['ADMIN', 'SALES_MANAGER', 'SALES_AGENT'], default: 'SALES_AGENT', required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'INVITED'], default: 'ACTIVE', required: true }
}, { timestamps: true });
// Setup populate references for easy querying
TeamMemberSchema.virtual('profile', {
    ref: 'Profile',
    localField: 'profileId',
    foreignField: '_id',
    justOne: true
});
TeamMemberSchema.set('toObject', { virtuals: true });
TeamMemberSchema.set('toJSON', { virtuals: true });
exports.TeamMember = mongoose_1.default.model('TeamMember', TeamMemberSchema);
const LeadSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    source: { type: String, required: true },
    propertyType: { type: String },
    budget: { type: Number },
    preferredLocation: { type: String },
    status: {
        type: String,
        enum: ['New', 'Contacted', 'Interested', 'SiteVisitScheduled', 'Negotiation', 'Booked', 'Lost', 'NotResponding'],
        default: 'New',
        required: true
    },
    temperature: { type: String, enum: ['Cold', 'Warm', 'Hot'], default: 'Cold', required: true },
    assignedAgentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember' },
    notes: { type: String },
    followupDate: { type: Date },
    firstCallAt: { type: Date }
}, { timestamps: true });
LeadSchema.virtual('assignedAgent', {
    ref: 'TeamMember',
    localField: 'assignedAgentId',
    foreignField: '_id',
    justOne: true
});
LeadSchema.set('toObject', { virtuals: true });
LeadSchema.set('toJSON', { virtuals: true });
exports.Lead = mongoose_1.default.model('Lead', LeadSchema);
const PropertySchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    title: { type: String, required: true },
    projectName: { type: String, required: true },
    location: { type: String, required: true },
    address: { type: String, default: '' },
    propertyType: { type: String, required: true },
    price: { type: Number, required: true },
    size: { type: String, default: '' },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    description: { type: String, default: '' },
    amenities: { type: [String], default: [] },
    availability: { type: String, enum: ['Available', 'Hold', 'Sold'], default: 'Available', required: true },
    brochureUrl: { type: String },
    images: { type: [String], default: [] }
}, { timestamps: true });
exports.Property = mongoose_1.default.model('Property', PropertySchema);
const PropertyShareSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    propertyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Property', required: true },
    channel: { type: String, enum: ['WHATSAPP', 'EMAIL'], required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
PropertyShareSchema.virtual('property', {
    ref: 'Property',
    localField: 'propertyId',
    foreignField: '_id',
    justOne: true
});
PropertyShareSchema.set('toObject', { virtuals: true });
PropertyShareSchema.set('toJSON', { virtuals: true });
exports.PropertyShare = mongoose_1.default.model('PropertyShare', PropertyShareSchema);
const ActivitySchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember' },
    type: {
        type: String,
        enum: ['CALL', 'WHATSAPP', 'NOTE', 'SHARE', 'FOLLOWUP', 'STATUS_CHANGE', 'SITE_VISIT'],
        required: true
    },
    content: { type: String, required: true },
    referenceId: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });
ActivitySchema.virtual('agent', {
    ref: 'TeamMember',
    localField: 'agentId',
    foreignField: '_id',
    justOne: true
});
ActivitySchema.set('toObject', { virtuals: true });
ActivitySchema.set('toJSON', { virtuals: true });
exports.Activity = mongoose_1.default.model('Activity', ActivitySchema);
const CallSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    callSid: { type: String, required: true },
    duration: { type: Number, required: true },
    recordingUrl: { type: String },
    outcome: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true }
}, { timestamps: true });
exports.Call = mongoose_1.default.model('Call', CallSchema);
const MessageSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember' },
    templateName: { type: String, required: true },
    messageBody: { type: String, required: true },
    status: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
exports.Message = mongoose_1.default.model('Message', MessageSchema);
const FollowUpSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    title: { type: String, required: true },
    notes: { type: String },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'SNOOZED', 'RESCHEDULED'], default: 'PENDING', required: true }
}, { timestamps: true });
FollowUpSchema.virtual('lead', {
    ref: 'Lead',
    localField: 'leadId',
    foreignField: '_id',
    justOne: true
});
FollowUpSchema.virtual('agent', {
    ref: 'TeamMember',
    localField: 'agentId',
    foreignField: '_id',
    justOne: true
});
FollowUpSchema.set('toObject', { virtuals: true });
FollowUpSchema.set('toJSON', { virtuals: true });
exports.FollowUp = mongoose_1.default.model('FollowUp', FollowUpSchema);
const SiteVisitSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    leadId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Lead', required: true },
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
    propertyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Property', required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled', 'NoShow'], default: 'Scheduled', required: true },
    notes: { type: String, required: true }
}, { timestamps: true });
SiteVisitSchema.virtual('lead', {
    ref: 'Lead',
    localField: 'leadId',
    foreignField: '_id',
    justOne: true
});
SiteVisitSchema.virtual('property', {
    ref: 'Property',
    localField: 'propertyId',
    foreignField: '_id',
    justOne: true
});
SiteVisitSchema.virtual('agent', {
    ref: 'TeamMember',
    localField: 'agentId',
    foreignField: '_id',
    justOne: true
});
SiteVisitSchema.set('toObject', { virtuals: true });
SiteVisitSchema.set('toJSON', { virtuals: true });
exports.SiteVisit = mongoose_1.default.model('SiteVisit', SiteVisitSchema);
const NotificationSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, required: true },
    type: {
        type: String,
        enum: ['NEW_LEAD', 'FOLLOWUP_DUE', 'SITE_VISIT_REMINDER', 'MISSED_LEAD', 'PROPERTY_SHARED'],
        required: true
    }
}, { timestamps: true });
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
const IntegrationSettingsSchema = new mongoose_1.Schema({
    organizationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    twilioSid: { type: String },
    twilioToken: { type: String },
    twilioNumber: { type: String },
    whatsappNumber: { type: String },
    resendApiKey: { type: String },
    webhookSecret: { type: String },
    assignmentMode: { type: String, enum: ['ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL'], default: 'ROUND_ROBIN', required: true }
}, { timestamps: true });
exports.IntegrationSettings = mongoose_1.default.model('IntegrationSettings', IntegrationSettingsSchema);
