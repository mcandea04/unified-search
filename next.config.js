/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['node-tls-client', 'koffi'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
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
