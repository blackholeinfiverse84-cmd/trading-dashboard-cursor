# Trading Dashboard - Multi-Asset Trading Platform

A modern, responsive trading dashboard built with React, TypeScript, and Vite. Features real-time stock predictions, portfolio management, market scanning, and comprehensive analytics.

## Features

- 🔐 **Authentication**: Login and Signup pages with JWT token management
- 📊 **Dashboard**: Overview of portfolio performance and top performers
- 🔍 **Market Scan**: Search and analyze stocks with AI-powered predictions
- 💼 **Portfolio**: Manage holdings with real-time price updates
- 📈 **Analytics**: Detailed charts and insights
- ⭐ **Watch List**: Monitor favorite stocks
- 📜 **Trading History**: View all past transactions
- 🎨 **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios

## Project Structure

```
trading-dashboard/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Layout.tsx      # Main layout wrapper
│   │   ├── Navbar.tsx      # Top navigation bar
│   │   └── Sidebar.tsx     # Side navigation menu
│   ├── contexts/           # React contexts
│   │   └── AuthContext.tsx # Authentication context
│   ├── pages/              # Page components
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MarketScanPage.tsx
│   │   ├── PortfolioPage.tsx
│   │   ├── TradingHistoryPage.tsx
│   │   ├── WatchListPage.tsx
│   │   └── AnalyticsPage.tsx
│   ├── services/           # API services
│   │   └── api.ts         # Backend API integration
│   ├── routes.tsx         # Route configuration
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── public/                # Static assets
├── index.html            # HTML template
└── package.json          # Dependencies

```

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend API running on http://127.0.0.1:8000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:5173)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## API Integration

The frontend connects to the backend API at `http://127.0.0.1:8000`. All API calls are handled through the `services/api.ts` file.

### Available Endpoints

- `POST /auth/login` - User authentication
- `POST /tools/predict` - Get stock predictions
- `POST /tools/scan_all` - Scan multiple stocks
- `POST /tools/analyze` - Analyze stock with risk parameters
- `GET /tools/health` - System health check

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Features Overview

### Dashboard
- Portfolio value overview
- Daily change tracking
- Top performing stocks
- Portfolio performance chart

### Market Scan
- Search stocks by symbol
- Quick select popular stocks
- AI-powered predictions
- Multiple time horizons (intraday, short, long)

### Portfolio
- View all holdings
- Real-time price updates
- Gain/loss calculations
- Buy/Sell actions

### Analytics
- Performance trends
- Signal distribution charts
- Top predictions
- Confidence metrics

## Responsive Design

The app is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is for educational and research purposes.

