/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'agent-sync-api',
      configureServer(server) {
        server.middlewares.use('/api/agent-sync', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { filename, content } = data;
                if (!filename || typeof content !== 'string') {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing filename or content' }));
                  return;
                }

                // Ensure filename is safe (no path traversal)
                const safeName = path.basename(filename);
                const targetDir = path.resolve(__dirname, 'src/agent_settings');
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }
                const targetPath = path.join(targetDir, safeName);
                fs.writeFileSync(targetPath, content, 'utf-8');

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, path: targetPath }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  test: {
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'supabase/**',
      'src/lib/describeFenceParser.test.ts'
    ]
  }
});
