// /api/contact.js – wersja bez paczek (REST fetch)
export const config = { api: { bodyParser: false } };

function parseUrlEncoded(buf) {
  const out = {};
  const body = buf.toString();
  for (const p of body.split('&')) {
    if (!p) continue;
    const [k, v = ''] = p.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1) wczytaj body url-encoded
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const fields = parseUrlEncoded(Buffer.concat(chunks));
    const { name, email, message, gdpr, company } = fields;

    // 2) walidacja
    if (company) return res.status(200).json({ ok: true }); // honeypot
    if (!name || !email || !message || !gdpr) {
      return res.status(400).json({ error: 'Brakuje wymaganych pól' });
    }

    // 3) klucz API
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('Brak RESEND_API_KEY');
      return res.status(500).json({ error: 'Brak konfiguracji e‑mail' });
    }

    // 4) wysyłka maila bez SDK – czysty HTTP
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',         // do testów; po SPF/DKIM zmień na swój
        to: ['sshdeweloperzy@gmail.com'],      // docelowy adres
        reply_to: email,
        subject: `Wiadomość ze strony – ${name}`,
        text: `Imię i nazwisko: ${name}\nE-mail: ${email}\n\nWiadomość:\n${message}`
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend error:', data);
      return res.status(502).json({ error: 'Email provider error' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
};
