import { AuthService } from '../middleware/auth';
import { dataStore } from '../utils/dataStore';

describe('AuthService', () => {
  beforeEach(() => {
    // Reset data store
    dataStore.init();
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword';
      const hashedPassword = await AuthService.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(20);
    });
  });

  describe('comparePassword', () => {
    it('should compare passwords correctly', async () => {
      const password = 'testpassword';
      const hashedPassword = await AuthService.hashPassword(password);
      
      const isValid = await AuthService.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthService.comparePassword('wrongpassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('generateTokens', () => {
    it('should generate valid tokens', () => {
      const user = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date(),
      };

      const tokens = AuthService.generateTokens(user);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verifyToken', () => {
    it('should verify valid tokens', () => {
      const user = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date(),
      };

      const tokens = AuthService.generateTokens(user);
      const decoded = AuthService.verifyToken(tokens.accessToken);
      
      expect(decoded).toBeDefined();
      expect(decoded!.user_id).toBe(user.id);
      expect(decoded!.username).toBe(user.username);
    });

    it('should reject invalid tokens', () => {
      const decoded = AuthService.verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const loginResponse = await AuthService.login({
        username: 'admin',
        password: 'password',
      });

      expect(loginResponse).toBeDefined();
      expect(loginResponse!.access_token).toBeDefined();
      expect(loginResponse!.refresh_token).toBeDefined();
      expect(loginResponse!.expires_at).toBeInstanceOf(Date);
    });

    it('should reject invalid credentials', async () => {
      const loginResponse = await AuthService.login({
        username: 'admin',
        password: 'wrongpassword',
      });

      expect(loginResponse).toBeNull();
    });

    it('should reject non-existent user', async () => {
      const loginResponse = await AuthService.login({
        username: 'nonexistent',
        password: 'password',
      });

      expect(loginResponse).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid refresh token', async () => {
      const loginResponse = await AuthService.login({
        username: 'admin',
        password: 'password',
      });

      expect(loginResponse).toBeDefined();
      
      const refreshResponse = await AuthService.refreshToken(loginResponse!.refresh_token);
      
      expect(refreshResponse).toBeDefined();
      expect(refreshResponse!.access_token).toBeDefined();
      expect(refreshResponse!.refresh_token).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const refreshResponse = await AuthService.refreshToken('invalid-refresh-token');
      expect(refreshResponse).toBeNull();
    });
  });
});