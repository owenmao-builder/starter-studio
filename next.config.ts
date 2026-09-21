import type { NextConfig } from 'next';
const config: NextConfig = { agentRules: false, devIndicators: false, serverExternalPackages: ['pdf-parse', 'mammoth'], poweredByHeader: false };
export default config;
