"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const models_1 = require("../models");
async function main() {
    console.log('Connecting to database for seeding...');
    await (0, db_1.connectDB)();
    console.log('Cleaning old collections...');
    await models_1.IntegrationSettings.deleteMany({});
    await models_1.Notification.deleteMany({});
    await models_1.SiteVisit.deleteMany({});
    await models_1.FollowUp.deleteMany({});
    await models_1.Call.deleteMany({});
    await models_1.Message.deleteMany({});
    await models_1.Activity.deleteMany({});
    await models_1.PropertyShare.deleteMany({});
    await models_1.Property.deleteMany({});
    await models_1.Lead.deleteMany({});
    await models_1.TeamMember.deleteMany({});
    await models_1.Profile.deleteMany({});
    await models_1.Organization.deleteMany({});
    console.log('Creating demo Organization...');
    const org = await models_1.Organization.create({
        name: 'EstateFlow Developers Ltd.',
        slug: 'estateflow-demo',
    });
    console.log('Creating user profiles & organization members...');
    const passwordHash = await bcryptjs_1.default.hash('Password123', 10);
    // Profiles
    const adminProfile = await models_1.Profile.create({
        email: 'admin@estateflow.com',
        passwordHash,
        fullName: 'Amit Sharma',
        phone: '+919876543210',
        avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    });
    const managerProfile = await models_1.Profile.create({
        email: 'manager@estateflow.com',
        passwordHash,
        fullName: 'Sanjay Dutt',
        phone: '+919988776655',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    });
    const agent1Profile = await models_1.Profile.create({
        email: 'agent1@estateflow.com',
        passwordHash,
        fullName: 'Priya Patel',
        phone: '+919900112233',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    });
    const agent2Profile = await models_1.Profile.create({
        email: 'agent2@estateflow.com',
        passwordHash,
        fullName: 'Rohan Mehra',
        phone: '+918877665544',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    });
    // Team Member Links
    const adminMember = await models_1.TeamMember.create({
        organizationId: org._id,
        profileId: adminProfile._id,
        role: 'ADMIN',
        status: 'ACTIVE',
    });
    const managerMember = await models_1.TeamMember.create({
        organizationId: org._id,
        profileId: managerProfile._id,
        role: 'SALES_MANAGER',
        status: 'ACTIVE',
    });
    const agent1Member = await models_1.TeamMember.create({
        organizationId: org._id,
        profileId: agent1Profile._id,
        role: 'SALES_AGENT',
        status: 'ACTIVE',
    });
    const agent2Member = await models_1.TeamMember.create({
        organizationId: org._id,
        profileId: agent2Profile._id,
        role: 'SALES_AGENT',
        status: 'ACTIVE',
    });
    console.log('Seeding Properties...');
    const properties = await models_1.Property.create([
        {
            organizationId: org._id,
            title: 'Premium 2BHK Lake View',
            projectName: 'Skyline Lakefront',
            location: 'Whitefield, Bangalore',
            address: 'ECC Road, Whitefield, Bangalore',
            propertyType: 'Apartment',
            price: 8500000,
            size: '1250 sqft',
            bedrooms: 2,
            bathrooms: 2,
            description: 'Elegant apartment facing the main lake with premium modular kitchen fitting.',
            amenities: ['Gym', 'Swimming Pool', 'Clubhouse', 'Power Backup'],
            availability: 'Available',
            brochureUrl: 'https://estateflow.com/skyline-lakefront.pdf',
            images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
        },
        {
            organizationId: org._id,
            title: 'Ultra Luxury 4BHK Villa',
            projectName: 'Green Meadows',
            location: 'Sarjapur Road, Bangalore',
            address: 'Near Carmelaram, Sarjapur Road, Bangalore',
            propertyType: 'Villa',
            price: 24500000,
            size: '3400 sqft',
            bedrooms: 4,
            bathrooms: 4,
            description: 'Independent private garden villa with high ceiling, private pool and home automation.',
            amenities: ['Gym', 'Private Garden', 'Swimming Pool', 'Security Guard', 'Solar Heating'],
            availability: 'Available',
            brochureUrl: 'https://estateflow.com/green-meadows.pdf',
            images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'],
        },
        {
            organizationId: org._id,
            title: 'Cozy 1BHK Studio Apartment',
            projectName: 'Metro Pods',
            location: 'Indiranagar, Bangalore',
            address: '12th Main, Indiranagar, Bangalore',
            propertyType: 'Studio',
            price: 4500000,
            size: '600 sqft',
            bedrooms: 1,
            bathrooms: 1,
            description: 'Perfect for working bachelors or couples, 200m from Indiranagar Metro Station.',
            amenities: ['24/7 Water', 'Lift', 'Security Cam', 'Terrace Garden'],
            availability: 'Hold',
            brochureUrl: 'https://estateflow.com/metro-pods.pdf',
            images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
        }
    ]);
    console.log('Seeding Leads & Activity Timelines...');
    // Lead 1: Hot Prospect assigned to Agent 1
    const lead1 = await models_1.Lead.create({
        organizationId: org._id,
        fullName: 'Ramesh Kumar',
        phone: '+919999888877',
        email: 'ramesh.k@gmail.com',
        source: 'Facebook Lead Ads',
        propertyType: 'Apartment',
        budget: 9000000,
        preferredLocation: 'Whitefield',
        status: 'Interested',
        temperature: 'Hot',
        assignedAgentId: agent1Member._id,
        notes: 'Requires high-floor unit with positive Vastu direction.',
    });
    await models_1.Activity.create([
        {
            organizationId: org._id,
            leadId: lead1._id,
            agentId: agent1Member._id,
            type: 'NOTE',
            content: 'Lead imported via Facebook Lead Ads. Auto-assigned to Priya Patel.',
        },
        {
            organizationId: org._id,
            leadId: lead1._id,
            agentId: agent1Member._id,
            type: 'CALL',
            content: 'Outgoing call bridge established. Duration: 125s. Outcome: Client interested in scheduling a site visit.',
        }
    ]);
    await models_1.Call.create({
        organizationId: org._id,
        leadId: lead1._id,
        agentId: agent1Member._id,
        callSid: 'CA1234567890abcdef',
        duration: 125,
        outcome: 'Completed',
        recordingUrl: 'https://api.twilio.com/mock-recordings/CA1234567890abcdef.mp3',
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(Date.now() - 3600000 + 125000),
    });
    // Lead 2: Site Visit Scheduled assigned to Agent 2
    const lead2 = await models_1.Lead.create({
        organizationId: org._id,
        fullName: 'Ananya Sen',
        phone: '+919876598765',
        email: 'ananya.sen@yahoo.com',
        source: 'MagicBricks Direct',
        propertyType: 'Villa',
        budget: 25000000,
        preferredLocation: 'Sarjapur Road',
        status: 'SiteVisitScheduled',
        temperature: 'Hot',
        assignedAgentId: agent2Member._id,
        notes: 'Visiting with family on coming Sunday. Demands pick-up facility.',
    });
    await models_1.Activity.create([
        {
            organizationId: org._id,
            leadId: lead2._id,
            agentId: agent2Member._id,
            type: 'NOTE',
            content: 'Lead imported via MagicBricks. Autoassigned to Rohan Mehra.',
        },
        {
            organizationId: org._id,
            leadId: lead2._id,
            agentId: agent2Member._id,
            type: 'SHARE',
            content: 'Shared Premium 4BHK Villa brochure via WhatsApp.',
        }
    ]);
    await models_1.PropertyShare.create({
        organizationId: org._id,
        leadId: lead2._id,
        agentId: agent2Member._id,
        propertyId: properties[1]._id,
        channel: 'WHATSAPP',
    });
    await models_1.SiteVisit.create({
        organizationId: org._id,
        leadId: lead2._id,
        agentId: agent2Member._id,
        propertyId: properties[1]._id,
        scheduledAt: new Date(Date.now() + 86400000 * 2), // 2 days later
        status: 'Scheduled',
        notes: 'Pick up needed from Sarjapur Outer Ring Road junction at 11 AM.',
    });
    // Lead 3: Contacted but cold, assigned to Agent 1
    const lead3 = await models_1.Lead.create({
        organizationId: org._id,
        fullName: 'Vijay Mallya',
        phone: '+918888877777',
        email: 'vijay.m@kforce.com',
        source: 'Google AdWords Search',
        propertyType: 'Apartment',
        budget: 15000000,
        preferredLocation: 'Indiranagar',
        status: 'Contacted',
        temperature: 'Cold',
        assignedAgentId: agent1Member._id,
        notes: 'Says budget is high, might check studio options.',
    });
    await models_1.FollowUp.create({
        organizationId: org._id,
        leadId: lead3._id,
        agentId: agent1Member._id,
        title: 'Call back for studio options check',
        notes: 'Needs to check project approvals and home loan compatibility.',
        scheduledAt: new Date(Date.now() + 3600000 * 4), // 4 hours later
        status: 'PENDING',
    });
    console.log('Seeding Integration Settings...');
    await models_1.IntegrationSettings.create({
        organizationId: org._id,
        twilioSid: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        twilioToken: 'your_twilio_auth_token',
        twilioNumber: '+1234567890',
        whatsappNumber: '+1234567890',
        resendApiKey: 're_123456789',
        webhookSecret: 'estateflow_webhook_secret_key',
        assignmentMode: 'ROUND_ROBIN',
    });
    console.log('Seeding completed successfully!');
    await mongoose_1.default.disconnect();
    console.log('Disconnected database client.');
    process.exit(0);
}
main().catch(err => {
    console.error('Error during database seeding:', err);
    process.exit(1);
});
