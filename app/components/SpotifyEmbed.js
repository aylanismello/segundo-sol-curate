/**
 * SpotifyEmbed Component
 *
 * Renders a Spotify track embed iframe with click detection.
 *
 * Since iframes are cross-origin and block click events from bubbling up,
 * we detect when the iframe gains focus (which happens when clicked) and
 * use that to trigger the onInteraction callback.
 *
 * Props:
 * - trackId: Spotify track ID (we get this from the Spotify API)
 * - onInteraction: Callback function called when user first interacts with the embed
 * - played: Whether this track has already been marked as played
 */
'use client';

import { useEffect, useRef } from 'react';

export default function SpotifyEmbed({ trackId, onInteraction, played }) {
  const hasInteracted = useRef(played);
  const checkingFocus = useRef(null);
  const iframeRef = useRef(null);
  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  useEffect(() => {
    // If already played, don't set up the listener
    if (hasInteracted.current) return;

    // Check if THIS SPECIFIC iframe has focus repeatedly
    // When user clicks the iframe, it will gain focus
    const startChecking = () => {
      checkingFocus.current = setInterval(() => {
        const activeElement = document.activeElement;
        // Check if the focused element is THIS specific iframe
        if (activeElement === iframeRef.current) {
          // This iframe has focus, user clicked it
          if (!hasInteracted.current && onInteraction) {
            hasInteracted.current = true;
            onInteraction();
            clearInterval(checkingFocus.current);
          }
        }
      }, 100);
    };

    startChecking();

    return () => {
      if (checkingFocus.current) {
        clearInterval(checkingFocus.current);
      }
    };
  }, [onInteraction, played]);

  return (
    <div className="w-full relative">
      <iframe
        ref={iframeRef}
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
