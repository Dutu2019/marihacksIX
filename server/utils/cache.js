import NodeCache from 'node-cache';
import { createHash } from 'crypto';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS) || 900;
export const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 60 });

export function getCacheKey(type, query) {
  return `${type}:${createHash('md5').update(query.toLowerCase().trim()).digest('hex')}`;
}
