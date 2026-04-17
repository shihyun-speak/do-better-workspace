export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SLACK_WEBHOOK = process.env.SLACK_SNACK_WEBHOOK;
  if (!SLACK_WEBHOOK) {
    return res.status(500).json({ error: 'SLACK_SNACK_WEBHOOK not configured' });
  }

  const { name, snack, link } = req.body || {};
  if (!name || !snack) {
    return res.status(400).json({ error: 'name and snack are required' });
  }

  try {
    const linkLine = link ? `\n🔗 <${link}|Purchase Link>` : '';
    const slackBody = {
      text: `🍿 *New Snack Request!*\n\n*Requested by:* ${name}\n*Snack:* ${snack}${linkLine}\n\n_via <https://14-snack-dashboard.vercel.app|Happy Nyam Nyam Dashboard>_`
    };

    const slackRes = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackBody),
    });

    if (slackRes.ok) {
      return res.status(200).json({ ok: true });
    } else {
      const err = await slackRes.text();
      return res.status(500).json({ error: `Slack error: ${err}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
