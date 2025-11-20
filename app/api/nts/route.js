import { NextResponse } from 'next/server';

/**
 * API Route: /api/nts
 *
 * This is a Next.js API route - think of it like a Rails controller action!
 * In Next.js, any file called route.js inside the /app/api directory becomes an API endpoint.
 *
 * This specific route searches NTS Radio for a track and returns the first episode that played it.
 *
 * How it works:
 * 1. Client sends GET request with ?artist=X&title=Y query params
 * 2. We fetch from NTS search API
 * 3. Return the first matching episode info
 */

export async function GET(request) {
  // Extract search params from the URL
  // In Next.js, we use the URL API to parse query params (different from Rails params hash!)
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const title = searchParams.get('title');

  // Validate input - always good to check!
  if (!artist || !title) {
    return NextResponse.json(
      { error: 'Missing artist or title parameter' },
      { status: 400 }
    );
  }

  try {
    // Build the search query by combining title + artist
    // We encode it for the URL (handles spaces and special chars)
    const query = encodeURIComponent(`${title} ${artist}`);

    // NTS API endpoint - publicly accessible, no auth needed!
    const ntsUrl = `https://www.nts.live/api/v2/search?q=${query}&version=2&offset=0&limit=60&types[]=track`;

    console.log('Fetching from NTS:', ntsUrl);

    // Fetch from NTS API
    // Note: In Next.js API routes, we can use fetch() directly on the server
    const response = await fetch(ntsUrl);

    if (!response.ok) {
      throw new Error(`NTS API returned ${response.status}`);
    }

    const data = await response.json();

    // The NTS API returns an object with a 'results' array
    const results = data.results;

    // Check if we got any results
    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: 'No episodes found for this track' },
        { status: 404 }
      );
    }

    // Get up to 60 results (NTS API limit)
    // The frontend will paginate these into groups of 9
    const topEpisodes = results;

    // Log what we found for debugging
    console.log(`Found ${topEpisodes.length} episodes`);

    // Map the results to a cleaner format
    // We're returning an array of episodes now instead of just one!
    const episodes = topEpisodes.map(episode => ({
      episodePath: episode.article.path,
      episodeTitle: episode.article.title,
      airDate: episode.local_date,
      track: {
        title: episode.title,
        artist: episode.artists[0]?.name || 'Unknown'
      }
    }));

    return NextResponse.json({
      episodes: episodes,
      total: topEpisodes.length
    });

  } catch (error) {
    console.error('Error fetching from NTS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from NTS API' },
      { status: 500 }
    );
  }
}
