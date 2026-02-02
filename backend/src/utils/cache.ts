import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
  }

  async delete(key: string): Promise<void> {
    await redis.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export const cache = new CacheService();
