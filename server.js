const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const N8N_BASE = process.env.N8N_BASE || 'https://n8n.felaniam.cloud/webhook';

// Per-format webhook paths — each maps to a dedicated n8n workflow
const FORMAT_WEBHOOKS = {
  '3:4': `${N8N_BASE}/annotate-3-4`,
  '4:5': `${N8N_BASE}/annotate-4-5`,
  '9:16': `${N8N_BASE}/annotate-9-16`,
};

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint — fans out to per-format n8n workflows in parallel
app.post('/api/annotate', async (req, res) => {
  let { url, image, formats, prompt, logo } = req.body;

  if (!url && !image) {
    return res.status(400).json({ error: 'URL or image is required' });
  }

  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url.replace(/^\/\//, '');
  }

  const formatList = formats || ['4:5'];

  try {
    const payload = { prompt: prompt || '', logo: logo || '' };
    if (image) {
      payload.image = image;
    } else {
      payload.url = url;
    }

    // Fan out: one request per format, all in parallel
    const promises = formatList.map(async (fmt) => {
      const webhookUrl = FORMAT_WEBHOOKS[fmt];
      if (!webhookUrl) return { format: fmt, image: null, error: `No workflow for format ${fmt}` };

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, format: fmt }),
        });

        const text = await response.text();
        if (!response.ok) {
          return { format: fmt, image: null, error: `${response.status}: ${text.substring(0, 200)}` };
        }

        let data;
        try { data = JSON.parse(text); } catch(e) {
          return { format: fmt, image: null, error: `Invalid JSON: ${text.substring(0, 200)}` };
        }
        return {
          format: fmt,
          image: data.image || null,
          title: data.title,
          subtitle: data.subtitle,
          url: data.url,
        };
      } catch (err) {
        return { format: fmt, image: null, error: err.message };
      }
    });

    const results = await Promise.all(promises);

    const images = {};
    let title = '', subtitle = '';
    for (const r of results) {
      if (r.image) images[r.format] = r.image;
      if (r.title) title = r.title;
      if (r.subtitle) subtitle = r.subtitle;
    }

    if (Object.keys(images).length === 0) {
      return res.json({ success: false, error: 'No images returned from pipeline' });
    }

    res.json({
      success: true,
      title,
      subtitle,
      url: url || 'local upload',
      formats: formatList,
      annotationCount: Object.keys(images).length,
      images,
    });
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
