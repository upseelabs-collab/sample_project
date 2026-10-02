import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.config.js';
import {
  InstagramConnection,
  SafeInstagramConnection,
} from '../models/instagram-connection.model.js';

export class StorageService {
  private static instance: StorageService;
  private filePath: string;
  private encryptionKey: Buffer;

  private constructor() {
    if (!fs.existsSync(env.DATA_DIR)) {
      fs.mkdirSync(env.DATA_DIR, { recursive: true });
    }
    this.filePath = path.join(env.DATA_DIR, 'instagram_connections.json');

    // Derive deterministic 32-byte key from app secret
    const secretSource = env.INSTAGRAM_APP_SECRET || 'creatorconnect_default_secure_secret_key_32bytes!';
    this.encryptionKey = crypto.createHash('sha256').update(secretSource).digest();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Encrypts a sensitive string (e.g. access token) using AES-256-GCM.
   */
  public encryptToken(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an AES-256-GCM stored encrypted access token.
   */
  public decryptToken(cipherText: string): string {
    if (!cipherText) return '';
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      return cipherText;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private readAll(): InstagramConnection[] {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.values(data);
    } catch {
      return [];
    }
  }

  private writeAll(connections: InstagramConnection[]): void {
    const tempFile = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(connections, null, 2), 'utf-8');
    fs.renameSync(tempFile, this.filePath);
  }

  /**
   * Saves or updates an Instagram connection for a user.
   * Enforces unique(userId, instagramUserId) constraint to prevent duplicates.
   */
  public saveConnection(connection: {
    userId: string;
    instagramUserId: string;
    username: string;
    name?: string;
    profilePicture?: string;
    accountType?: string;
    mediaCount?: number;
    accessToken: string;
    tokenType?: 'short_lived' | 'long_lived';
    tokenExpiresAt?: string | null;
    scopes?: string[];
  }): InstagramConnection {
    const connections = this.readAll();
    const existingIndex = connections.findIndex(
      (c) => c.userId === connection.userId && c.instagramUserId === connection.instagramUserId
    );

    const now = new Date().toISOString();
    const encryptedAccessToken = this.encryptToken(connection.accessToken);

    const record: InstagramConnection = {
      id: existingIndex >= 0 ? connections[existingIndex].id : `ig_conn_${crypto.randomUUID()}`,
      userId: connection.userId,
      instagramUserId: connection.instagramUserId,
      username: connection.username,
      name: connection.name,
      profilePicture: connection.profilePicture,
      accountType: connection.accountType,
      mediaCount: connection.mediaCount,
      encryptedAccessToken,
      tokenType: connection.tokenType || 'long_lived',
      tokenExpiresAt: connection.tokenExpiresAt,
      scopes: connection.scopes || [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
      ],
      status: 'active',
      connectedAt: existingIndex >= 0 ? connections[existingIndex].connectedAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      connections[existingIndex] = record;
    } else {
      connections.push(record);
    }

    this.writeAll(connections);
    return record;
  }

  /**
   * Retrieves all Instagram connections for a specific user.
   */
  public getUserConnections(userId: string): InstagramConnection[] {
    const connections = this.readAll();
    return connections.filter((c) => c.userId === userId && c.status === 'active');
  }

  /**
   * Retrieves the active decrypted connection for a user.
   * If instagramUserId is provided, matches that specific account; otherwise returns the first active connection.
   */
  public getConnection(userId: string, instagramUserId?: string): (InstagramConnection & { accessToken: string }) | null {
    const connections = this.readAll();
    const match = connections.find(
      (c) =>
        c.userId === userId &&
        c.status === 'active' &&
        (!instagramUserId || c.instagramUserId === instagramUserId)
    );

    if (match) {
      return {
        ...match,
        accessToken: this.decryptToken(match.encryptedAccessToken),
      };
    }

    return null;
  }

  /**
   * Returns a safe public connection representation (NO access token).
   */
  public getSafeConnection(userId: string, instagramUserId?: string): SafeInstagramConnection | null {
    const conn = this.getConnection(userId, instagramUserId);
    if (!conn) return null;

    return {
      id: conn.id,
      userId: conn.userId,
      instagramUserId: conn.instagramUserId,
      username: conn.username,
      name: conn.name,
      profilePicture: conn.profilePicture,
      accountType: conn.accountType,
      mediaCount: conn.mediaCount,
      scopes: conn.scopes,
      status: conn.status,
      connectedAt: conn.connectedAt,
      updatedAt: conn.updatedAt,
    };
  }

  /**
   * Deletes / disconnects an Instagram connection for a user.
   */
  public deleteConnection(userId: string, instagramUserId?: string): boolean {
    const connections = this.readAll();
    const initialLength = connections.length;

    const filtered = connections.filter(
      (c) => !(c.userId === userId && (!instagramUserId || c.instagramUserId === instagramUserId))
    );

    if (filtered.length !== initialLength) {
      this.writeAll(filtered);
      return true;
    }
    return false;
  }
}

export const storageService = StorageService.getInstance();
