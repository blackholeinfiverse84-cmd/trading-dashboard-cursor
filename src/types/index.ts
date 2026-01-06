// Prediction Item Type Definition
export interface PredictionItem {
  symbol: string;
  action: 'LONG' | 'SHORT' | 'HOLD' | string;
  confidence: number;
  predicted_return: number;
  predicted_price?: number;
  current_price?: number;
  horizon?: string;
  reason?: string;
  risk_analysis?: {
    volatility?: number;
    max_drawdown?: number;
    sharpe_ratio?: number;
  };
  horizon_details?: Record<string, unknown>;
  has_overfitting_risk?: boolean;
  data_quality?: string;
  timestamp?: string;
  score?: number;
  error?: string;
  individual_predictions?: Record<string, unknown>;
  isUserAdded?: boolean;  // For tracking user-added trades
  // Optional properties for ensemble models
  ensemble_details?: Record<string, unknown>;
  risk_profile?: string;
  model_version?: string;
  warnings?: string[];
}

// Analyze Response Type Definition
export interface AnalyzeResponse {
  symbol: string;
  predictions: PredictionItem[];
  metadata?: {
    consensus?: string;
    average_confidence?: number;
    horizons?: string[];
    [key: string]: unknown;
  };
  error?: string;
}