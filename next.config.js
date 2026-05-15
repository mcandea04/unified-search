/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['node-tls-client', 'koffi'],
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
