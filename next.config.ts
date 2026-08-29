import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The shared rooms moved from /workspaces to /shared when the section was
   * renamed. Those addresses are already out in the world — every invitation
   * email ever sent carries one, and people bookmark a room they open daily —
   * so the old paths keep working rather than turning into 404s.
   *
   * Permanent, because this is the new address and not a temporary detour.
   */
  async redirects() {
    return [
      { source: "/workspaces", destination: "/shared", permanent: true },
      { source: "/workspaces/:id", destination: "/shared/:id", permanent: true },
      // "New clip" became "Footage": the page always WAS the video library —
      // upload zone, your footage, and the theater once one is open — and was
      // the only item in the rail named after an action rather than a thing.
      { source: "/start", destination: "/footage", permanent: true },
    ];
  },
};

export default nextConfig;
