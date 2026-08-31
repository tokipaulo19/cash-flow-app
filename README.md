# Cashflow

A privacy-first household cash-flow planner converted from an Excel forecasting model.

## Features

- Daily cash projection with 4–26 week horizons
- Weekly roll-up with safe, tight, and shortfall states
- Weekly, fortnightly, monthly, quarterly, and annual recurrence
- Month-end-safe recurring dates
- Paid/unpaid one-off and variable expenses
- Active/paused recurring items
- Automatic browser storage with JSON backup and restore
- Responsive dashboard and cash-item management
- Installable app shell with offline support after the first visit

## Privacy and data

No personal cash-flow data is committed to this repository. Forecast data is stored only in the browser on the current device. Use **Backup** before changing devices or clearing browser data, then use **Import** on the other device.

## Run locally

```bash
npm install
npm run dev
```

The app opens on the Vite URL printed in the terminal. Data stays in the browser's local storage.

## Quality checks

```bash
npm run lint
npm run build
```

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the app whenever `main` is pushed. In the repository, open **Settings → Pages** and select **GitHub Actions** as the source.
