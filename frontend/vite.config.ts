import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.[mode], .env.[mode].local
  const env = loadEnv(mode, process.cwd(), '')

  // Prefer full URL, otherwise build LocalStack URL from the API Gateway ID.
  const apiGatewayUrl = env.VITE_API_GATEWAY_URL
  const apiGatewayId = env.VITE_API_GATEWAY_ID

  const proxyTarget =
    apiGatewayUrl ||
    (apiGatewayId
      ? `http://localhost:4566/restapis/${apiGatewayId}/local/_user_request_`
      : // Fallback keeps the dev server running, but /api calls will fail until configured.
        'http://localhost:4566/restapis/API_ID/local/_user_request_')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        // In development, proxy /api to LocalStack or API Gateway
        '/api/': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  }
})

// Note: In production (CloudFront), /api/* requests are handled by CloudFront's
// ordered cache behavior which proxies to API Gateway. No proxy config needed.
