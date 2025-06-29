import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  RefreshCw,
  FileText,
  Target
} from 'lucide-react';
import type { EnhancedExtractionResult } from '../lib/LLMExtractionService';
import { ReportExporter } from '../lib/report-exporter';

interface PerformanceDashboardProps {
  results: EnhancedExtractionResult[];
  onRefresh?: () => void;
  className?: string;
}

interface PerformanceMetrics {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  averageQuality: number;
  averageCompliance: number;
  totalIssues: number;
  performanceTrend: Array<{
    time: string;
    quality: number;
    compliance: number;
    processingTime: number;
  }>;
  documentTypeBreakdown: Array<{
    type: string;
    count: number;
    successRate: number;
    avgQuality: number;
  }>;
  issueCategories: Array<{
    category: string;
    count: number;
    severity: 'error' | 'warning' | 'info';
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ 
  results, 
  onRefresh, 
  className 
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('all');

  useEffect(() => {
    calculateMetrics();
  }, [results, timeRange]);

  const calculateMetrics = () => {
    if (results.length === 0) {
      setMetrics(null);
      return;
    }

    // Filter results based on time range
    const now = new Date();
    const cutoffTime = new Date();
    switch (timeRange) {
      case '1h':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case '24h':
        cutoffTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case 'all':
      default:
        cutoffTime.setFullYear(2000); // Include all results
        break;
    }

    const filteredResults = results; // In real app, would filter by timestamp

    // Calculate basic metrics
    const totalProcessed = filteredResults.length;
    const successfulResults = filteredResults.filter(r => r.success);
    const successRate = totalProcessed > 0 ? successfulResults.length / totalProcessed : 0;
    
    const averageProcessingTime = totalProcessed > 0 
      ? filteredResults.reduce((sum, r) => sum + r.processingTime, 0) / totalProcessed 
      : 0;
    
    const averageQuality = totalProcessed > 0 
      ? filteredResults.reduce((sum, r) => sum + (r.documentQuality?.score || 0), 0) / totalProcessed 
      : 0;
    
    const averageCompliance = totalProcessed > 0 
      ? filteredResults.reduce((sum, r) => sum + (r.businessRuleValidation?.overallCompliance || 0), 0) / totalProcessed 
      : 0;

    const allIssues = filteredResults.flatMap(r => [
      ...(r.businessRuleValidation?.criticalIssues || []),
      ...(r.businessRuleValidation?.warnings || [])
    ]);

    // Generate performance trend (simulate time-based data)
    const performanceTrend = filteredResults.map((result, index) => ({
      time: `Doc ${index + 1}`,
      quality: (result.documentQuality?.score || 0) * 100,
      compliance: (result.businessRuleValidation?.overallCompliance || 0) * 100,
      processingTime: result.processingTime
    }));

    // Document type breakdown
    const typeMap = new Map<string, { count: number; successful: number; qualitySum: number }>();
    
    filteredResults.forEach(result => {
      const type = result.data?.metadata?.documentType || 'Unknown';
      const existing = typeMap.get(type) || { count: 0, successful: 0, qualitySum: 0 };
      
      typeMap.set(type, {
        count: existing.count + 1,
        successful: existing.successful + (result.success ? 1 : 0),
        qualitySum: existing.qualitySum + (result.documentQuality?.score || 0)
      });
    });

    const documentTypeBreakdown = Array.from(typeMap.entries()).map(([type, data]) => ({
      type: type.replace('_', ' ').toUpperCase(),
      count: data.count,
      successRate: data.count > 0 ? data.successful / data.count : 0,
      avgQuality: data.count > 0 ? data.qualitySum / data.count : 0
    }));

    // Issue categories
    const issueCategoryMap = new Map<string, { count: number; severity: 'error' | 'warning' | 'info' }>();
    
    filteredResults.forEach(result => {
      result.businessRuleValidation?.results.forEach(rule => {
        if (!rule.passed) {
          const category = rule.rule.replace(/([A-Z])/g, ' $1').trim();
          const existing = issueCategoryMap.get(category);
          
          if (!existing || (rule.severity === 'error' && existing.severity !== 'error')) {
            issueCategoryMap.set(category, {
              count: (existing?.count || 0) + 1,
              severity: rule.severity as 'error' | 'warning' | 'info'
            });
          } else {
            issueCategoryMap.set(category, {
              ...existing,
              count: existing.count + 1
            });
          }
        }
      });
    });

    const issueCategories = Array.from(issueCategoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      severity: data.severity
    }));

