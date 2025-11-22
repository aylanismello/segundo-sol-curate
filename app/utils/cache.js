/**
 * File-based caching utilities
 *
 * This module provides simple file-based caching for API responses.
 * Caches are stored in the /cache directory and automatically expire.
 */

import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache');

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(subDir = '') {
  const dir = subDir ? path.join(CACHE_DIR, subDir) : CACHE_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Generate cache file path from key
 */
function getCacheFilePath(key, subDir = '') {
  const safeKey = key.replace(/[^a-z0-9-_]/gi, '_');
  const dir = ensureCacheDir(subDir);
  return path.join(dir, `${safeKey}.json`);
}

/**
 * Get cached data if it exists and hasn't expired
 *
 * @param {string} key - Cache key
 * @param {number} ttlHours - Time to live in hours
 * @param {string} subDir - Optional subdirectory for organization
 * @returns {object|null} Cached data or null if expired/missing
 */
export function getCachedData(key, ttlHours, subDir = '') {
  try {
    const filePath = getCacheFilePath(key, subDir);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const cached = JSON.parse(fileContent);

    // Check if cache has expired
    const age = Date.now() - cached.timestamp;
    const maxAge = ttlHours * 60 * 60 * 1000;

    if (age > maxAge) {
      // Cache expired, delete file
      fs.unlinkSync(filePath);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Save data to cache
 *
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {string} subDir - Optional subdirectory for organization
 */
export function setCachedData(key, data, subDir = '') {
  try {
    const filePath = getCacheFilePath(key, subDir);

    const cacheEntry = {
      timestamp: Date.now(),
      data: data
    };

    fs.writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Clear expired cache files from a directory
 *
 * @param {number} ttlHours - Time to live in hours
 * @param {string} subDir - Subdirectory to clean
 */
export function clearExpiredCache(ttlHours, subDir = '') {
  try {
    const dir = ensureCacheDir(subDir);
    const files = fs.readdirSync(dir);
    const maxAge = ttlHours * 60 * 60 * 1000;
    let cleared = 0;

    files.forEach(file => {
      const filePath = path.join(dir, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const cached = JSON.parse(fileContent);
        const age = Date.now() - cached.timestamp;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          cleared++;
        }
      } catch (error) {
        // If file is corrupted, delete it
        fs.unlinkSync(filePath);
        cleared++;
      }
    });

    if (cleared > 0) {
      console.log(`Cleared ${cleared} expired cache files from ${subDir || 'root'}`);
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

/**
 * Clear all cache for a specific subdirectory
 *
 * @param {string} subDir - Subdirectory to clear
 */
export function clearAllCache(subDir = '') {
  try {
    const dir = path.join(CACHE_DIR, subDir);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`Cleared all cache from ${subDir || 'root'}`);
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}
