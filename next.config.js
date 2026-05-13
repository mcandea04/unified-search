/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's13emagst.akamaized.net',
      },
      {
        protocol: 'https',
        hostname: 'comenzi.bebetei.ro',
      },
      {
        protocol: 'https',
        hostname: '**.notino.ro',
      },
    ],
  },
}

module.exports = nextConfig
