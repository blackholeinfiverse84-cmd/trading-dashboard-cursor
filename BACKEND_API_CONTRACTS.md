# Backend API Contracts

This document defines the API contracts for features that require backend implementation.

## Stop-Loss API

### Endpoint
`POST /api/risk/stop-loss`

### Purpose
Set or update stop-loss for a trading symbol.

### Request Payload
```json
{
  "symbol": "AAPL",
  "stopLossPrice": 150.50,
  "side": "BUY",
  "timeframe": "5m",
  "source": "chart"
}
```

### Field Descriptions
- `symbol` (string, required): Trading symbol (e.g., "AAPL", "RELIANCE.NS")
- `stopLossPrice` (number, required): Stop-loss price level
- `side` (string, required): Trade side - "BUY" or "SELL"
- `timeframe` (string, required): Chart timeframe (e.g., "5m", "1h", "1d")
- `source` (string, required): Source of stop-loss - "chart" or "manual"

### Response
```json
{
  "success": true,
  "message": "Stop-loss set successfully",
  "data": {
    "symbol": "AAPL",
    "stopLossPrice": 150.50,
    "side": "BUY",
    "timeframe": "5m",
    "source": "chart",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Invalid stop-loss price for BUY order",
  "code": "VALIDATION_ERROR"
}
```

### Validation Rules
- For BUY orders: `stopLossPrice < currentPrice`
- For SELL orders: `stopLossPrice > currentPrice`
- `stopLossPrice` must be positive
- `symbol` must be valid and accessible

---

## AI Chat API

### Endpoint
`POST /api/ai/chat`

### Purpose
Send message to AI trading assistant and receive contextual responses.

### Request Payload
```json
{
  "message": "What is the current trend for AAPL?",
  "context": {
    "symbol": "AAPL",
    "timeframe": "1d",
    "activeIndicators": ["SMA", "RSI"]
  }
}
```

### Field Descriptions
- `message` (string, required): User's message/question
- `context` (object, optional): Trading context
  - `symbol` (string, optional): Currently selected symbol
  - `timeframe` (string, optional): Current chart timeframe
  - `activeIndicators` (array of strings, optional): Active technical indicators

### Response
```json
{
  "message": "Based on the current data, AAPL shows a bullish trend on the daily timeframe...",
  "context": {
    "symbol": "AAPL",
    "confidence": 0.85,
    "suggestions": [
      "Consider monitoring support at $150",
      "RSI indicates potential overbought condition"
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response
```json
{
  "error": "Unable to process request",
  "code": "AI_SERVICE_ERROR",
  "message": "AI service temporarily unavailable"
}
```

### Notes
- Context is optional but recommended for better responses
- Responses should be relevant to trading and market analysis
- AI should consider current market conditions when providing advice

---

## Implementation Status

### Current Status
- ✅ Frontend UI components implemented
- ✅ API contracts defined
- ⏳ Backend endpoints: **NOT YET IMPLEMENTED**

### Frontend Integration Points

#### Stop-Loss
- Location: `trading-dashboard/src/services/api.ts`
- Function: `riskAPI.setStopLoss()`
- Status: Contract defined, throws error until backend is ready

#### AI Chat
- Location: `trading-dashboard/src/services/api.ts`
- Function: `aiAPI.chat()`
- Status: Contract defined, throws error until backend is ready

### Next Steps for Backend
1. Implement `/api/risk/stop-loss` endpoint
2. Implement `/api/ai/chat` endpoint
3. Add authentication/authorization if required
4. Add rate limiting for AI chat
5. Add validation for stop-loss prices
6. Integrate with trading data sources for context

---

## Testing

Once backend is implemented, test with:

### Stop-Loss Test
```bash
curl -X POST http://localhost:8000/api/risk/stop-loss \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "stopLossPrice": 150.50,
    "side": "BUY",
    "timeframe": "5m",
    "source": "manual"
  }'
```

### AI Chat Test
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the current trend?",
    "context": {
      "symbol": "AAPL",
      "timeframe": "1d"
    }
  }'
```

