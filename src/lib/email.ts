import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export interface AlertEmailPayload {
  cardName: string;
  message: string;
  tcgPrice?: number | null;
  ebayPrice?: number | null;
  changePercent?: number | null;
}

export async function sendAlertEmail(alerts: AlertEmailPayload[]) {
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.GMAIL_USER;
  if (!to || !from || !process.env.GMAIL_APP_PASSWORD) return;

  const transporter = createTransport();

  const rows = alerts
    .map(
      (a) => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 14px;font-weight:600">${a.cardName}</td>
        <td style="padding:10px 14px">${a.message}</td>
        <td style="padding:10px 14px">${a.tcgPrice != null ? `$${a.tcgPrice.toFixed(2)}` : "—"}</td>
        <td style="padding:10px 14px">${a.ebayPrice != null ? `$${a.ebayPrice.toFixed(2)}` : "—"}</td>
        <td style="padding:10px 14px;${a.changePercent != null ? (a.changePercent > 0 ? "color:#16a34a" : "color:#dc2626") : ""}">${
          a.changePercent != null ? `${a.changePercent > 0 ? "+" : ""}${a.changePercent.toFixed(1)}%` : "—"
        }</td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#1e293b;border-bottom:2px solid #f59e0b;padding-bottom:8px">
        🃏 Pokemon Trader — Price Alert
      </h2>
      <p style="color:#64748b">${new Date().toLocaleString()}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f8fafc;text-align:left">
            <th style="padding:10px 14px">Card</th>
            <th style="padding:10px 14px">Alert</th>
            <th style="padding:10px 14px">TCGPlayer</th>
            <th style="padding:10px 14px">eBay Avg</th>
            <th style="padding:10px 14px">Change</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;color:#94a3b8;font-size:12px">
        Sent by Pokemon Trader running on your local machine.
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"Pokemon Trader" <${from}>`,
    to,
    subject: `[Pokemon Trader] ${alerts.length} price alert${alerts.length > 1 ? "s" : ""}`,
    html,
  });
}
