"""
This module handles data ingestion for the stock analysis pipeline.
"""
import logging
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any
import pandas as pd
import numpy as np
import yfinance as yf

logger = logging.getLogger(__name__)

# Directory configuration
DATA_DIR = Path("data")
DATA_CACHE_DIR = DATA_DIR / "cache"
NSE_BHAV_CACHE_DIR = DATA_DIR / "nse_bhav"

# Create directories if they don't exist
for directory in [DATA_CACHE_DIR, NSE_BHAV_CACHE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


class EnhancedDataIngester:
    """
    Enhanced data ingester that fetches from Yahoo Finance with fallback to cache.
    """
    def __init__(self):
        self.data_sources = ['yfinance']
    
    def fetch_all_data(self, symbol: str, period: str = "2y") -> Dict[str, Any]:
        """
        Fetch all available data for a symbol with fallback mechanism
        """
        logger.info(f"Fetching data for {symbol} with period {period}")
        
        # Try Yahoo Finance first
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            
            if len(hist) > 50:  # Sufficient data from yfinance
                logger.info(f"Successfully fetched {len(hist)} rows from yfinance for {symbol}")
                
                # Get additional info
                info = ticker.info or {}
                recommendations = ticker.recommendations if hasattr(ticker, 'recommendations') else None
                news = ticker.news if hasattr(ticker, 'news') else []
                
                # Prepare financials data (simplified)
                financials = {
                    'income_stmt': ticker.income_stmt.to_dict() if hasattr(ticker, 'income_stmt') and ticker.income_stmt is not None else {},
                    'balance_sheet': ticker.balance_sheet.to_dict() if hasattr(ticker, 'balance_sheet') and ticker.balance_sheet is not None else {},
                    'cashflow': ticker.cashflow.to_dict() if hasattr(ticker, 'cashflow') and ticker.cashflow is not None else {}
                }
                
                all_data = {
                    'price_history': hist,
                    'price_history_metadata': {
                        'data_source': 'yfinance',
                        'fetched_at': datetime.now().isoformat(),
                        'rows': len(hist)
                    },
                    'company_info': info,
                    'financials': financials,
                    'recommendations': recommendations,
                    'news': news
                }
                
                # Cache the data
                cache_path = DATA_CACHE_DIR / f"{symbol}_all_data.json"
                self._save_to_cache(all_data, cache_path)
                
                return all_data
            else:
                logger.warning(f"Insufficient data from yfinance for {symbol}. Will try to load from cache if available.")
        except Exception as e:
            logger.warning(f"yfinance failed for {symbol}: {e}. Will try to load from cache if available.")
        
        # If yfinance fails, try to load from cache
        cache_path = DATA_CACHE_DIR / f"{symbol}_all_data.json"
        if cache_path.exists():
            logger.info(f"Loading cached data for {symbol}")
            return self._load_from_cache(cache_path)
        
        logger.error(f"Could not fetch data for {symbol} from any source and no cache available.")
        return None
    
    def load_all_data(self, symbol: str) -> Dict[str, Any]:
        """
        Load previously cached data for a symbol
        """
        cache_path = DATA_CACHE_DIR / f"{symbol}_all_data.json"
        if cache_path.exists():
            return self._load_from_cache(cache_path)
        return None
    
    def _save_to_cache(self, data: Dict[str, Any], cache_path: Path):
        """
        Save data to cache in JSON format using atomic write to prevent corruption
        """
        import tempfile
        import os
        
        # Convert DataFrame to dict for JSON serialization
        serializable_data = {}
        for key, value in data.items():
            if isinstance(value, pd.DataFrame):
                # Reset index to avoid Timestamp keys in JSON, then convert to dict with orient='list'
                df_reset = value.reset_index()
                # Convert all datetime columns to string for JSON serialization
                for col in df_reset.columns:
                    if pd.api.types.is_datetime64_any_dtype(df_reset[col]):
                        df_reset[col] = df_reset[col].astype(str)
                serializable_data[key] = df_reset.to_dict(orient='list')
            elif isinstance(value, pd.Series):
                # Reset index and convert Series to list
                serializable_data[key] = value.reset_index(drop=True).tolist()
            else:
                serializable_data[key] = value
        
        # Use atomic write: write to temp file then rename
        # This prevents corrupted files if the process is interrupted
        try:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            temp_fd, temp_path = tempfile.mkstemp(dir=cache_path.parent, suffix='.tmp')
            try:
                with os.fdopen(temp_fd, 'w') as f:
                    json.dump(serializable_data, f, default=str, indent=2)
                # Atomic rename (on same filesystem)
                os.replace(temp_path, cache_path)
                logger.info(f"Successfully saved cache to {cache_path}")
            except Exception as e:
                # Clean up temp file on error
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise e
        except Exception as e:
            logger.error(f"Failed to save cache to {cache_path}: {e}")
    
    def _load_from_cache(self, cache_path: Path) -> Dict[str, Any]:
        """
        Load data from cache and convert back to DataFrame where needed
        """
        with open(cache_path, 'r') as f:
            data = json.load(f)
        
        # Convert dict back to DataFrame where needed
        if 'price_history' in data and isinstance(data['price_history'], dict):
            # Handle new format with orient='list'
            if 'Date' in data['price_history']:
                # Old index-based format
                df = pd.DataFrame(data['price_history'])
                df.index = pd.to_datetime(df.index)
                df.index.name = 'Date'
            else:
                # New format with orient='list' - Date is a column
                df = pd.DataFrame(data['price_history'])
                if 'Date' in df.columns:
                    df['Date'] = pd.to_datetime(df['Date'])
                    df.set_index('Date', inplace=True)
                    df.index.name = 'Date'
            data['price_history'] = df
        
        return data
