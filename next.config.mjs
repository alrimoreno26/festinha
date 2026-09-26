/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Pacotes com binário nativo / dependências opcionais: carregados pelo Node, sem passar pelo webpack.
    serverComponentsExternalPackages: ['@node-rs/argon2', 'ws'],
  },
}

export default nextConfig
