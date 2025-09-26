import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWTPayload, User, LoginRequest, LoginResponse } from '../types';
import { dataStore } from '../utils/dataStore';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export class AuthService {
  static generateTokens(user: User): { accessToken: string; refreshToken: string; expiresAt: Date } {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      user_id: user.id,
      username: user.username,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);

    // Calculate expiration time
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
    const expiresAt = new Date(decoded.exp! * 1000);

    return { accessToken, refreshToken, expiresAt };
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  static verifyRefreshToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async login(request: LoginRequest): Promise<LoginResponse | null> {
    try {
      const user = dataStore.getUserByUsername(request.username);
      if (!user) {
        logger.warn(`Login attempt for non-existent user: ${request.username}`);
        return null;
      }

      const isPasswordValid = await this.comparePassword(request.password, user.password);
      if (!isPasswordValid) {
        logger.warn(`Invalid password for user: ${request.username}`);
        return null;
      }

      const { password, ...userWithoutPassword } = user;
      const tokens = this.generateTokens(userWithoutPassword);

      logger.info(`User logged in successfully: ${user.username}`);
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
      };
    } catch (error) {
      logger.error('Login error:', error);
      return null;
    }
  }

  static async refreshToken(refreshToken: string): Promise<LoginResponse | null> {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return null;
      }

      const user = dataStore.getUserById(decoded.user_id);
      if (!user) {
        logger.warn(`Refresh token for non-existent user: ${decoded.user_id}`);
        return null;
      }

      const tokens = this.generateTokens(user);

      logger.info(`Token refreshed for user: ${user.username}`);
      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      return null;
    }
  }
}

// gRPC metadata authentication helper
export function extractTokenFromMetadata(metadata: any): string | null {
  const authHeader = metadata.get('authorization');
  if (!authHeader || authHeader.length === 0) {
    return null;
  }

  const token = authHeader[0];
  if (token.startsWith('Bearer ')) {
    return token.substring(7);
  }

  return token;
}

export function authenticateCall(call: any): JWTPayload | null {
  const token = extractTokenFromMetadata(call.metadata);
  if (!token) {
    return null;
  }

  return AuthService.verifyToken(token);
}