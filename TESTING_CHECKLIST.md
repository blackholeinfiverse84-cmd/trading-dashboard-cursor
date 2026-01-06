# Frontend Testing Checklist

## ✅ Pre-Flight Checks

### 1. Build & Dev Server
- [x] `npm run dev` runs without errors
- [x] TypeScript compilation passes
- [x] No linter errors
- [x] Dev server starts on port 5173 or 5174

### 2. Backend Connection
- [x] Backend server running on http://127.0.0.1:8000
- [x] Health check endpoint responds: `/tools/health`
- [x] API info endpoint responds: `/`
- [x] Connection banner shows "Connected" (not "Server Offline")

## 🔍 Page-by-Page Testing

### Dashboard Page (`/dashboard`)
- [ ] Page loads without errors
- [ ] Portfolio value displays correctly
- [ ] Top performers section loads
- [ ] Refresh button works
- [ ] Add trade button works
- [ ] Delete trade button works
- [ ] Charts render correctly
- [ ] No console errors

### Market Scan Page (`/market-scan`)
- [ ] Page loads without errors
- [ ] Search input accepts symbols
- [ ] Search button triggers API call
- [ ] Analyze button triggers API call
- [ ] Predictions display correctly
- [ ] Chart button opens candlestick chart
- [ ] Feedback button opens feedback modal
- [ ] Stop-loss panel appears when chart is open
- [ ] Tab switching (Stocks/Crypto/Commodities) works
- [ ] No console errors

**API Endpoints to Test:**
- [ ] POST `/tools/predict` - Single symbol prediction
- [ ] POST `/tools/analyze` - Deep analysis with risk params
- [ ] GET `/tools/health` - Health check

### Portfolio Page (`/portfolio`)
- [ ] Page loads without errors
- [ ] Positions list displays
- [ ] Add position button works
- [ ] Remove position button works
- [ ] Real-time price updates (if WebSocket connected)
- [ ] P&L calculations correct
- [ ] No console errors

### Analytics Page (`/analytics`)
- [ ] Page loads without errors
- [ ] Charts render (bar, line, area)
- [ ] Analytics data displays correctly
- [ ] Period selector works (7d, 30d, 90d)
- [ ] Model performance section displays
- [ ] No console errors

**API Endpoints to Test:**
- [ ] POST `/tools/scan_all` - Multi-symbol scanning

### Alerts Page (`/alerts`)
- [ ] Page loads without errors
- [ ] Price alerts section displays
- [ ] Prediction alerts section displays
- [ ] Add alert button works
- [ ] Toggle alert button works
- [ ] Delete alert button works
- [ ] No console errors

### Compare Page (`/compare`)
- [ ] Page loads without errors
- [ ] Add symbol button works
- [ ] Remove symbol button works
- [ ] Comparison charts render
- [ ] Up to 4 symbols comparison works
- [ ] No console errors

### Watch List Page (`/watchlist`)
- [ ] Page loads without errors
- [ ] Watchlist items display
- [ ] Add to watchlist works
- [ ] Remove from watchlist works
- [ ] No console errors

### Settings Page (`/settings`)
- [ ] Page loads without errors
- [ ] Theme switcher works (Light/Dark/Space)
- [ ] Refresh interval setting works
- [ ] Export data button works
- [ ] Clear all data button works
- [ ] No console errors

## 🔘 Button Testing

### Navigation
- [ ] Sidebar menu items navigate correctly
- [ ] Mobile menu button works
- [ ] Close sidebar button works
- [ ] Logout button works

### Action Buttons
- [ ] Search buttons (navbar, market scan)
- [ ] Analyze buttons
- [ ] Refresh buttons
- [ ] Add/Remove buttons
- [ ] Submit buttons (feedback, forms)
- [ ] Retry buttons (connection banner)
- [ ] Close buttons (modals, panels)

### Chart Controls
- [ ] Timeframe selector
- [ ] Chart type selector
- [ ] Indicators toggle
- [ ] Fullscreen toggle
- [ ] Drawing tools (if implemented)

## 🌐 API Endpoint Testing

### Authentication
- [ ] GET `/` - API info
- [ ] GET `/auth/status` - Rate limit status
- [ ] POST `/auth/login` - Login (if auth enabled)

### Trading Tools
- [ ] POST `/tools/predict` - Get predictions
- [ ] POST `/tools/scan_all` - Scan multiple symbols
- [ ] POST `/tools/analyze` - Deep analysis
- [ ] POST `/tools/feedback` - Submit feedback
- [ ] POST `/tools/fetch_data` - Batch data fetch
- [ ] POST `/tools/train_rl` - Train RL model (optional)

### Health
- [ ] GET `/tools/health` - System health

## ⚠️ Error Handling Tests

- [ ] Backend offline - shows connection banner
- [ ] Rate limit exceeded - shows user-friendly message
- [ ] Invalid symbol - shows error message
- [ ] Network timeout - handles gracefully
- [ ] 404 errors - handled correctly
- [ ] 500 errors - handled correctly

## 🎨 UI/UX Tests

- [ ] All themes work (Light/Dark/Space)
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] Success messages display
- [ ] Tooltips work
- [ ] Modals close properly
- [ ] Forms validate correctly

## 🔄 Real-time Features

- [ ] WebSocket connects (if backend supports)
- [ ] Price updates work (if WebSocket connected)
- [ ] Portfolio updates work
- [ ] Notifications work

## 📊 Data Flow Tests

- [ ] Search → Prediction → Display
- [ ] Analyze → Results → Display
- [ ] Feedback → Submit → Confirmation
- [ ] Add Trade → Dashboard Update
- [ ] Settings → Save → Persist

## 🐛 Known Issues to Watch

- [ ] Rate limit messages persist incorrectly
- [ ] WebSocket connection errors in console (expected until backend supports it)
- [ ] Banner z-index (should be above sidebar - fixed)

## 📝 Manual Test Commands

```bash
# Test backend connection
curl http://127.0.0.1:8000/

# Test health endpoint
curl http://127.0.0.1:8000/tools/health

# Test predict endpoint (requires POST)
# Use browser DevTools Network tab or Postman
```

## ✅ Test Results Template

Date: _______________
Tester: _______________

**Pages Tested:** ___/9
**Buttons Tested:** ___/20+
**Endpoints Tested:** ___/8
**Errors Found:** ___
**Fixed:** ___

Notes:
_________________________________
_________________________________




