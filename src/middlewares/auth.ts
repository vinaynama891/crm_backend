import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TeamMember } from '../models';

export type Role = 'ADMIN' | 'SALES_MANAGER' | 'SALES_AGENT';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  teamMember?: {
    id: string;
    role: Role;
    organizationId: string;
  };
  orgId?: string;
}

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'estateflow_jwt_secret_key_123!';
    const decoded = jwt.verify(token, secret) as { id: string; email: string };
    
    req.user = decoded;

    // Fetch team member details for the current active organization context
    const headerOrgId = req.headers['x-organization-id'] as string;

    const query: any = {
      profileId: decoded.id,
      status: 'ACTIVE',
    };
    if (headerOrgId) {
      query.organizationId = headerOrgId;
    }

    const teamMember = await TeamMember.findOne(query);

    if (teamMember) {
      req.teamMember = {
        id: teamMember._id.toString(),
        role: teamMember.role as Role,
        organizationId: teamMember.organizationId.toString(),
      };
      req.orgId = teamMember.organizationId.toString();
    }

    next();
  } catch (error) {
    console.error('[AuthMiddleware] JWT Verification failed:', error);
    return res.status(403).json({ error: 'Token expired or invalid' });
  }
};

/**
 * Middleware to restrict access based on user Roles
 */
export const requireRoles = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.teamMember) {
      return res.status(403).json({ error: 'Unauthorized: No active organization membership' });
    }

    if (!allowedRoles.includes(req.teamMember.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};
