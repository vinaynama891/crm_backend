"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
class AuthController {
    /**
     * POST /api/auth/signup
     * Multi-tenant signup: Creates Profile, Organization, and maps as ADMIN
     */
    async signup(req, res) {
        const { email, password, fullName, phone, companyName } = req.body;
        if (!email || !password || !fullName || !companyName) {
            return res.status(400).json({ error: 'Email, password, name, and company name are required' });
        }
        try {
            // Check if user already exists
            const existingUser = await models_1.Profile.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }
            // Create Organization
            const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const org = await models_1.Organization.create({
                name: companyName,
                slug,
            });
            // Create Profile
            const passwordHash = await bcryptjs_1.default.hash(password, 10);
            const profile = await models_1.Profile.create({
                email,
                passwordHash,
                fullName,
                phone,
            });
            // Create Team Member mapping (SALES_AGENT role)
            await models_1.TeamMember.create({
                organizationId: org._id,
                profileId: profile._id,
                role: 'SALES_AGENT',
                status: 'ACTIVE',
            });
            // Initialize default Integration Settings
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
            // Issue JWT
            const secret = process.env.JWT_SECRET || 'estateflow_jwt_secret_key_123!';
            const token = jsonwebtoken_1.default.sign({ id: profile._id.toString(), email: profile.email }, secret, {
                expiresIn: '24h',
            });
            return res.status(201).json({
                token,
                user: {
                    id: profile._id.toString(),
                    email: profile.email,
                    fullName: profile.fullName,
                },
                organization: {
                    id: org._id.toString(),
                    name: org.name,
                    slug: org.slug,
                    role: 'SALES_AGENT',
                },
            });
        }
        catch (error) {
            console.error('[AuthController] Signup error:', error);
            return res.status(500).json({ error: 'Internal server error during signup' });
        }
    }
    /**
     * POST /api/auth/login
     * Validates credentials and returns JWT
     */
    async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        try {
            const profile = await models_1.Profile.findOne({ email });
            if (!profile) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            const isPasswordMatch = await bcryptjs_1.default.compare(password, profile.passwordHash);
            if (!isPasswordMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            // Resolve active organization membership
            const teamMembers = await models_1.TeamMember.find({ profileId: profile._id }).populate('organizationId');
            const activeMember = teamMembers.find(m => m.status === 'ACTIVE');
            if (!activeMember) {
                return res.status(403).json({ error: 'Your account is inactive. Please contact support.' });
            }
            const organization = activeMember.organizationId;
            const secret = process.env.JWT_SECRET || 'estateflow_jwt_secret_key_123!';
            const token = jsonwebtoken_1.default.sign({ id: profile._id.toString(), email: profile.email }, secret, {
                expiresIn: '24h',
            });
            return res.json({
                token,
                user: {
                    id: profile._id.toString(),
                    email: profile.email,
                    fullName: profile.fullName,
                    phone: profile.phone,
                    avatarUrl: profile.avatarUrl,
                },
                organization: {
                    id: organization._id.toString(),
                    name: organization.name,
                    slug: organization.slug,
                    role: activeMember.role,
                    memberId: activeMember._id.toString(),
                },
            });
        }
        catch (error) {
            console.error('[AuthController] Login error:', error);
            return res.status(500).json({ error: 'Internal server error during login' });
        }
    }
    /**
     * GET /api/auth/me
     * Retrieve current authenticated user session details
     */
    async me(req, res) {
        if (!req.user || !req.teamMember) {
            return res.status(401).json({ error: 'Unauthorized session' });
        }
        try {
            const profile = await models_1.Profile.findById(req.user.id);
            const teamMember = await models_1.TeamMember.findById(req.teamMember.id).populate('organizationId');
            if (!profile || !teamMember) {
                return res.status(404).json({ error: 'Session user profile not found' });
            }
            const organization = teamMember.organizationId;
            return res.json({
                user: {
                    id: profile._id.toString(),
                    email: profile.email,
                    fullName: profile.fullName,
                    phone: profile.phone,
                    avatarUrl: profile.avatarUrl,
                },
                organization: {
                    id: organization._id.toString(),
                    name: organization.name,
                    slug: organization.slug,
                    role: teamMember.role,
                    memberId: teamMember._id.toString(),
                },
            });
        }
        catch (error) {
            console.error('[AuthController] Get session profile error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * POST /api/auth/invite
     * Invite team member (ADMIN and SALES_MANAGER only)
     */
    async inviteUser(req, res) {
        const { email, fullName, phone, role } = req.body;
        const orgId = req.orgId;
        if (!email || !fullName || !role) {
            return res.status(400).json({ error: 'Email, name, and role are required' });
        }
        if (!orgId) {
            return res.status(403).json({ error: 'No active organization context found' });
        }
        try {
            // Check if profile exists; if not, create one with a default password
            let profile = await models_1.Profile.findOne({ email });
            if (!profile) {
                const tempPasswordHash = await bcryptjs_1.default.hash('Password123', 10);
                profile = await models_1.Profile.create({
                    email,
                    passwordHash: tempPasswordHash,
                    fullName,
                    phone: phone || undefined,
                });
            }
            // Check if already a member of this organization
            const existingMember = await models_1.TeamMember.findOne({
                organizationId: orgId,
                profileId: profile._id,
            });
            if (existingMember) {
                return res.status(400).json({ error: 'User is already a member of this organization' });
            }
            // Create member relation
            const member = await models_1.TeamMember.create({
                organizationId: orgId,
                profileId: profile._id,
                role: role,
                status: 'ACTIVE', // immediately active for easy demo logging
            });
            await member.populate('profileId');
            const profileData = member.profileId;
            return res.status(201).json({
                message: 'User invited and added to team successfully',
                member: {
                    id: member._id.toString(),
                    fullName: profileData.fullName,
                    email: profileData.email,
                    role: member.role,
                    status: member.status,
                },
            });
        }
        catch (error) {
            console.error('[AuthController] Invite user error:', error);
            return res.status(500).json({ error: 'Internal server error during user invite' });
        }
    }
    /**
     * GET /api/auth/team
     * List all team members in the organization
     */
    async getTeam(req, res) {
        const orgId = req.orgId;
        if (!orgId) {
            return res.status(403).json({ error: 'No active organization context' });
        }
        try {
            const team = await models_1.TeamMember.find({ organizationId: orgId }).populate('profileId');
            const formattedTeam = team.map((member) => {
                const profileData = member.profileId;
                return {
                    id: member._id.toString(),
                    fullName: profileData?.fullName || '',
                    email: profileData?.email || '',
                    phone: profileData?.phone || null,
                    avatarUrl: profileData?.avatarUrl || null,
                    role: member.role,
                    status: member.status,
                    createdAt: member.createdAt,
                };
            });
            return res.json(formattedTeam);
        }
        catch (error) {
            console.error('[AuthController] List team error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
