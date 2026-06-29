import mongoose, { Schema, Document } from 'mongoose';

// ------------------------------------------------------------------
// 1. Organization Schema
// ------------------------------------------------------------------
export interface IOrganization extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}
const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true }
}, { timestamps: true });

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);

// ------------------------------------------------------------------
// 2. Profile (User) Schema
// ------------------------------------------------------------------
export interface IProfile extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
const ProfileSchema = new Schema<IProfile>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  avatarUrl: { type: String }
}, { timestamps: true });

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);

// ------------------------------------------------------------------
// 3. Team Member Schema
// ------------------------------------------------------------------
export interface ITeamMember extends Document {
  organizationId: mongoose.Types.ObjectId;
  profileId: mongoose.Types.ObjectId;
  role: 'ADMIN' | 'SALES_MANAGER' | 'SALES_AGENT';
  status: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  createdAt: Date;
  updatedAt: Date;
  profile?: IProfile; // virtual/populate field
}
const TeamMemberSchema = new Schema<ITeamMember>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  profileId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
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

export const TeamMember = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);

// ------------------------------------------------------------------
// 4. Lead Schema
// ------------------------------------------------------------------
export interface ILead extends Document {
  organizationId: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  source: string;
  propertyType?: string;
  budget?: number;
  preferredLocation?: string;
  status: 'New' | 'Contacted' | 'Interested' | 'SiteVisitScheduled' | 'Negotiation' | 'Booked' | 'Lost' | 'NotResponding';
  temperature: 'Cold' | 'Warm' | 'Hot';
  assignedAgentId?: mongoose.Types.ObjectId;
  notes?: string;
  followupDate?: Date;
  firstCallAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: ITeamMember; // virtual
}
const LeadSchema = new Schema<ILead>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
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
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'TeamMember' },
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

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);

// ------------------------------------------------------------------
// 5. Property Schema
// ------------------------------------------------------------------
export interface IProperty extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  projectName: string;
  location: string;
  address: string;
  propertyType: string;
  price: number;
  size: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  amenities: string[];
  availability: 'Available' | 'Hold' | 'Sold';
  brochureUrl?: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}
const PropertySchema = new Schema<IProperty>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
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

export const Property = mongoose.model<IProperty>('Property', PropertySchema);

// ------------------------------------------------------------------
// 6. Property Share Schema
// ------------------------------------------------------------------
export interface IPropertyShare extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  channel: 'WHATSAPP' | 'EMAIL';
  createdAt: Date;
  property?: IProperty; // virtual
}
const PropertyShareSchema = new Schema<IPropertyShare>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
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

export const PropertyShare = mongoose.model<IPropertyShare>('PropertyShare', PropertyShareSchema);

// ------------------------------------------------------------------
// 7. Activity Timeline Schema
// ------------------------------------------------------------------
export interface IActivity extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  type: 'CALL' | 'WHATSAPP' | 'NOTE' | 'SHARE' | 'FOLLOWUP' | 'STATUS_CHANGE' | 'SITE_VISIT';
  content: string;
  referenceId?: string;
  createdAt: Date;
  agent?: ITeamMember; // virtual
}
const ActivitySchema = new Schema<IActivity>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember' },
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

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);

// ------------------------------------------------------------------
// 8. Call Log Schema
// ------------------------------------------------------------------
export interface ICall extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  callSid: string;
  duration: number;
  recordingUrl?: string;
  outcome: string;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const CallSchema = new Schema<ICall>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  callSid: { type: String, required: true },
  duration: { type: Number, required: true },
  recordingUrl: { type: String },
  outcome: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true }
}, { timestamps: true });

export const Call = mongoose.model<ICall>('Call', CallSchema);

// ------------------------------------------------------------------
// 9. Message Log Schema
// ------------------------------------------------------------------
export interface IMessage extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  templateName: string;
  messageBody: string;
  status: string;
  createdAt: Date;
}
const MessageSchema = new Schema<IMessage>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember' },
  templateName: { type: String, required: true },
  messageBody: { type: String, required: true },
  status: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

// ------------------------------------------------------------------
// 10. Follow-Up Schema
// ------------------------------------------------------------------
export interface IFollowUp extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  title: string;
  notes?: string;
  scheduledAt: Date;
  status: 'PENDING' | 'COMPLETED' | 'SNOOZED' | 'RESCHEDULED';
  createdAt: Date;
  updatedAt: Date;
  lead?: ILead; // virtual
  agent?: ITeamMember; // virtual
}
const FollowUpSchema = new Schema<IFollowUp>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember', required: true },
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

export const FollowUp = mongoose.model<IFollowUp>('FollowUp', FollowUpSchema);

// ------------------------------------------------------------------
// 11. Site Visit Schema
// ------------------------------------------------------------------
export interface ISiteVisit extends Document {
  organizationId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  lead?: ILead; // virtual
  property?: IProperty; // virtual
  agent?: ITeamMember; // virtual
}
const SiteVisitSchema = new Schema<ISiteVisit>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
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

export const SiteVisit = mongoose.model<ISiteVisit>('SiteVisit', SiteVisitSchema);

// ------------------------------------------------------------------
// 12. Notification Schema
// ------------------------------------------------------------------
export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  read: boolean;
  type: 'NEW_LEAD' | 'FOLLOWUP_DUE' | 'SITE_VISIT_REMINDER' | 'MISSED_LEAD' | 'PROPERTY_SHARED';
  createdAt: Date;
  updatedAt: Date;
}
const NotificationSchema = new Schema<INotification>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'Profile', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false, required: true },
  type: { 
    type: String, 
    enum: ['NEW_LEAD', 'FOLLOWUP_DUE', 'SITE_VISIT_REMINDER', 'MISSED_LEAD', 'PROPERTY_SHARED'], 
    required: true 
  }
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// ------------------------------------------------------------------
// 13. Integration Settings Schema
// ------------------------------------------------------------------
export interface IIntegrationSettings extends Document {
  organizationId: mongoose.Types.ObjectId;
  twilioSid?: string;
  twilioToken?: string;
  twilioNumber?: string;
  whatsappNumber?: string;
  resendApiKey?: string;
  webhookSecret?: string;
  assignmentMode: 'ROUND_ROBIN' | 'LEAST_BUSY' | 'MANUAL';
  createdAt: Date;
  updatedAt: Date;
}
const IntegrationSettingsSchema = new Schema<IIntegrationSettings>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
  twilioSid: { type: String },
  twilioToken: { type: String },
  twilioNumber: { type: String },
  whatsappNumber: { type: String },
  resendApiKey: { type: String },
  webhookSecret: { type: String },
  assignmentMode: { type: String, enum: ['ROUND_ROBIN', 'LEAST_BUSY', 'MANUAL'], default: 'ROUND_ROBIN', required: true }
}, { timestamps: true });

export const IntegrationSettings = mongoose.model<IIntegrationSettings>('IntegrationSettings', IntegrationSettingsSchema);
