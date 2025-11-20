import { NextResponse } from 'next/server';

/**
 * API Route: /api/genre
 *
 * Searches NTS Radio by genre and returns episodes.
 * Similar to the track search, but uses the genre endpoint instead.
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const genreId = searchParams.get('id');
  const offset = searchParams.get('offset') || '0';
  const limit = searchParams.get('limit') || '60';

  if (!genreId) {
    return NextResponse.json(
      { error: 'Missing genre id parameter' },
      { status: 400 }
    );
  }

  try {
    // NTS API endpoint for genre search
    const ntsUrl = `https://www.nts.live/api/v2/search/episodes?offset=${offset}&limit=${limit}&genres[]=${genreId}`;

    console.log('Fetching from NTS genre API:', ntsUrl);

    const response = await fetch(ntsUrl);

    if (!response.ok) {
      throw new Error(`NTS API returned ${response.status}`);
    }

    const data = await response.json();

    // Check if we got any results
    if (!data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: 'No episodes found for this genre' },
        { status: 404 }
      );
    }

    console.log(`Found ${data.results.length} episodes for genre ${genreId}`);

    // Map the results to our format
    const episodes = data.results.map(episode => ({
      episodePath: episode.article.path,
      episodeTitle: episode.title,
      airDate: episode.local_date,
      location: episode.location,
      image: episode.image?.medium || null,
      genres: episode.genres || []
    }));

    return NextResponse.json({
      episodes: episodes,
      total: data.metadata.resultset.count,
      offset: data.metadata.resultset.offset,
      limit: data.metadata.resultset.limit
    });

  } catch (error) {
    console.error('Error fetching from NTS genre API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from NTS API' },
      { status: 500 }
    );
  }
}
