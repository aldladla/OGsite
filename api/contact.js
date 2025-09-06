import { Resend } from 'resend';

export const config = { api: { bodyParser: false } };

export default async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // odczyt FormData (bez plików)
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();
  const pairs = body.split('&').map(p => p.split('='));
  const fields = Object.fromEntries(pairs.map(([k,v]) => [decodeURIComponent(k), decodeURIComponent(v)]));

  const { name, email, message, gdpr, company } = fields;
  if (company) return res.status(200).json({ ok: true }); // honeypot
  if (!name || !email || !message || !gdpr) {
    return res.status(400).json({ error: 'Brakuje danych.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: 'formularz@twojadomena.pl', // po weryfikacji domeny w Resend
      to: 'sshdeweloperzy@gmail.com',
      reply_to: email,
      subject: `Nowe zgłoszenie – ${name}`,
      text: `Imię i nazwisko: ${name}\nE-mail: ${email}\n\nWiadomość:\n${message}`
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd wysyłki' });
  }
};
