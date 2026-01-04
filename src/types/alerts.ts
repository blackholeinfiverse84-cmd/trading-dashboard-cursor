// Alert Types
export interface PriceAlert {
  id: string;
  symbol: string;
  type: 'above' | 'below' | 'change';
  targetPrice?: number;
  changePercent?: number;
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  notificationSent: boolean;
}

export interface PredictionAlert {
  id: string;
  symbol: string;
  action: 'LONG' | 'SHORT' | 'HOLD';
  previousAction?: 'LONG' | 'SHORT' | 'HOLD';
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
}

// AppNotification - renamed to avoid conflict with browser Notification API
export interface AppNotification {
  id: string;
  type: 'price' | 'prediction' | 'stop-loss' | 'system';
  title: string;
  message: string;
  symbol?: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export type AlertType = PriceAlert | PredictionAlert;

