import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function localMapEditorPlugin() {
  return {
    name: 'cof-local-map-editor',
    configureServer(server) {
      server.middlewares.use('/api/save-custom-map', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const mapId = String(payload.mapId || '').trim();
            if (!mapId) throw new Error('mapId ausente');
            const filePath = path.resolve(process.cwd(), 'src/game/data/customMaps.json');
            let current = {};
            if (fs.existsSync(filePath)) {
              try {
                current = JSON.parse(fs.readFileSync(filePath, 'utf-8') || '{}');
              } catch {
                current = {};
              }
            }
            if (payload.reset) {
              delete current[mapId];
            } else {
              current[mapId] = payload.data;
            }
            fs.writeFileSync(filePath, JSON.stringify(current, null, 2) + '\n', 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, mapId, file: 'src/game/data/customMaps.json' }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localMapEditorPlugin()],
  server: { port: 5173 },
});
