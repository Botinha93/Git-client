import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gitea Proxy Route
  // This handles requests to Gitea instances to avoid CORS issues
  app.all('/api/proxy', async (req, res) => {
    const targetUrl = req.headers['x-target-url'] as string;
    const token = req.headers['x-gitea-token'] as string;
    const proxyMethod = req.headers['x-proxy-method'] as string | undefined;
    const proxyBodyType = req.headers['x-proxy-body-type'] as string | undefined;
    const method = (proxyMethod || req.method).toUpperCase();

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing x-target-url header' });
    }

    try {
      const isMultipart = proxyBodyType === 'form-data';
      const response = await axios({
        method,
        url: targetUrl,
        data: ['GET', 'HEAD'].includes(method) ? undefined : isMultipart ? req : req.body,
        params: req.query,
        headers: {
          'Authorization': token ? `token ${token}` : undefined,
          'Content-Type': isMultipart ? req.headers['content-type'] : 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        responseType: 'json',
      });

      if (response.status === 204 || response.data === '') {
        res.status(response.status).end();
        return;
      }

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Proxy error (${method} ${targetUrl}):`, error.message);
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ error: 'Internal server error during proxying' });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
