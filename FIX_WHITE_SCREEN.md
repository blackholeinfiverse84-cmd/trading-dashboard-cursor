# Fix White Screen Error

## Error
```
alertsService.ts:1 Uncaught SyntaxError: The requested module '/src/types/alerts.ts' 
does not provide an export named 'AppNotification'
```

## Root Cause
This is a **Vite cache issue**. The file is correct, but Vite's dev server has cached an old version.

## Solution Steps

### 1. Stop the Dev Server
Press `Ctrl+C` in the terminal where the dev server is running.

### 2. Clear Vite Cache
Run these commands in the `trading-dashboard` directory:

**Windows (PowerShell):**
```powershell
cd trading-dashboard
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

**Or manually:**
- Delete the `node_modules/.vite` folder
- Delete the `dist` folder if it exists

### 3. Clear Browser Cache
- Open DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"
- Or press `Ctrl + Shift + R` / `Ctrl + F5`

### 4. Restart Dev Server
```bash
cd trading-dashboard
npm run dev
```

## Verification

The file `src/types/alerts.ts` is correct and exports:
- ✅ `PriceAlert`
- ✅ `PredictionAlert`  
- ✅ `AppNotification` (line 25)
- ✅ `AlertType`

All imports are correct:
- ✅ `src/services/alertsService.ts` imports `AppNotification`
- ✅ `src/contexts/NotificationContext.tsx` imports `AppNotification`

## If Still Not Working

1. **Check browser console** for the exact error message
2. **Restart your IDE/editor** (sometimes file watchers get stuck)
3. **Delete node_modules and reinstall:**
   ```bash
   cd trading-dashboard
   rm -rf node_modules
   npm install
   npm run dev
   ```

## Files Verified ✅
- `src/types/alerts.ts` - Exports `AppNotification` correctly
- `src/services/alertsService.ts` - Imports correctly
- `src/contexts/NotificationContext.tsx` - Imports correctly
- `tsconfig.json` - `verbatimModuleSyntax: false` (allows regular imports)

