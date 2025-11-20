/**
 * SpotifyEmbed Component
 *
 * Renders a Spotify track embed iframe.
 *
 * Spotify embed format:
 * https://open.spotify.com/embed/track/{TRACK_ID}
 *
 * This is also a SERVER COMPONENT - just renders an iframe, no interactivity needed!
 *
 * Props:
 * - trackId: Spotify track ID (we get this from the Spotify API)
 */

export default function SpotifyEmbed({ trackId }) {
  // Build the embed URL
  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  return (
    <div className="w-full">
      <iframe
        style={{ borderRadius: '12px' }}
        src={embedUrl}
        width="100%"
        height="152"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title={`Spotify player for track ${trackId}`}
      />
    </div>
  );
}
