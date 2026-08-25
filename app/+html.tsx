import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

/**
 * The HTML shell for the web build. Expo Router uses this for static rendering.
 *
 * Most of what is here exists so that "Add to Home Screen" on an iPhone produces
 * something that looks and behaves like an app: a real icon, no Safari chrome,
 * and content that clears the notch.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover is what lets the safe-area insets reach the layout. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <meta name="application-name" content="Verdict" />
        <meta name="theme-color" content="#FBF7F2" />
        <meta name="color-scheme" content="light" />

        {/* Installed-to-home-screen behaviour. The apple-prefixed pair is still
            what iOS reads; mobile-web-app-capable is the standard successor. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Verdict" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: shell }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const shell = `
  html, body { height: 100%; background-color: #FBF7F2; }
  body { overflow: hidden; overscroll-behavior-y: none; }
  #root { display: flex; height: 100%; flex: 1; }
  /* Stop the double-tap-to-zoom and text-selection wobble that make a web page
     feel like a web page rather than an app. */
  * { -webkit-tap-highlight-color: transparent; }
  input, textarea { -webkit-user-select: text; user-select: text; }
`;
