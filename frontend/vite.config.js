import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        host: true,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'http://localhost:5000',
                changeOrigin: true,
            },
            '/uploads': {
                target: process.env.VITE_API_URL || 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
});
