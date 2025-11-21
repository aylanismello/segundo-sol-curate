import './globals.css';

/**
 * Root Layout Component
 *
 * In Next.js App Router, layout.js is like your application.html.erb in Rails!
 * It wraps ALL pages in your app.
 *
 * Key differences from React:
 * - This is a SERVER COMPONENT by default (no useState, useEffect, etc.)
 * - Metadata is exported separately (for SEO)
 * - children prop contains the page content
 */

export const metadata = {
  title: 'Segundo Sol Stacks',
  description: 'Your DJ pool - curated music from NTS, SoundCloud, Bandcamp, and more',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
