/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@stacks/connect", "@stacks/ui"],
};

module.exports = nextConfig;
