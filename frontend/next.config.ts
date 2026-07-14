import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: require('path').join(__dirname, '../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
