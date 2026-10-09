import type { NextConfig } from "next"

/** Links shared before leagues existed (/standings, /team/…) land on the original league. */
const LEGACY_LEAGUE = process.env.LEGACY_LEAGUE_SLUG ?? "hrd"
const LEGACY_PATHS = ["standings", "players", "optimal", "odds", "team", "submit", "rules"]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return LEGACY_PATHS.flatMap((path) => [
      { source: `/${path}`, destination: `/${LEGACY_LEAGUE}/${path}`, permanent: false },
      { source: `/${path}/:rest*`, destination: `/${LEGACY_LEAGUE}/${path}/:rest*`, permanent: false },
    ])
  },
}

export default nextConfig
