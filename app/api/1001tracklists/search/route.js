/**
 * 1001 Tracklists Search API - Direct DJ Page Access
 *
 * Goes directly to DJ's page, no form bullshit
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
  const artist = searchParams.get('artist');

  if (!artist || !artist.trim()) {
    return NextResponse.json(
      { error: 'Artist name is required' },
      { status: 400 }
    );
  }

  let browser;

  try {
    console.log(`Fetching tracklists for: ${artist}`);

    // Convert artist name to URL format (lowercase, no spaces)
    // e.g., "Nicolas Jaar" -> "nicolasjaar"
    const djSlug = artist.toLowerCase().replace(/\s+/g, '');
    const djUrl = `https://www.1001tracklists.com/dj/${djSlug}/index.html`;

    console.log(`Navigating to: ${djUrl}`);

    // Get random user agent
    const userAgent = getRandomUserAgent();

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

    // Go directly to DJ page
    await page.goto(djUrl, { waitUntil: 'networkidle' });

    // Wait for tracklist items to load
    await page.waitForSelector('.bItm', { timeout: 10000 });

    // Extract all tracklists
    const tracklists = await page.$$eval('.bItm .bTitle a', (links) => {
      return links.map(link => ({
        title: link.textContent.trim(),
        url: link.href
      }));
    });

    await browser.close();

    console.log(`Found ${tracklists.length} tracklists`);

    return NextResponse.json({
      artist,
      count: tracklists.length,
      tracklists
    });

  } catch (error) {
    console.error('Error fetching tracklists:', error);

    if (browser) {
      await browser.close();
    }

    return NextResponse.json(
      { error: 'Failed to fetch tracklists', details: error.message },
      { status: 500 }
    );
  }
}
