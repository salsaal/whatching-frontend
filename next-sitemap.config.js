// next-sitemap.config.js
// NEXT_PUBLIC_DOMAIN must be set to the real production URL before launch --
// left unset, this used to silently fall back to https://google.com and ship
// a sitemap/robots.txt pointing at Google's own domain.
//
// Everything in this app sits behind login (see pages/index.tsx, which just
// redirects to /overview) -- there's no public marketing content to index,
// so crawling is disallowed entirely rather than generating a sitemap for
// pages a crawler could never actually see past the auth wall.
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_DOMAIN ?? "http://localhost:3000",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [{ userAgent: "*", disallow: "/" }]
  }
};
