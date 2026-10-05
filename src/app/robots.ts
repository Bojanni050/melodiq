import { MetadataRoute } from 'next'

// Public: /, /discover, /explore, /artist/[slug]. Everything else is the
// logged-in studio (or an API) and should not be crawled.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/discover', '/explore', '/artist/'],
      disallow: [
        '/api/',
        '/account',
        '/admin',
        '/archive',
        '/artist-pages',
        '/library',
        '/login',
        '/logs',
        '/lyrics-studio',
        '/melody',
        '/player-window',
        '/playlists',
        '/register',
        '/releases',
        '/settings',
        '/smart-archive',
        '/studio',
        '/style',
        '/timecoded-editor',
        '/workspaces',
      ],
    },
  }
}
