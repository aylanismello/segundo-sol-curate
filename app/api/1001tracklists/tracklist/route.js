/**
 * 1001 Tracklists Tracklist API - Get tracks from a specific tracklist
 * Requires visible browser to bypass anti-bot (use Xvfb in production)
 */

import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

// Rotate user agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url || !url.trim()) {
    return NextResponse.json(
      { error: 'Tracklist URL is required' },
      { status: 400 }
    );
  }

  let browser;

  try {
    console.log(`Fetching tracklist: ${url}`);

    // Extract DJ slug and tracklist ID from URL
    // URL format: https://www.1001tracklists.com/tracklist/22pd3fzt/bonobo-stage-1-...html
    const urlParts = url.split('/');
    const tracklistId = urlParts[4]; // e.g., "22pd3fzt"
    const fullSlug = urlParts[5]; // e.g., "bonobo-stage-1-...html"
    const djSlug = fullSlug.split('-')[0]; // e.g., "bonobo"

    console.log(`DJ: ${djSlug}, Tracklist ID: ${tracklistId}`);

    // Get random user agent
    const userAgent = getRandomUserAgent();
    console.log(`Using user agent: ${userAgent.substring(0, 50)}...`);

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const context = await browser.newContext({
      userAgent: userAgent,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Remove webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Go directly to tracklist URL
    console.log(`Loading tracklist: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });

    // Wait for tracks to load (increased timeout for slower loads)
    await page.waitForSelector('.tlpItem', { timeout: 20000 });

    // CRITICAL: Wait for JavaScript to update track details
    // The page dynamically loads track info after initial render
    // Also acts as rate limiting to avoid bans
    await page.waitForTimeout(5000);


    // Extract tracklist title
    const title = await page.$eval('#pageTitle h1', (el) => el.textContent.trim());

    // Extract all tracks - use more specific selector to avoid similar/recommended tracks
    const tracks = await page.$$eval('.tlpTog.tlpItem', (items) => {
      return items.map(item => {
        // Get track number
        const trackNumEl = item.querySelector('.fontXL');
        const trackNumber = trackNumEl ? trackNumEl.textContent.trim() : '';

        // Get track info - look inside .bCont .tl container
        const trackContainer = item.querySelector('.bCont.tl');
        if (!trackContainer) return null;

        // Get the track value which contains artist - title
        const trackValueEl = trackContainer.querySelector('.trackValue');
        if (!trackValueEl) return null;

        const trackText = trackValueEl.textContent.trim();

        // Skip "ID - ID" tracks
        if (trackText === 'ID - ID' || trackText.startsWith('ID -') || trackText.endsWith('- ID')) {
          return null;
        }

        // Parse "Artist - Title" format
        const parts = trackText.split(' - ');
        const artist = parts[0]?.trim() || '';
        const title = parts.slice(1).join(' - ').trim() || '';

        if (!artist || !title) return null;

        // Get track ID for potential Spotify lookup
        const trackId = item.getAttribute('data-trackid');

        return {
          trackNumber,
          artist,
          title,
          trackId
        };
      }).filter(track => track !== null);
    });

    await browser.close();

    console.log(`Found ${tracks.length} tracks`);

    return NextResponse.json({
      title,
      url,
      trackCount: tracks.length,
      tracks
    });

  } catch (error) {
    console.error('Error fetching tracklist:', error);

    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      { error: 'Failed to fetch tracklist', details: error.message },
      { status: 500 }
    );
  }
}
