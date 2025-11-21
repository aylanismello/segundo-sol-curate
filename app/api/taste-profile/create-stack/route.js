import { NextResponse } from 'next/server';
import { generateStackName } from '../../../utils/tasteProfileStorage';

/**
 * API Route: /api/taste-profile/create-stack
 *
 * Creates a "stack" of tracks based on a taste profile:
 * - Takes artist/track combinations and genres
 * - Searches NTS for first 5 episodes per source
 * - Gets tracklists from all episodes
 * - Filters out seen episodes and already-referenced tracks
 * - Enriches tracks with Spotify data for playback
 * - Returns combined stack with metadata
 *
 * This is the magic endpoint that powers the Taste Profile feature!
 */

/**
 * Helper: Get Spotify Access Token
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

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
  return data.access_token;
}

/**
 * Helper: Search Spotify for a track
 */
async function searchSpotifyTrack(artist, title, accessToken) {
  const query = encodeURIComponent(`${artist} ${title}`);
  const spotifyUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

  const response = await fetch(spotifyUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    console.error(`Spotify search failed for ${artist} - ${title}`);
    return null;
  }

  const data = await response.json();

  if (!data.tracks?.items?.length) {
    return null;
  }

  const track = data.tracks.items[0];

  return {
    id: track.id,
    uri: track.uri,
    url: track.external_urls.spotify,
    name: track.name,
    artist: track.artists[0]?.name || artist
  };
}

/**
 * Helper: Fetch episodes for a track search
 * Reuses the same NTS search logic from /api/nts but limited to 5 episodes
 */
