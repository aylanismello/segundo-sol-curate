import { NextResponse } from 'next/server';

/**
 * API Route: /api/tracklist
 *
 * This is the meaty route! It does THREE things:
 * 1. Fetches the full tracklist from an NTS episode
 * 2. Gets a Spotify access token (using Client Credentials flow)
 * 3. For each track, searches Spotify and gets the embed URL
 *
 * Flow:
 * Client -> /api/tracklist?path=/shows/... -> NTS API -> Spotify Auth -> Spotify Search -> Client
 */

/**
 * Helper function: Get Spotify Access Token
 *
 * Spotify uses OAuth 2.0 Client Credentials flow.
 * Think of it like getting a session token in Rails, but it expires after 1 hour.
 *
 * How it works:
 * 1. Base64 encode "client_id:client_secret"
 * 2. POST to Spotify's token endpoint
 * 3. Get back an access token
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  // Base64 encode the credentials
  // In Node.js, we use Buffer.from().toString('base64')
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify token');
  }

  const data = await response.json();
  return data.access_token; // This is what we'll use for API calls
}

/**
 * Helper function: Search Spotify for a track
 *
 * Takes artist + title, searches Spotify, returns the first match.
 * Returns null if not found (we'll handle this gracefully on the frontend).
 */
async function searchSpotifyTrack(artist, title, accessToken) {
  // Build search query - Spotify search is pretty forgiving!
  const query = encodeURIComponent(`${artist} ${title}`);

  // Spotify Search API - we're searching for tracks specifically
  const spotifyUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

  const response = await fetch(spotifyUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}` // Here's where we use that token!
    }
  });

  if (!response.ok) {
    console.error(`Spotify search failed for ${artist} - ${title}`);
    return null;
  }

  const data = await response.json();

  // Check if we got any results
  if (!data.tracks?.items?.length) {
    return null;
  }

  const track = data.tracks.items[0];

  // Return the Spotify track ID - we'll use this to build embed URLs
  // Spotify embed format: https://open.spotify.com/embed/track/{id}
  return {
    id: track.id,
    uri: track.uri,
    url: track.external_urls.spotify,
    name: track.name,
    artist: track.artists[0]?.name || artist
  };
}

/**
 * Main GET handler
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const episodePath = searchParams.get('path');

  if (!episodePath) {
    return NextResponse.json(
      { error: 'Missing episode path parameter' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get Spotify access token first
    // We do this ONCE at the start, then reuse it for all track searches
    console.log('Getting Spotify access token...');
    const spotifyToken = await getSpotifyToken();

    // Step 2: Fetch the NTS tracklist
    // The episodePath looks like: /shows/andre-power/episodes/getting-lost-...
    // We build the API URL from it
    const ntsTracklistUrl = `https://www.nts.live/api/v2${episodePath}/tracklist`;

    console.log('Fetching tracklist from:', ntsTracklistUrl);

    const ntsResponse = await fetch(ntsTracklistUrl);

    if (!ntsResponse.ok) {
      throw new Error(`NTS tracklist API returned ${ntsResponse.status}`);
    }

    const tracklistData = await ntsResponse.json();

    // NTS API returns an object with a 'results' array containing the tracks
    // We need to extract the array from the response
    console.log('NTS API response structure:', JSON.stringify(tracklistData, null, 2));

    const tracklist = tracklistData.results || tracklistData;

    if (!Array.isArray(tracklist) || tracklist.length === 0) {
      console.error('Invalid tracklist format:', typeof tracklist);
      return NextResponse.json(
        { error: 'No tracks found in this episode' },
        { status: 404 }
      );
    }

    // Step 3: For each track in the NTS tracklist, search Spotify
    // We use Promise.all to do these searches in parallel (faster!)
    // This is like running multiple background jobs at once in Rails
    console.log(`Searching Spotify for ${tracklist.length} tracks...`);

    const tracksWithSpotify = await Promise.all(
      tracklist.map(async (track) => {
        const spotifyData = await searchSpotifyTrack(
          track.artist,
          track.title,
          spotifyToken
        );

        // Return combined NTS + Spotify data
        return {
          // Original NTS data
          artist: track.artist,
          title: track.title,
          uid: track.uid,
          // Spotify data (will be null if not found)
          spotify: spotifyData
        };
      })
    );

    // Step 4: Return the enriched tracklist
    return NextResponse.json({
      episodePath,
      trackCount: tracksWithSpotify.length,
      tracks: tracksWithSpotify
    });

  } catch (error) {
    console.error('Error in tracklist API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracklist' },
      { status: 500 }
    );
  }
}
