const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK || 'https://n8n.felaniam.cloud/webhook/annotate';

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint — calls n8n webhook and streams back the result
app.post('/api/annotate', async (req, res) => {
  const { url, ratio } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ratio: ratio || '4:5' }),
    });

    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('image/')) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      res.json({
        success: true,
        image: `data:image/png;base64,${base64}`,
        url,
        ratio: ratio || '4:5',
      });
    } else {
      // n8n returned JSON (metadata + binary might be separate)
      const data = await response.json();
      res.json({
        success: true,
        data,
        url,
        ratio: ratio || '4:5',
      });
    }
  } catch (err) {
    console.error('Annotation failed:', err.message);
    res.status(500).json({ error: 'Annotation failed', details: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', webhook: N8N_WEBHOOK });
});

app.listen(PORT, () => {
  console.log(`Annotate app running on port ${PORT}`);
  console.log(`n8n webhook: ${N8N_WEBHOOK}`);
});
