"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyShareService = exports.PropertyShareService = void 0;
const models_1 = require("../models");
const messageService_1 = require("./messageService");
class PropertyShareService {
    /**
     * Share a property with a lead via WhatsApp or Email
     */
    async shareProperty(params) {
        const { organizationId, leadId, agentId, propertyId, channel, dryRun = false } = params;
        const lead = await models_1.Lead.findById(leadId);
        const property = await models_1.Property.findById(propertyId);
        const agent = await models_1.TeamMember.findById(agentId).populate('profile');
        if (!lead || !property || !agent) {
            throw new Error('Lead, Property, or Agent not found for sharing');
        }
        // Format property pricing for presentation
        const formattedPrice = property.price >= 10000000
            ? `₹${(property.price / 10000000).toFixed(2)} Cr`
            : property.price >= 100000
                ? `₹${(property.price / 100000).toFixed(2)} L`
                : `₹${property.price.toLocaleString()}`;
        // Create the sharing content
        const propertyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/public/properties/${property._id}`;
        const brochureLink = property.brochureUrl ? `\nBrochure: ${property.brochureUrl}` : '';
        const imageLink = property.images.length > 0 ? `\nPhoto: ${property.images[0]}` : '';
        const messageText = `Hi ${lead.fullName},

Here are the details for *${property.title}* (${property.projectName}) located in *${property.location}*:
- *Type*: ${property.propertyType}
- *Configuration*: ${property.bedrooms} BHK (${property.size})
- *Price*: ${formattedPrice}
- *Details*: ${property.description}
${imageLink}${brochureLink}

View more info here: ${propertyUrl}

Please let me know if you would like to schedule a site visit!
Best regards,
${agent.profile?.fullName}
EstateFlow Team`;
        // Save to property shares table
        const share = await models_1.PropertyShare.create({
            organizationId,
            leadId,
            agentId,
            propertyId,
            channel,
        });
        if (channel === 'WHATSAPP') {
            // Send WhatsApp message using Twilio WhatsApp client
            await messageService_1.messageService.sendWhatsAppTemplate({
                organizationId,
                leadId,
                agentId,
                templateName: 'Welcome', // fallback custom template body
                variables: {},
                dryRun,
            });
            // Update message with actual customized body
            await models_1.Message.create({
                organizationId,
                leadId,
                agentId,
                templateName: 'PropertyShare',
                messageBody: messageText,
                status: dryRun ? 'sent_simulated' : 'sent',
            });
        }
        else if (channel === 'EMAIL') {
            if (lead.email) {
                const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #6366f1;">${property.title}</h2>
            <p style="font-size: 16px; color: #374151;">Hi ${lead.fullName},</p>
            <p style="font-size: 16px; color: #374151;">Here are the details of the property you might be interested in:</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Project:</strong> ${property.projectName}</p>
              <p><strong>Location:</strong> ${property.location}</p>
              <p><strong>Price:</strong> ${formattedPrice}</p>
              <p><strong>Configuration:</strong> ${property.bedrooms} BHK, ${property.size}</p>
              <p>${property.description}</p>
            </div>
            ${property.brochureUrl ? `<p><a href="${property.brochureUrl}" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Brochure</a></p>` : ''}
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">Best regards,<br><strong>${agent.profile?.fullName}</strong><br>EstateFlow Sales Team</p>
          </div>
        `;
                await messageService_1.messageService.sendEmail({
                    organizationId,
                    leadId,
                    subject: `Property Details: ${property.title} - ${property.projectName}`,
                    htmlContent,
                    dryRun,
                });
            }
        }
        // Log in activity timeline
        await models_1.Activity.create({
            organizationId,
            leadId,
            agentId,
            type: 'SHARE',
            content: `Shared property "${property.title}" via ${channel}.`,
            referenceId: share._id.toString(),
        });
        // Auto-update lead status to Interested if status was Contacted or New
        if (lead.status === 'New' || lead.status === 'Contacted') {
            lead.status = 'Interested';
            await lead.save();
            await models_1.Activity.create({
                organizationId,
                leadId,
                agentId,
                type: 'STATUS_CHANGE',
                content: 'Lead status auto-updated to Interested after property details shared.',
            });
        }
        return { success: true, shareId: share._id.toString() };
    }
}
exports.PropertyShareService = PropertyShareService;
exports.propertyShareService = new PropertyShareService();
