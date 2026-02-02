import { Request, Response, NextFunction } from 'express';
import { cache } from '../utils/cache';

export function cacheMiddleware(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await cache.get(key);
      if (cached) {
        return res.json(cached);
      }

      // Store original json function
      const originalJson = res.json.bind(res);

      // Override json to cache response
      res.json = function (body: any) {
        cache.set(key, body, ttlSeconds).catch(console.error);
        return originalJson(body);
      };

      next();
    } catch (error) {
      // If caching fails, just continue
      next();
    }
  };
}
