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

  // Validate input - require at least one field
  if (!artist && !title) {
    return NextResponse.json(
      { error: 'Missing artist or title parameter' },
      { status: 400 }
    );
  }

  // Prevent super broad searches - require at least 2 characters
  // This protects the NTS API from being hammered with single-letter searches
  const combinedQuery = [title, artist].filter(Boolean).join(' ').trim();
  if (combinedQuery.length < 2) {
    return NextResponse.json(
      { error: 'Search query too short - please enter at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    // Build the search query by combining title + artist (if both provided)
    // We encode it for the URL (handles spaces and special chars)
    const queryParts = [title, artist].filter(Boolean);
    const query = encodeURIComponent(queryParts.join(' '));

    // Step 1: Fetch first page to get total count
    // NTS API has a hard limit of 60 results per request, so we need to paginate
    const firstPageUrl = `https://www.nts.live/api/v2/search?q=${query}&version=2&offset=0&limit=60&types[]=track`;

    console.log('Fetching first page from NTS:', firstPageUrl);

    const firstResponse = await fetch(firstPageUrl);

    if (!firstResponse.ok) {
      throw new Error(`NTS API returned ${firstResponse.status}`);
    }

    const firstData = await firstResponse.json();
    const totalCount = firstData.metadata.resultset.count;

    console.log(`Total results available: ${totalCount}`);

    // Step 2: Calculate how many pages we need to fetch
    // NTS API limit is 60 per request
    // We cap at 100 episodes to avoid hammering the API
    const limit = 60;
    const maxEpisodes = 100; // Cap at 100 episodes to be nice to NTS API
    const maxPages = Math.ceil(maxEpisodes / limit); // This will be 2 pages (60 + 40 = 100)
    const totalPages = Math.ceil(totalCount / limit);
    const pagesToFetch = Math.min(totalPages, maxPages);
    const isTruncated = totalPages > maxPages;

    if (isTruncated) {
      console.log(`Search too broad: ${totalCount} results found, limiting to ${maxEpisodes} results`);
    }

    // Step 3: Fetch all remaining pages in parallel (up to max)
    const pagePromises = [];

    for (let page = 1; page < pagesToFetch; page++) {
      const offset = page * limit;
      const pageUrl = `https://www.nts.live/api/v2/search?q=${query}&version=2&offset=${offset}&limit=${limit}&types[]=track`;
      pagePromises.push(fetch(pageUrl).then(res => res.json()));
    }

    // Wait for all pages to complete
    const additionalPages = await Promise.all(pagePromises);

    // Step 4: Combine all results
    let allResults = [...firstData.results];

    for (const pageData of additionalPages) {
      allResults = allResults.concat(pageData.results);
    }

    console.log(`Fetched ${allResults.length} total results across ${pagesToFetch} pages`);

    // Step 5: Sort by date (newest first)
    // The NTS API doesn't support server-side sorting, so we do it here
    allResults.sort((a, b) => {
      const dateA = new Date(a.local_date);
      const dateB = new Date(b.local_date);
      return dateB - dateA; // Descending order (newest first)
    });

    const results = allResults;

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
      location: episode.location || null,
      genres: episode.genres || [],
      track: {
        title: episode.title,
        artist: episode.artists[0]?.name || 'Unknown'
      }
    }));

    return NextResponse.json({
      episodes: episodes,
      total: topEpisodes.length,
      truncated: isTruncated,
      totalAvailable: totalCount,
      message: isTruncated
        ? `Search too broad - showing first ${allResults.length} of ${totalCount} results. Try a more specific search.`
        : null
    });

  } catch (error) {
    console.error('Error fetching from NTS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from NTS API' },
      { status: 500 }
    );
  }
}
