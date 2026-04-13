# Pokemon Trade Helper

A personal Pokemon TCG price tracker built for collectors. Add cards to your want list, track prices across TCGPlayer and eBay, and get email alerts when prices move.

> **Personal use tool** — runs locally on your machine at `localhost:3000`. No server or hosting required.

---

## What It Does

You build a **want list** of Pokemon cards you're hunting for. The app monitors their market prices across TCGPlayer and eBay every 6 hours and emails you when:

- A price drops below your target threshold
- A price rises above a level you care about
- Any card moves more than 10% in either direction

Prices are pulled from **pokemontcg.io** (TCGPlayer market data) with a **Scrydex fallback** for brand-new sets and Japanese releases that haven't been indexed yet.

---

## Screenshots

> Drop your own screenshots into `docs/screenshots/` and update the paths below.

### Dashboard
![Dashboard overview with stat cards and want list table](docs/screenshots/dashboard.png)

### Want List
![Want list grid with card images and live prices](docs/screenshots/want-list.png)

### Add Card — Search
![Add card dialog showing name search with live prices in results](docs/screenshots/add-card-search.png)

### Add Card — Paste Link
![Add card dialog with URL lookup from TCGPlayer](docs/screenshots/add-card-url.png)

### Card Detail
![Card detail page with price history chart and alert rules](docs/screenshots/card-detail.png)

---

## Features

**Want List**
- Add cards by pasting a TCGPlayer / eBay / any card listing URL
- Search by card name with optional set filter (200+ sets)
- Upload card photos or Collectr screenshots for AI identification
- Live TCGPlayer market price shown in search results before you add

**Price Tracking**
- Polls TCGPlayer market prices and eBay average sold every 6 hours
- Scrydex fallback for new sets not yet in pokemontcg.io's price database
- Price history chart per card (TCGPlayer vs eBay over time)
- Dashboard highlights cards with >10% moves

**Alerts**
- Per-card alert rules: price above threshold, price below threshold, % move
- Auto-alerts on any >10% price swing (no rule needed)
- Email notifications via Gmail

**UI**
- Apple-inspired glassmorphism design
- Frosted glass navbar, animated stat cards, gradient area charts
- Set filter dropdown with "No TCG price" warning for unpriced sets
- Pricing warning shown before adding a card with no data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4, custom CSS design system |
| Database | SQLite via Prisma 7 + `better-sqlite3` adapter |
| Price data | pokemontcg.io v2 API + Scrydex fallback |
| eBay data | eBay Finding API |
| AI card ID | Claude Haiku (URL) + Claude Opus (images) |
| Email | Nodemailer + Gmail SMTP |
| Cron | `node-cron` standalone worker |
| UI components | shadcn/ui (Radix-based) |
| Charts | Recharts |
| Fonts | Syne (display) + DM Sans (body) |

---

## Prerequisites

