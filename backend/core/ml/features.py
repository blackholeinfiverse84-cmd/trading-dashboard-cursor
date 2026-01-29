"""
This module handles feature engineering for the stock analysis pipeline.
"""
import logging
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Directory configuration
DATA_DIR = Path("data")
FEATURE_CACHE_DIR = DATA_DIR / "features"

# Create directories if they don't exist
for directory in [FEATURE_CACHE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


class FeatureEngineer:
    """
    Feature engineering class that calculates technical indicators
    """
    def __init__(self):
        # Import pandas_ta if available, otherwise use basic indicators
        try:
            try:
                import pandas_ta as ta
            except ImportError:
                import pandas_ta_classic as ta
            self.ta_available = True
            self.ta = ta
        except ImportError:
            self.ta_available = False
            logger.warning("pandas_ta not available, using basic indicators only")
    
    def calculate_all_features(self, df: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """
        Calculate 50+ technical indicators
        """
        logger.info(f"Calculating features for {symbol} (rows: {len(df)})")
        
        if df is None or df.empty:
            logger.error(f"Empty dataframe for {symbol}, cannot calculate features")
            return pd.DataFrame()
        
        # Make a copy to avoid modifying the original
        features_df = df.copy()
        
        # Ensure we have the required columns
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        for col in required_cols:
            if col not in features_df.columns:
                logger.error(f"Required column {col} missing from data")
                return pd.DataFrame()
        
        # Price-based features
        features_df['daily_return'] = features_df['Close'].pct_change()
        features_df['daily_return_ma_5'] = features_df['daily_return'].rolling(window=5).mean()
        
        # Simple Moving Averages
        for period in [5, 10, 20, 50, 100, 200]:
            features_df[f'SMA_{period}'] = features_df['Close'].rolling(window=period).mean()
            features_df[f'price_to_sma_{period}'] = features_df['Close'] / features_df[f'SMA_{period}']
        
        # Exponential Moving Averages
        features_df['EMA_12'] = features_df['Close'].ewm(span=12).mean()
        features_df['EMA_26'] = features_df['Close'].ewm(span=26).mean()
        
        # Volatility indicators
        features_df['STD_20'] = features_df['Close'].rolling(window=20).std()
        features_df['volatility_20'] = features_df['daily_return'].rolling(window=20).std() * np.sqrt(252)  # Annualized
        
        # Bollinger Bands
        bb_middle = features_df['Close'].rolling(window=20).mean()
        bb_std = features_df['Close'].rolling(window=20).std()
        features_df['BB_middle'] = bb_middle
        features_df['BB_upper'] = bb_middle + (bb_std * 2)
        features_df['BB_lower'] = bb_middle - (bb_std * 2)
        features_df['BB_width'] = features_df['BB_upper'] - features_df['BB_lower']
        features_df['BB_pct'] = (features_df['Close'] - features_df['BB_lower']) / (features_df['BB_upper'] - features_df['BB_lower'])
        
        # RSI (Relative Strength Index)
        delta = features_df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        features_df['RSI_14'] = 100 - (100 / (1 + rs))
        
        # MACD
        exp1 = features_df['Close'].ewm(span=12).mean()
        exp2 = features_df['Close'].ewm(span=26).mean()
        features_df['MACD'] = exp1 - exp2
        features_df['MACD_signal'] = features_df['MACD'].ewm(span=9).mean()
        features_df['MACD_hist'] = features_df['MACD'] - features_df['MACD_signal']
        
        # Volume indicators
        features_df['Volume_SMA_20'] = features_df['Volume'].rolling(window=20).mean()
        features_df['volume_ratio'] = features_df['Volume'] / features_df['Volume_SMA_20']
        features_df['OBV'] = self._calculate_obv(features_df)
        
        # High/Low based indicators
        features_df['ATR'] = self._calculate_atr(features_df)
        
        # Simple pattern recognition
        features_df['higher_high'] = (features_df['High'] > features_df['High'].shift(1)).astype(int)
        features_df['lower_low'] = (features_df['Low'] < features_df['Low'].shift(1)).astype(int)
        
        # Price position in range
        features_df['price_position'] = (features_df['Close'] - features_df['Low'].rolling(window=50).min()) / \
                                       (features_df['High'].rolling(window=50).max() - features_df['Low'].rolling(window=50).min())
        
        # Remove rows with NaN values (typically from rolling calculations)
        features_df = features_df.dropna()
        
        logger.info(f"Calculated {len(features_df.columns)} features for {symbol}")
        return features_df
    
    def _calculate_obv(self, df: pd.DataFrame) -> pd.Series:
        """
        Calculate On-Balance Volume
        """
        obv = [0]
        for i in range(1, len(df)):
            if df['Close'].iloc[i] > df['Close'].iloc[i-1]:
                obv.append(obv[-1] + df['Volume'].iloc[i])
            elif df['Close'].iloc[i] < df['Close'].iloc[i-1]:
                obv.append(obv[-1] - df['Volume'].iloc[i])
            else:
                obv.append(obv[-1])
        return pd.Series(obv, index=df.index)
    
    def _calculate_atr(self, df: pd.DataFrame) -> pd.Series:
        """
        Calculate Average True Range
        """
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        true_range = np.maximum(high_low, np.maximum(high_close, low_close))
        return true_range.rolling(window=14).mean()
    
    def save_features(self, features_df: pd.DataFrame, symbol: str):
        """
        Save calculated features to cache
        """
        if features_df is None or features_df.empty:
            logger.error(f"Cannot save empty features for {symbol}")
            return
        
        features_path = FEATURE_CACHE_DIR / f"{symbol}_features.json"
        
        # Convert DataFrame to dict for JSON serialization
        # Reset index to avoid Timestamp keys in JSON
        features_for_json = features_df.reset_index(drop=True)
        features_dict = {
            'features': features_for_json.to_dict(orient='list'),
            'calculated_at': datetime.now().isoformat(),
            'total_features': len(features_df.columns),
            'rows': len(features_df)
        }
        
        with open(features_path, 'w') as f:
            json.dump(features_dict, f, default=str, indent=2)
        
        logger.info(f"Saved {len(features_df.columns)} features for {symbol} to {features_path}")
    
    def load_features(self, symbol: str) -> Dict[str, Any]:
        """
        Load previously calculated features
        """
        features_path = FEATURE_CACHE_DIR / f"{symbol}_features.json"
        if features_path.exists():
            with open(features_path, 'r') as f:
                data = json.load(f)
            return data
        return None
