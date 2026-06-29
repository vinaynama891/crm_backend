"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token missing or invalid' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET || 'estateflow_jwt_secret_key_123!';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        req.user = decoded;
        // Fetch team member details for the current active organization context
        const headerOrgId = req.headers['x-organization-id'];
        const query = {
            profileId: decoded.id,
            status: 'ACTIVE',
        };
        if (headerOrgId) {
            query.organizationId = headerOrgId;
        }
        const teamMember = await models_1.TeamMember.findOne(query);
        if (teamMember) {
            req.teamMember = {
                id: teamMember._id.toString(),
                role: teamMember.role,
                organizationId: teamMember.organizationId.toString(),
            };
            req.orgId = teamMember.organizationId.toString();
        }
        next();
    }
    catch (error) {
        console.error('[AuthMiddleware] JWT Verification failed:', error);
        return res.status(403).json({ error: 'Token expired or invalid' });
    }
};
exports.authenticateJWT = authenticateJWT;
/**
 * Middleware to restrict access based on user Roles
 */
const requireRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.teamMember) {
            return res.status(403).json({ error: 'Unauthorized: No active organization membership' });
        }
        if (!allowedRoles.includes(req.teamMember.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