    setMetrics({
      totalProcessed,
      successRate,
      averageProcessingTime,
      averageQuality,
      averageCompliance,
      totalIssues: allIssues.length,
      performanceTrend,
      documentTypeBreakdown,
      issueCategories
    });
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    ReportExporter.exportValidationResults(results, format);
  };

  if (!metrics) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No performance data available</p>
          <p className="text-sm text-gray-500">Process some documents to see metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Performance Dashboard
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['1h', '24h', '7d', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="px-3 py-1"
              >
                {range === 'all' ? 'All' : range}
              </Button>
            ))}
          </div>

          {/* Export Buttons */}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="w-4 h-4 mr-1" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
          </div>

          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProcessed}</div>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant={metrics.successRate >= 0.9 ? "default" : "secondary"}>
                {(metrics.successRate * 100).toFixed(1)}% success
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Quality</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.averageQuality, { good: 0.8, warning: 0.6 })}`}>
              {(metrics.averageQuality * 100).toFixed(1)}%
            </div>
            <Progress value={metrics.averageQuality * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rule Compliance</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(metrics.averageCompliance, { good: 0.9, warning: 0.7 })}`}>
              {(metrics.averageCompliance * 100).toFixed(1)}%
            </div>
            <Progress value={metrics.averageCompliance * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(5 - metrics.averageProcessingTime, { good: 3, warning: 1 })}`}>
              {metrics.averageProcessingTime.toFixed(2)}s
            </div>
            <div className="flex items-center gap-1 mt-1">
              {metrics.totalIssues > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {metrics.totalIssues} issues
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analysis */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="document-types">Document Types</TabsTrigger>
          <TabsTrigger value="issues">Issue Analysis</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality & Compliance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        name === 'processingTime' ? `${value}s` : `${value}%`,
                        name === 'processingTime' ? 'Processing Time' : 
                        name === 'quality' ? 'Quality Score' : 'Compliance Score'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="quality" 
                      stroke="#0088FE" 
                      strokeWidth={2}
                      name="quality"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="compliance" 
                      stroke="#00C49F" 
                      strokeWidth={2}
                      name="compliance"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Processing Time Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.performanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`${value}s`, 'Processing Time']} />
                    <Bar dataKey="processingTime" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="document-types" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.documentTypeBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, count }) => `${type} (${count})`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {metrics.documentTypeBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Rate by Document Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.documentTypeBreakdown} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="type" type="category" width={100} />
                      <Tooltip formatter={(value: any) => [`${value}%`, 'Success Rate']} />
                      <Bar dataKey="successRate" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Type Performance Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.documentTypeBreakdown.map((typeData, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <div className="font-medium">{typeData.type}</div>
                        <div className="text-sm text-gray-600">{typeData.count} documents</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{(typeData.successRate * 100).toFixed(1)}%</div>
                        <div className="text-gray-600">Success Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{(typeData.avgQuality * 100).toFixed(1)}%</div>
                        <div className="text-gray-600">Avg Quality</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issue Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.issueCategories.map((issue, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        issue.severity === 'error' ? 'bg-red-500' :
                        issue.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className="font-medium">{issue.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        issue.severity === 'error' ? 'destructive' :
                        issue.severity === 'warning' ? 'secondary' : 'default'
                      }>
                        {issue.count} occurrences
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {metrics.issueCategories.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>No validation issues found!</p>
                    <p className="text-sm">All documents passed business rule validation.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {metrics.averageQuality >= 0.9 && (
                    <div className="flex items-start gap-2 text-green-700">
                      <CheckCircle className="w-4 h-4 mt-0.5" />
                      <span>Excellent quality scores across all documents</span>
                    </div>
                  )}
                  
                  {metrics.averageCompliance < 0.8 && (
                    <div className="flex items-start gap-2 text-yellow-700">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <span>Business rule compliance could be improved</span>
                    </div>
                  )}
                  
                  {metrics.averageProcessingTime > 5 && (
                    <div className="flex items-start gap-2 text-yellow-700">
                      <Clock className="w-4 h-4 mt-0.5" />
                      <span>Processing times are higher than optimal</span>
                    </div>
                  )}
                  
                  {metrics.totalIssues === 0 && (
                    <div className="flex items-start gap-2 text-green-700">
                      <CheckCircle className="w-4 h-4 mt-0.5" />
                      <span>No validation issues detected</span>
                    </div>
                  )}
                  
                  {metrics.documentTypeBreakdown.length > 1 && (
                    <div className="flex items-start gap-2 text-blue-700">
                      <TrendingUp className="w-4 h-4 mt-0.5" />
                      <span>Processing multiple document types successfully</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {metrics.totalIssues > 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <strong>Review validation issues</strong>
                      <p className="mt-1">Address the {metrics.totalIssues} validation issues to improve compliance scores.</p>
                    </div>
                  )}
                  
                  {metrics.averageProcessingTime > 3 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <strong>Optimize processing speed</strong>
                      <p className="mt-1">Consider document preprocessing or API optimization to reduce processing time.</p>
                    </div>
                  )}
                  
                  {metrics.averageQuality < 0.8 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <strong>Improve document quality</strong>
                      <p className="mt-1">Review document preprocessing and validation rules to improve extraction quality.</p>
                    </div>
                  )}
                  
                  {metrics.averageQuality >= 0.9 && metrics.averageCompliance >= 0.9 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <strong>Excellent performance!</strong>
                      <p className="mt-1">System is performing optimally. Consider expanding to new document types.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};