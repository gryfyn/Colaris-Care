/** @type {import('next').NextConfig} */

// Content-Security-Policy
//
// Key decisions:
//  - script-src: 'self' + 'unsafe-inline' 'unsafe-eval' in development for Next.js HMR/dev features.
//    In production, should use nonces or remove 'unsafe-inline'.
//  - style-src: 'self' 'unsafe-inline' — Tailwind / CSS-in-JS requires inline styles.
//  - img-src: 'self' data: blob: — for inline SVG avatars and canvas exports.
//  - connect-src: 'self' — all API calls are same-origin.
//  - frame-ancestors 'none' — replaces X-Frame-Options: DENY with a CSP-level control.
//  - object-src 'none' — prevents Flash/plugin injection.
//  - base-uri 'self' — prevents base-tag hijacking.
//  - form-action 'self' — prevents form submissions to external origins.
//
// Applied in all environments (not just production) so dev/test surfaces any
// CSP violations before they reach production.

const CSP = [
  "default-src 'self'",
  // Next.js (App Router) injects inline bootstrap/hydration scripts. Without a
  // per-request nonce those need 'unsafe-inline' or the app cannot hydrate and
  // every page is dead (login button does nothing). 'unsafe-eval' stays dev-only.
  // HARDENING FOLLOW-UP: move to a nonce-based CSP via middleware to drop 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {

  // Security headers
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy',  value: CSP },
        { key: 'X-Content-Type-Options',   value: 'nosniff' },
        { key: 'X-Frame-Options',          value: 'DENY' },
        { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
        {
          key:   'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ],

  compress: true,
};

export default nextConfig;
