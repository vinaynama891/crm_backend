"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyController = exports.PropertyController = void 0;
const models_1 = require("../models");
class PropertyController {
    /**
     * GET /api/properties
     * Query properties with filters (search, price, location, bedrooms)
     */
    async getProperties(req, res) {
        const orgId = req.orgId;
        try {
            const { search, minPrice, maxPrice, bedrooms, propertyType, availability } = req.query;
            const query = {
                organizationId: orgId,
            };
            if (search) {
                const regex = new RegExp(String(search), 'i');
                query.$or = [
                    { title: regex },
                    { projectName: regex },
                    { location: regex },
                ];
            }
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice)
                    query.price.$gte = parseFloat(String(minPrice));
                if (maxPrice)
                    query.price.$lte = parseFloat(String(maxPrice));
            }
            if (bedrooms) {
                query.bedrooms = parseInt(String(bedrooms));
            }
            if (propertyType) {
                query.propertyType = String(propertyType);
            }
            if (availability) {
                query.availability = availability;
            }
            const properties = await models_1.Property.find(query)
                .sort({ createdAt: -1 });
            return res.json(properties);
        }
        catch (error) {
            console.error('[PropertyController] Get properties error:', error);
            return res.status(500).json({ error: 'Internal server error while fetching properties' });
        }
    }
    /**
     * GET /api/properties/:id
     * Get single property
     */
    async getPropertyById(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        try {
            const property = await models_1.Property.findOne({
                _id: id,
                organizationId: orgId,
            });
            if (!property) {
                return res.status(404).json({ error: 'Property not found or unauthorized' });
            }
            return res.json(property);
        }
        catch (error) {
            console.error('[PropertyController] Get property by ID error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * POST /api/properties
     * Add a property (ADMIN and SALES_MANAGER only)
     */
    async createProperty(req, res) {
        const orgId = req.orgId;
        const { title, projectName, location, address, propertyType, price, size, bedrooms, bathrooms, description, amenities, availability, brochureUrl, images // Expecting array of image URLs
         } = req.body;
        if (!title || !projectName || !location || !price || !propertyType) {
            return res.status(400).json({ error: 'Missing required property details' });
        }
        try {
            const property = await models_1.Property.create({
                organizationId: orgId,
                title,
                projectName,
                location,
                address: address || '',
                propertyType,
                price: parseFloat(price),
                size: size || '',
                bedrooms: parseInt(bedrooms) || 0,
                bathrooms: parseInt(bathrooms) || 0,
                description: description || '',
                amenities: Array.isArray(amenities) ? amenities : [],
                availability: availability || 'Available',
                brochureUrl: brochureUrl || undefined,
                images: Array.isArray(images) ? images : [],
            });
            return res.status(201).json(property);
        }
        catch (error) {
            console.error('[PropertyController] Create property error:', error);
            return res.status(500).json({ error: 'Internal server error creating property' });
        }
    }
    /**
     * PUT /api/properties/:id
     * Edit property details (ADMIN and SALES_MANAGER only)
     */
    async updateProperty(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        const updates = req.body;
        try {
            const property = await models_1.Property.findOne({ _id: id, organizationId: orgId });
            if (!property) {
                return res.status(404).json({ error: 'Property not found or unauthorized' });
            }
            if (updates.title !== undefined)
                property.title = updates.title;
            if (updates.projectName !== undefined)
                property.projectName = updates.projectName;
            if (updates.location !== undefined)
                property.location = updates.location;
            if (updates.address !== undefined)
                property.address = updates.address;
            if (updates.propertyType !== undefined)
                property.propertyType = updates.propertyType;
            if (updates.price !== undefined)
                property.price = parseFloat(updates.price);
            if (updates.size !== undefined)
                property.size = updates.size;
            if (updates.bedrooms !== undefined)
                property.bedrooms = parseInt(updates.bedrooms);
            if (updates.bathrooms !== undefined)
                property.bathrooms = parseInt(updates.bathrooms);
            if (updates.description !== undefined)
                property.description = updates.description;
            if (updates.amenities !== undefined)
                property.amenities = Array.isArray(updates.amenities) ? updates.amenities : [];
            if (updates.availability !== undefined)
                property.availability = updates.availability;
            if (updates.brochureUrl !== undefined)
                property.brochureUrl = updates.brochureUrl;
            if (updates.images !== undefined)
                property.images = Array.isArray(updates.images) ? updates.images : [];
            const updated = await property.save();
            return res.json(updated);
        }
        catch (error) {
            console.error('[PropertyController] Update property error:', error);
            return res.status(500).json({ error: 'Internal server error updating property' });
        }
    }
    /**
     * DELETE /api/properties/:id
     * Remove property from inventory (ADMIN and SALES_MANAGER only)
     */
    async deleteProperty(req, res) {
        const { id } = req.params;
        const orgId = req.orgId;
        try {
            const property = await models_1.Property.findOne({ _id: id, organizationId: orgId });
            if (!property) {
                return res.status(404).json({ error: 'Property not found or unauthorized' });
            }
            await property.deleteOne();
            return res.json({ message: 'Property deleted successfully' });
        }
        catch (error) {
            console.error('[PropertyController] Delete property error:', error);
            return res.status(500).json({ error: 'Internal server error deleting property' });
        }
    }
}
exports.PropertyController = PropertyController;
exports.propertyController = new PropertyController();
