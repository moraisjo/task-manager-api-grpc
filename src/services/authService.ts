import { ServerUnaryCall, sendUnaryData, status } from '@grpc/grpc-js';
import { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest,
  CreateUserRequest,
  User 
} from '../types';
import { AuthService } from '../middleware/auth';
import { dataStore } from '../utils/dataStore';
import logger from '../utils/logger';

export class AuthServiceImpl {
  static async Login(call: ServerUnaryCall<LoginRequest, LoginResponse>, callback: sendUnaryData<LoginResponse>) {
    try {
      const request = call.request;
      
      // Validate required fields
      if (!request.username || !request.password) {
        const error = {
          code: status.INVALID_ARGUMENT,
          message: 'Username and password are required',
        };
        return callback(error);
      }

      const loginResponse = await AuthService.login(request);
      
      if (!loginResponse) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Invalid username or password',
        };
        return callback(error);
      }

      logger.info(`User logged in: ${request.username}`);
      callback(null, loginResponse);
    } catch (error) {
      logger.error('Login error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static async RefreshToken(call: ServerUnaryCall<RefreshTokenRequest, LoginResponse>, callback: sendUnaryData<LoginResponse>) {
    try {
      const request = call.request;
      
      if (!request.refresh_token) {
        const error = {
          code: status.INVALID_ARGUMENT,
          message: 'Refresh token is required',
        };
        return callback(error);
      }

      const loginResponse = await AuthService.refreshToken(request.refresh_token);
      
      if (!loginResponse) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Invalid refresh token',
        };
        return callback(error);
      }

      logger.info('Token refreshed successfully');
      callback(null, loginResponse);
    } catch (error) {
      logger.error('RefreshToken error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static async CreateUser(call: ServerUnaryCall<CreateUserRequest, User>, callback: sendUnaryData<User>) {
    try {
      const request = call.request;
      
      // Validate required fields
      if (!request.username || !request.password || !request.email || !request.full_name) {
        const error = {
          code: status.INVALID_ARGUMENT,
          message: 'Username, password, email, and full_name are required',
        };
        return callback(error);
      }

      // Check if username already exists
      const existingUser = dataStore.getUserByUsername(request.username);
      if (existingUser) {
        const error = {
          code: status.ALREADY_EXISTS,
          message: 'Username already exists',
        };
        return callback(error);
      }

      // Hash the password
      const hashedPassword = await AuthService.hashPassword(request.password);

      // Create the user
      const user = dataStore.createUser({
        id: '',
        username: request.username,
        password: hashedPassword,
        email: request.email,
        full_name: request.full_name,
        created_at: new Date(),
      });

      logger.info(`User created: ${user.username}`);
      callback(null, user);
    } catch (error) {
      logger.error('CreateUser error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }
}