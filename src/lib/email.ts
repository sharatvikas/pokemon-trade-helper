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
  setName?: string | null;
  cardNumber?: string | null;
  imageUrl?: string | null;
  cardId?: string | null;
  message: string;
  ruleType?: "ABOVE" | "BELOW" | "MOVE_PCT" | "AUTO";
  tcgPrice?: number | null;
  tcgLowPrice?: number | null;
  ebayAvgPrice?: number | null;
  ebayLastSold?: number | null;
  changePercent?: number | null;
}

function priceCell(label: string, value: number | null | undefined) {
  if (value == null) return "";
  return `
    <div style="text-align:center;padding:10px 14px;border-right:1px solid #f1f5f9">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${label}</div>
      <div style="font-size:18px;font-weight:700;color:#1e293b">$${value.toFixed(2)}</div>
    </div>`;
}

function changeChip(pct: number | null | undefined) {
  if (pct == null) return "";
  const up = pct > 0;
  const bg = up ? "#dcfce7" : "#fee2e2";
  const color = up ? "#15803d" : "#b91c1c";
  const arrow = up ? "▲" : "▼";
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px">${arrow} ${up ? "+" : ""}${pct.toFixed(1)}%</span>`;
}

function ruleTypeBadge(type: AlertEmailPayload["ruleType"]) {
  const map: Record<string, [string, string]> = {
    ABOVE:    ["#dcfce7", "#15803d"],
    BELOW:    ["#fef3c7", "#b45309"],
    MOVE_PCT: ["#dbeafe", "#1d4ed8"],
    AUTO:     ["#f3e8ff", "#7e22ce"],
  };
  const label: Record<string, string> = {
    ABOVE: "PRICE ABOVE", BELOW: "PRICE BELOW", MOVE_PCT: "% MOVE", AUTO: "BIG MOVE",
  };
  const [bg, color] = map[type ?? "AUTO"] ?? map["AUTO"];
  return `<span style="background:${bg};color:${color};font-size:10px;font-weight:800;letter-spacing:0.08em;padding:3px 9px;border-radius:99px;text-transform:uppercase">${label[type ?? "AUTO"]}</span>`;
}

export async function sendAlertEmail(alerts: AlertEmailPayload[]) {
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.GMAIL_USER;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!to || !from || !process.env.GMAIL_APP_PASSWORD) return;

  const transporter = createTransport();

  const cards = alerts.map((a) => {
    const cardUrl = a.cardId ? `${appUrl}/cards/${a.cardId}` : `${appUrl}/want-list`;
    const hasPrices = [a.tcgPrice, a.tcgLowPrice, a.ebayAvgPrice, a.ebayLastSold].some((v) => v != null);

    return `
    <!-- Card block -->
    <div style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">

      <!-- Card header: image + name + badge -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid #f1f5f9;background:#fafafa">
        ${a.imageUrl
          ? `<img src="${a.imageUrl}" alt="${a.cardName}" style="width:48px;height:67px;object-fit:contain;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15)">`
          : `<div style="width:48px;height:67px;background:#fef3c7;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px">🃏</div>`
        }
        <div style="flex:1;min-width:0">
          <div style="font-size:17px;font-weight:800;color:#1e293b;margin-bottom:3px">${a.cardName}</div>
          ${a.setName ? `<div style="font-size:12px;color:#64748b">${a.setName}${a.cardNumber ? ` &middot; #${a.cardNumber}` : ""}</div>` : ""}
          <div style="margin-top:6px">${ruleTypeBadge(a.ruleType)}</div>
        </div>
        ${changeChip(a.changePercent) ? `<div style="text-align:right">${changeChip(a.changePercent)}</div>` : ""}
      </div>

      <!-- Alert message -->
      <div style="padding:12px 20px;background:#fffbeb;border-bottom:1px solid #fde68a">
        <div style="font-size:13px;color:#92400e">
          <strong>Alert:</strong> ${a.message}
        </div>
      </div>

      <!-- Price grid -->
      ${hasPrices ? `
      <div style="display:flex;border-bottom:1px solid #f1f5f9">
        ${priceCell("TCG Market", a.tcgPrice)}
        ${priceCell("TCG Low", a.tcgLowPrice)}
        ${priceCell("eBay Avg Sold", a.ebayAvgPrice)}
        ${priceCell("eBay Last Sold", a.ebayLastSold)}
      </div>` : ""}

      <!-- Footer: view link -->
      <div style="padding:12px 20px">
        <a href="${cardUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#ffffff;font-size:12px;font-weight:700;padding:8px 18px;border-radius:99px;text-decoration:none">
          View Card →
        </a>
      </div>
    </div>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:640px;margin:0 auto;padding:32px 16px">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:28px">
    <div style="display:inline-flex;align-items:center;gap:10px;background:#ffffff;border-radius:12px;padding:10px 20px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
      <span style="font-size:22px">🃏</span>
      <span style="font-size:18px;font-weight:800;color:#1e293b;letter-spacing:-0.02em">Pokemon Trader</span>
    </div>
    <div style="margin-top:14px">
      <h1 style="margin:0;font-size:24px;font-weight:800;color:#1e293b">
        ${alerts.length} Price Alert${alerts.length !== 1 ? "s" : ""}
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:#64748b">${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</p>
    </div>
  </div>

  <!-- Alert cards -->
  ${cards}

  <!-- Footer -->
  <div style="text-align:center;padding-top:8px">
    <a href="${appUrl}" style="font-size:12px;color:#94a3b8;text-decoration:none">Open Pokemon Trader</a>
    <span style="color:#cbd5e1;margin:0 8px">·</span>
    <span style="font-size:12px;color:#94a3b8">Running on your local machine</span>
  </div>
</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Pokemon Trader" <${from}>`,
    to,
    subject: `[Pokemon Trader] ${alerts.length} price alert${alerts.length !== 1 ? "s" : ""} — ${alerts.map((a) => a.cardName).join(", ")}`,
    html,
  });
}
