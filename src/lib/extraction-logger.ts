export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ExtractionLogEntry {
  timestamp: string;
  level: LogLevel;
  category: 'extraction' | 'validation' | 'business_rules' | 'cross_document' | 'error';
  message: string;
  metadata?: {
    documentType?: string;
    fileName?: string;
    confidence?: number;
    processingTime?: number;
    validationScore?: number;
    issueCount?: number;
    [key: string]: any;
  };
}

export class ExtractionLogger {
  private logs: ExtractionLogEntry[] = [];
  private maxLogs: number = 1000;

  log(level: LogLevel, category: ExtractionLogEntry['category'], message: string, metadata?: ExtractionLogEntry['metadata']) {
    const entry: ExtractionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata
    };

    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with formatting
    this.formatConsoleOutput(entry);
  }

  private formatConsoleOutput(entry: ExtractionLogEntry) {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const categoryIcon = this.getCategoryIcon(entry.category);
    const levelColor = this.getLevelColor(entry.level);
    
    const baseMessage = `${timestamp} ${categoryIcon} ${entry.message}`;
    
    if (entry.metadata) {
      const metadataStr = Object.entries(entry.metadata)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          if (typeof value === 'number' && key.includes('confidence') || key.includes('score')) {
            return `${key}: ${(value * 100).toFixed(1)}%`;
          }
          if (typeof value === 'number' && key.includes('time')) {
            return `${key}: ${value.toFixed(2)}s`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
      
      console.log(`${levelColor}${baseMessage}${metadataStr ? ` | ${metadataStr}` : ''}\x1b[0m`);
    } else {
      console.log(`${levelColor}${baseMessage}\x1b[0m`);
    }
  }

  private getCategoryIcon(category: ExtractionLogEntry['category']): string {
    const icons = {
      extraction: '📄',
      validation: '✅',
      business_rules: '📋',
      cross_document: '🔗',
      error: '❌'
    };
    return icons[category] || '📝';
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      debug: '\x1b[36m',    // Cyan
      info: '\x1b[32m',     // Green
      warn: '\x1b[33m',     // Yellow
      error: '\x1b[31m'     // Red
    };
    return colors[level] || '';
  }

  info(category: ExtractionLogEntry['category'], message: string, metadata?: ExtractionLogEntry['metadata']) {
    this.log('info', category, message, metadata);
  }

  warn(category: ExtractionLogEntry['category'], message: string, metadata?: ExtractionLogEntry['metadata']) {
    this.log('warn', category, message, metadata);
  }

  error(category: ExtractionLogEntry['category'], message: string, metadata?: ExtractionLogEntry['metadata']) {
    this.log('error', category, message, metadata);
  }

  debug(category: ExtractionLogEntry['category'], message: string, metadata?: ExtractionLogEntry['metadata']) {
    this.log('debug', category, message, metadata);
  }

  // Get logs for specific category or level
  getLogs(filter?: { category?: ExtractionLogEntry['category']; level?: LogLevel; since?: Date }): ExtractionLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter?.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filter.category);
    }

    if (filter?.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter?.since) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filter.since!);
    }

    return filteredLogs;
  }

  // Get summary statistics
  getSummary(since?: Date): {
    totalLogs: number;
    byCategory: Record<ExtractionLogEntry['category'], number>;
    byLevel: Record<LogLevel, number>;
    errorRate: number;
    averageConfidence?: number;
    averageProcessingTime?: number;
  } {
    const relevantLogs = since 
      ? this.logs.filter(log => new Date(log.timestamp) >= since)
      : this.logs;

    const byCategory = relevantLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<ExtractionLogEntry['category'], number>);

    const byLevel = relevantLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    const confidenceValues = relevantLogs
      .map(log => log.metadata?.confidence)
      .filter(conf => typeof conf === 'number') as number[];

    const timeValues = relevantLogs
      .map(log => log.metadata?.processingTime)
      .filter(time => typeof time === 'number') as number[];

    return {
      totalLogs: relevantLogs.length,
      byCategory,
      byLevel,
      errorRate: relevantLogs.length > 0 ? (byLevel.error || 0) / relevantLogs.length : 0,
      averageConfidence: confidenceValues.length > 0 
        ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length 
        : undefined,
      averageProcessingTime: timeValues.length > 0 
        ? timeValues.reduce((sum, time) => sum + time, 0) / timeValues.length 
        : undefined
    };
  }

  // Export logs as JSON
  exportLogs(filter?: { category?: ExtractionLogEntry['category']; level?: LogLevel; since?: Date }): string {
    const logsToExport = filter ? this.getLogs(filter) : this.logs;
    return JSON.stringify(logsToExport, null, 2);
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
  }

  // Performance tracking helpers
  startTimer(operation: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = (performance.now() - startTime) / 1000;
      this.info('extraction', `${operation} completed`, { processingTime: duration });
      return duration;
    };
  }
}