import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
 base: '/kids/admin/dist/',
 plugins: [react(), tailwindcss()],
 build: { outDir: '../admin/dist', emptyOutDir: true, sourcemap: false },
 server: { host: '127.0.0.1', proxy: { '/kids/api/': 'http://127.0.0.1:8000', '/kids/admin/api/': 'http://127.0.0.1:8000' } },
 preview: { host: '127.0.0.1' }
});
