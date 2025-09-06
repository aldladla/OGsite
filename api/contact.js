import { Resend } from 'resend';

export const config = { api: { bodyParser: false } };

function parseUrlEncoded(buf) {
  const body = buf.toString();
  const pairs = body.split('&').filter(Boolean);
  const out = {};
  for (const p of pairs) {
    const [k, v = ''] = p.split('=');
    const key = decodeURIComponent(k);
    const val = decodeURIComponent(v.replace(/\+/g, ' '));
    out[key] = val;
  }
  return out;
}

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1) surowe body
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);

    // 2) upewnij się, że front wysyła url-encoded
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('application/x-www-form-urlencoded')) {
      return res.status(400).json({ error: 'Invalid Content-Type. Expect application/x-www-form-urlencoded' });
    }

    const fields = parseUrlEncoded(buf);
    const { name, email, message, gdpr, company } = fields;

    // 3) honeypot + walidacja
    if (company) return res.status(200).json({ ok: true });
    if (!name || !email || !message || !gdpr) {
      return res.status(400).json({ error: 'Brakuje wymaganych pól' });
    }

    // 4) klucz Resend
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('Brak RESEND_API_KEY');
      return res.status(500).json({ error: 'Brak konfiguracji e-mail (RESEND_API_KEY)' });
    }

    const resend = new Resend(apiKey);

    // 5) na czas testów użyj nadawcy Resend
    await resend.emails.send({
      from: 'onboarding@resend.dev',   // po weryfikacji domeny podmień na swój
      to: 'sshdeweloperzy@gmail.com',  // adres docelowy
      reply_to: email,
      subject: `Wiadomość ze strony – ${name}`,
      text: `Imię i nazwisko: ${name}\nE-mail: ${email}\n\nWiadomość:\n${message}`
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
};
