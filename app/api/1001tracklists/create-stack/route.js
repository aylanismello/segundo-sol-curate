/**
 * 1001 Tracklists Stack Creation API
 *
 * Creates a music stack from 1001 Tracklists based on artist name
 * Similar to the taste-profile create-stack but for 1001TL data
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { artist, seenTracklists = [] } = await request.json();

    if (!artist || !artist.trim()) {
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      );
    }

    console.log(`Creating stack for artist: ${artist}`);

    // Step 1: Search for artist's tracklists
    const searchUrl = new URL('/api/1001tracklists/search', request.url);
    searchUrl.searchParams.set('artist', artist);

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      throw new Error(errorData.error || 'Failed to search tracklists');
    }

    const { tracklists } = await searchResponse.json();

    // Step 2: Filter out already-seen tracklists
    const unseenTracklists = tracklists.filter(tl => !seenTracklists.includes(tl.url));

    if (unseenTracklists.length === 0) {
      return NextResponse.json(
        { error: 'No new tracklists found for this artist' },
        { status: 404 }
      );
    }

    console.log(`Found ${unseenTracklists.length} unseen tracklists`);

    // Step 3: Fetch full tracklists (with tracks)
    const allTracks = [];
    const sourceTracklists = [];

    for (const tracklist of unseenTracklists) {
      try {
        const tracklistUrl = new URL('/api/1001tracklists/tracklist', request.url);
        tracklistUrl.searchParams.set('url', tracklist.url);

        const tracklistResponse = await fetch(tracklistUrl.toString());
        if (!tracklistResponse.ok) {
          console.error(`Failed to fetch tracklist: ${tracklist.url}`);
          continue;
        }

        const { tracklist: fullTracklist } = await tracklistResponse.json();

        // Add each track with source information
        fullTracklist.tracks.forEach((track, index) => {
          allTracks.push({
            ...track,
            // Add metadata about where this track came from
            tracklistUrl: tracklist.url,
            tracklistTitle: tracklist.title,
            tracklistDate: tracklist.date,
            tracklistVenue: tracklist.venue,
            source: {
              type: '1001tl',
              artist: artist,
              tracklistUrl: tracklist.url
            },
            // Generate unique ID for tracking
            uid: `${tracklist.url}-${index}`
          });
        });

        sourceTracklists.push({
          url: tracklist.url,
          title: tracklist.title,
          date: tracklist.date,
          venue: tracklist.venue,
          trackCount: fullTracklist.tracks.length
        });

      } catch (error) {
        console.error(`Error processing tracklist ${tracklist.url}:`, error);
      }
    }

    if (allTracks.length === 0) {
      return NextResponse.json(
        { error: 'No tracks found in tracklists' },
        { status: 404 }
      );
    }

    // Step 4: Remove duplicates based on Spotify ID (if available) or artist+title
    const uniqueTracks = [];
    const seen = new Set();

    for (const track of allTracks) {
      const key = track.spotify?.id || `${track.artist.toLowerCase()}-${track.title.toLowerCase()}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(track);
      }
    }

    console.log(`Deduplicated ${allTracks.length} tracks to ${uniqueTracks.length} unique tracks`);

    // Step 5: Create stack object
    const stack = {
      id: `1001tl-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: '1001tl',
      summary: `${uniqueTracks.length} tracks from ${sourceTracklists.length} ${artist} sets`,
      sources: {
        artist: artist,
        tracklists: sourceTracklists
      },
      tracks: uniqueTracks,
      stats: {
        totalTracks: uniqueTracks.length,
        tracklistsUsed: sourceTracklists.length,
        spotifyMatched: uniqueTracks.filter(t => t.spotify).length
      }
    };

    return NextResponse.json({ stack });

  } catch (error) {
    console.error('Error creating 1001TL stack:', error);
    return NextResponse.json(
      { error: 'Failed to create stack', details: error.message },
      { status: 500 }
    );
  }
}