async function fetchEpisodesForTrack(artist, title, seenEpisodes) {
  const queryParts = [title, artist].filter(Boolean);
  const query = encodeURIComponent(queryParts.join(' '));

  // Search NTS for this track
  const ntsUrl = `https://www.nts.live/api/v2/search?q=${query}&version=2&offset=0&limit=60&types[]=track`;
  const response = await fetch(ntsUrl);

  if (!response.ok) {
    throw new Error(`NTS API returned ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  // Sort by date (newest first) and filter out seen episodes
  results.sort((a, b) => {
    const dateA = new Date(a.local_date);
    const dateB = new Date(b.local_date);
    return dateB - dateA;
  });

  const unseen = results.filter(result => !seenEpisodes.includes(result.article.path));

  // Take first 5 unseen episodes
  return unseen.slice(0, 5).map(result => ({
    path: result.article.path,
    title: result.article.title,
    airDate: result.local_date,
    source: { type: 'track', artist, title }
  }));
}

/**
 * Helper: Fetch episodes for a genre
 * Uses the genre API endpoint
 */
async function fetchEpisodesForGenre(genreId, seenEpisodes) {
  // Use the NTS genre API
  const ntsUrl = `https://www.nts.live/api/v2/search/episodes?offset=0&limit=60&genres[]=${genreId}`;
  const response = await fetch(ntsUrl);

  if (!response.ok) {
    throw new Error(`NTS genre API returned ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];

  // Filter out seen episodes
  const unseen = results.filter(episode => !seenEpisodes.includes(episode.article.path));

  // Take first 5 unseen episodes
  return unseen.slice(0, 5).map(episode => ({
    path: episode.article.path,
    title: episode.title,
    airDate: episode.local_date,
    source: { type: 'genre', genreId }
  }));
}

/**
 * Helper: Fetch tracklist for an episode
 * Returns all tracks with their UIDs
 */
async function fetchTracklist(episodePath) {
  const ntsUrl = `https://www.nts.live/api/v2${episodePath}/tracklist`;
  const response = await fetch(ntsUrl);

  if (!response.ok) {
    console.error(`Failed to fetch tracklist for ${episodePath}`);
    return [];
  }

  const data = await response.json();
  const tracklist = data.results || [];

  return tracklist.map(track => ({
    uid: track.uid,
    artist: track.artist,
    title: track.title,
    episodePath: episodePath
  }));
}

/**
 * Main POST handler
 * Accepts: { tracks: [{artist, title}], genres: [{id, name}], seenEpisodes: [], referencedTracks: [] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      tracks = [],
      genres = [],
      seenEpisodes = [],
      referencedTracks = []
    } = body;

    // Validate input
    if (tracks.length === 0 && genres.length === 0) {
      return NextResponse.json(
        { error: 'Must provide at least one track or genre' },
        { status: 400 }
      );
    }

    console.log(`Creating stack from ${tracks.length} tracks and ${genres.length} genres`);

    // Step 1: Collect episodes from all sources
    const episodePromises = [];

    // Fetch episodes for each track
    for (const track of tracks) {
      episodePromises.push(
        fetchEpisodesForTrack(track.artist, track.title, seenEpisodes)
          .catch(err => {
            console.error(`Failed to fetch episodes for track:`, track, err);
            return [];
          })
      );
    }

    // Fetch episodes for each genre
    for (const genre of genres) {
      const genreId = typeof genre === 'string' ? genre : genre.id;
      episodePromises.push(
        fetchEpisodesForGenre(genreId, seenEpisodes)
          .catch(err => {
            console.error(`Failed to fetch episodes for genre:`, genreId, err);
            return [];
          })
      );
    }

    // Wait for all episode fetches to complete
    const episodeResults = await Promise.all(episodePromises);

    // Flatten and deduplicate episodes by path
    const allEpisodes = episodeResults.flat();
    const uniqueEpisodes = Array.from(
      new Map(allEpisodes.map(ep => [ep.path, ep])).values()
    );

    console.log(`Found ${uniqueEpisodes.length} unique episodes to process`);

    if (uniqueEpisodes.length === 0) {
      return NextResponse.json(
        { error: 'No episodes found. All episodes may have been seen already.' },
        { status: 404 }
      );
    }

    // Step 2: Fetch tracklists for all episodes (in parallel)
    const tracklistPromises = uniqueEpisodes.map(episode =>
      fetchTracklist(episode.path)
        .then(tracks => ({
          episode,
          tracks
        }))
        .catch(err => {
          console.error(`Failed to fetch tracklist for ${episode.path}:`, err);
          return { episode, tracks: [] };
        })
    );

    const tracklistResults = await Promise.all(tracklistPromises);

    // Step 3: Combine all tracks and filter out referenced ones
    // This prevents showing tracks you've already seen in previous stacks
    // (Deleting a stack will unreference its tracks, making them available again)
    const allTracks = [];

    for (const { episode, tracks } of tracklistResults) {
      for (const track of tracks) {
        // Skip if track has already been referenced
        if (!referencedTracks.includes(track.uid)) {
          allTracks.push({
            ...track,
            episodeTitle: episode.title,
            airDate: episode.airDate,
            source: episode.source
          });
        }
      }
    }

    console.log(`Compiled ${allTracks.length} unreferenced tracks (filtered from ${tracklistResults.reduce((sum, r) => sum + r.tracks.length, 0)} total)`);

    // Step 3.5: Enrich tracks with Spotify data
    console.log('Fetching Spotify data for tracks...');
    const spotifyToken = await getSpotifyToken();

    const tracksWithSpotify = await Promise.all(
      allTracks.map(async (track) => {
        const spotifyData = await searchSpotifyTrack(
          track.artist,
          track.title,
          spotifyToken
        );

        return {
          ...track,
          spotify: spotifyData
        };
      })
    );

    console.log(`Enriched ${tracksWithSpotify.length} tracks with Spotify data`);

    // Step 4: Build stack metadata
    const stackId = Date.now().toString();
    const createdAt = new Date().toISOString();

    // Generate descriptive stack name
    const genreNames = genres.map(g => typeof g === 'string' ? g : g.name);
    const stackName = generateStackName({
      tracks: tracks.map(t => ({ artist: t.artist, title: t.title })),
      genres: genreNames
    });

    // Generate better summary
    let summaryParts = [];
    if (tracks.length > 0) {
      const artistNames = tracks.map(t => t.artist).filter(Boolean);
      if (artistNames.length > 0) {
        summaryParts.push(`${artistNames.slice(0, 2).join(', ')}${artistNames.length > 2 ? ` +${artistNames.length - 2} more` : ''}`);
      }
    }
    if (genres.length > 0) {
      summaryParts.push(`${genreNames.slice(0, 2).join(', ')}${genreNames.length > 2 ? ` +${genreNames.length - 2} more` : ''}`);
    }

    const episodeText = uniqueEpisodes.length === 1 ? 'episode' : 'episodes';
    const summary = summaryParts.length > 0
      ? `${tracksWithSpotify.length} curated tracks from ${uniqueEpisodes.length} NTS ${episodeText} featuring ${summaryParts.join(' and ')}`
      : `${tracksWithSpotify.length} curated tracks from ${uniqueEpisodes.length} NTS ${episodeText}`;

    const stack = {
      id: stackId,
      createdAt,
      name: stackName,
      sources: {
        tracks: tracks.map(t => ({ artist: t.artist, title: t.title })),
        genres: genreNames
      },
      tracks: tracksWithSpotify,
      episodesUsed: uniqueEpisodes.map(ep => ({
        path: ep.path,
        title: ep.title,
        airDate: ep.airDate,
        source: ep.source
      })),
      summary
    };

    return NextResponse.json({
      success: true,
      stack
    });

  } catch (error) {
    console.error('Error creating stack:', error);
    return NextResponse.json(
      { error: 'Failed to create stack', details: error.message },
      { status: 500 }
    );
  }
}
