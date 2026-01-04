/**
 * Export utilities for exporting data to CSV, JSON, and PDF formats
 */

export interface ExportableData {
  [key: string]: any;
}

/**
 * Export data to CSV format
 */
export const exportToCSV = (data: any[], filename: string = 'export.csv'): void => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas or quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Export data to JSON format
 */
export const exportToJSON = (data: any, filename: string = 'export.json'): void => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Export portfolio to CSV
 */
export const exportPortfolio = (holdings: any[]): void => {
  const data = holdings.map(holding => ({
    Symbol: holding.symbol,
    Shares: holding.shares,
    'Avg Price': holding.avgPrice?.toFixed(2) || '0.00',
    'Current Price': holding.currentPrice?.toFixed(2) || '0.00',
    Value: holding.value?.toFixed(2) || '0.00',
    'Gain/Loss': ((holding.currentPrice - holding.avgPrice) * holding.shares).toFixed(2),
    'Gain/Loss %': (((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100).toFixed(2) + '%',
  }));
  exportToCSV(data, `portfolio-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Export predictions to CSV
 */
export const exportPredictions = (predictions: any[]): void => {
  const data = predictions.map(pred => ({
    Symbol: pred.symbol,
    Action: pred.action,
    'Current Price': pred.current_price?.toFixed(2) || '0.00',
    'Predicted Price': pred.predicted_price?.toFixed(2) || '0.00',
    'Predicted Return %': (pred.predicted_return || 0).toFixed(2) + '%',
    Confidence: ((pred.confidence || 0) * 100).toFixed(0) + '%',
    Horizon: pred.horizon || 'N/A',
  }));
  exportToCSV(data, `predictions-${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Format number as currency
 */
export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value);
};

/**
 * Format number with commas
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