- **Node.js** 18+ (tested on v20+)
- **npm** 9+
- A **Gmail account** with an [App Password](https://myaccount.google.com/apppasswords) (not your regular password)
- An **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com) — for URL and image card identification
- *(Optional)* An **eBay Developer App ID** from [developer.ebay.com](https://developer.ebay.com) — for eBay sold listing prices. The app works without it (TCGPlayer prices still show).

---

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/sharatvikas/pokemon-trade-helper.git
cd pokemon-trade-helper

# 2. Install dependencies
npm install

# 3. Run the interactive setup wizard
npm run setup
```

The setup wizard will ask for each configuration value and write them to `.env.local`. Press Enter to keep an existing value.

---

## Configuration

The setup wizard (`npm run setup`) configures these values:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite path — default `file:./prisma/dev.db` | Yes |
| `GMAIL_USER` | Your Gmail address | Yes |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your login password) | Yes |
| `NOTIFICATION_EMAIL` | Where alert emails are sent | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for card identification | Yes |
| `EBAY_APP_ID` | eBay Developer App ID | No |
| `NEXT_PUBLIC_APP_URL` | App URL — default `http://localhost:3000` | Yes |

### Getting a Gmail App Password

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already on
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create a new app password — name it "Pokemon Trade Helper"
5. Copy the 16-character password into the setup wizard

---

## Database Setup

After running `npm run setup`, initialise the database:

```bash
npx prisma migrate dev --name init
```

This creates the SQLite database file at `prisma/dev.db` with all required tables.

---

## Running the App

**Start the web app:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Start the price poller (in a separate terminal):**
```bash
node cron-worker.mjs
```

The cron worker fetches prices immediately on start, then every 6 hours. It hits `localhost:3000/api/poll` — the web app must be running for it to work.

> **Tip:** Keep both terminals running. The web app serves the UI and API; the cron worker drives the scheduled price checks.

---

## Usage

### Adding Cards

Open the **Want List** page and click **Add Card**. Three ways to add:

**Paste Link** — paste any TCGPlayer, eBay, or card listing URL. The app identifies the card automatically using pattern matching + Claude AI.

**Search** — type a card name (e.g. `Charizard`) and optionally filter by set from the dropdown (200+ sets available). Prices are shown directly in the search results so you can compare variants before adding.

**Image** — upload a photo of the card or a Collectr screenshot. Claude identifies the card and searches for it automatically.

Once you select a card, a preview shows:
- TCGPlayer market price (or Scrydex price for new/Japanese sets)
- A warning if no price data is found on either source

Prices load automatically the moment you add a card — no need to wait for the next scheduled poll.

### Dashboard

The **Dashboard** at `/` shows:
- **Cards Tracked** — total cards on your want list
- **Active Alerts** — total alert rules across all cards
- **Avg TCGPlayer** — mean market price across your list
- **Big Movers** — cards that moved >10% since last poll

Cards with big price moves get an amber left-border highlight in the table. Click any card name to open its detail page.

### Card Detail Page

Each card has a detail page with:
- Current prices from TCGPlayer (market + low) and eBay (avg + last sold)
- % change badges vs the previous poll
- Area chart showing price history over time (TCGPlayer in amber, eBay in blue)
- Alert rule management

### Setting Alerts

On any card detail page → scroll to **Alert Rules** → click **Add Rule**:

| Type | Triggers when |
|------|---------------|
| Price Below | Market price drops under your $ threshold |
| Price Above | Market price rises over your $ threshold |
| % Move | Price moves ±X% from the previous snapshot |

Source can be **TCGPlayer**, **eBay**, or **Both**.

You also get automatic alerts (no rule needed) any time a card moves more than 10% in a single polling cycle.

### Manual Price Refresh

Click **Refresh Prices** on the Dashboard to immediately fetch the latest prices for all cards without waiting for the 6-hour cron cycle. Results appear in a banner showing how many cards updated and whether any alerts fired.

---

## Project Structure

```
pokemon-trade-helper/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── want-list/page.tsx    # Want list
│   │   ├── cards/[id]/page.tsx   # Card detail
│   │   ├── alerts/page.tsx       # All alerts
│   │   └── api/
│   │       ├── cards/            # CRUD for want list cards
│   │       ├── poll/             # Manual price refresh trigger
│   │       ├── search/           # pokemontcg.io search + Scrydex enrichment
│   │       ├── identify/         # Image → card AI identification
│   │       └── identify-url/     # URL → card identification
│   ├── components/
│   │   ├── DashboardClient.tsx
│   │   ├── WantListClient.tsx
│   │   ├── CardDetailClient.tsx
│   │   ├── Navbar.tsx
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       ├── pokemontcg.ts         # pokemontcg.io API client + set listing
│       ├── scrydex.ts            # Scrydex price fallback scraper
│       ├── ebay.ts               # eBay Finding API client
│       ├── email.ts              # Nodemailer alert emails
│       ├── pricePoller.ts        # Core polling + alert logic
│       └── prisma.ts             # Prisma client singleton
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # SQL migrations
├── docs/screenshots/             # Add your screenshots here
├── cron-worker.mjs               # Standalone 6-hour price poll worker
├── setup.mjs                     # Interactive setup wizard
└── prisma.config.ts              # Prisma 7 driver adapter config
```

---

## Database Schema

```
WantCard        — cards on your want list
PriceSnapshot   — price readings per card per poll cycle
AlertRule       — per-card threshold rules (ABOVE / BELOW / MOVE_PCT)
AlertHistory    — log of triggered alerts with price value and message
```

---

## Limitations

- **eBay prices** require an approved eBay Developer account (typically 1 business day). TCGPlayer prices work immediately without it.
- **Price history charts** need at least 2 poll cycles to render a line. Run the cron worker and use "Refresh Prices" a couple of times to populate.
- **Scrydex fallback** covers most new and Japanese sets, but very freshly released cards may not be indexed yet on any source.
- Designed for **local, single-user use** — no authentication or multi-user support.

---

## License

MIT — personal use.
