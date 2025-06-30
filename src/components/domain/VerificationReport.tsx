/**
 * VerificationReport Component
 * 
 * A presentation-only component that displays verification reports, insights,
 * and discrepancies between related logistics documents.
 * 
 * Responsibility: Owns UI presentation for verification reports, including visualization
 * of risk assessment, business insights, and document discrepancies.
 * Delegates all business operations to DocumentProcessingContext.
 */

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, 
  Download, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Lightbulb, 
  BarChart2, 
  FileSearch, 
  RefreshCw, 
  Zap, 
  TrendingUp, 
  ShieldAlert, 
  DollarSign, 
  Package, 
  FileCheck
} from 'lucide-react';
import { useDocumentProcessing } from '@/contexts/DocumentProcessingContext';
import { DocumentVerificationReport, BusinessInsight, BusinessRecommendation, DocumentDiscrepancy } from '@/lib/services/document-verification.service';

/**
 * Props for the VerificationReport component
 */
interface VerificationReportProps {
  className?: string;
}

/**
 * VerificationReport Component
 * 
 * A presentation-only component for displaying verification reports.
 */
const VerificationReport: React.FC<VerificationReportProps> = ({ className }) => {
  // Get document processing context
  const {
    state,
    verifyDocuments
  } = useDocumentProcessing();
  
  // Local state for UI interactions
  const [activeTab, setActiveTab] = useState<'summary' | 'discrepancies' | 'insights' | 'recommendations'>('summary');
  const [expandedDiscrepancies, setExpandedDiscrepancies] = useState<string[]>([]);
  
  // Get verification report from state
  const { verificationReport, isVerifying, extractionResults } = state;
  
  // Check if we have extraction results but no verification report
  const hasExtractionResults = extractionResults.filter(r => r.success).length >= 2;
  const hasVerificationReport = verificationReport !== null;
  
  // Toggle discrepancy expansion
  const toggleDiscrepancyExpansion = (fieldName: string) => {
    setExpandedDiscrepancies(prev => 
      prev.includes(fieldName)
        ? prev.filter(item => item !== fieldName)
        : [...prev, fieldName]
    );
  };
  
  // Handle verification button click
  const handleVerifyClick = async () => {
    await verifyDocuments({ detailedAnalysis: true });
  };
  
  // Handle export
  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    // This would be implemented in a real application
    // Here we just show what would happen
    console.log(`Exporting verification report in ${format} format`);
    
    // In a real implementation, this would call a method from the context
    // or a utility function to handle the export
    alert(`Export to ${format.toUpperCase()} would happen here`);
  };
  
  // Render risk assessment badge
  const renderRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    let variant: 'outline' | 'default' | 'secondary' | 'destructive' = 'outline';
    let icon = <AlertCircle className="h-4 w-4 mr-1" />;
    let bgColor = '';
    
    if (risk === 'low') {
      variant = 'outline';
      icon = <CheckCircle className="h-4 w-4 mr-1" />;
      bgColor = 'bg-green-50 text-green-700 border-green-200';
    } else if (risk === 'medium') {
      variant = 'outline';
      icon = <AlertTriangle className="h-4 w-4 mr-1" />;
      bgColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      variant = 'destructive';
      icon = <AlertCircle className="h-4 w-4 mr-1" />;
    }
    
    return (
      <Badge variant={variant} className={`${bgColor} capitalize`}>
        {icon}
        {risk} Risk
      </Badge>
    );
  };
  
  // Render consistency score
  const renderConsistencyScore = (score: number) => {
    let textColor = 'text-red-700';
    
    if (score >= 0.9) {
      textColor = 'text-green-700';
    } else if (score >= 0.7) {
      textColor = 'text-yellow-700';
    }
    
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Consistency Score</span>
          <span className={`text-sm font-bold ${textColor}`}>
            {(score * 100).toFixed(1)}%
          </span>
        </div>
        <Progress 
          value={score * 100} 
          className="h-2"
          indicatorClassName={
            score >= 0.9 
              ? 'bg-green-600' 
              : score >= 0.7 
                ? 'bg-yellow-500' 
                : 'bg-red-600'
          }
        />
      </div>
    );
  };
  
  // Render insight icon based on category
  const renderInsightIcon = (category: 'compliance' | 'operational' | 'financial' | 'customs') => {
    switch (category) {
      case 'compliance':
        return <ShieldAlert className="h-5 w-5 text-blue-600" />;
      case 'operational':
        return <Package className="h-5 w-5 text-purple-600" />;
      case 'financial':
        return <DollarSign className="h-5 w-5 text-green-600" />;
      case 'customs':
        return <FileCheck className="h-5 w-5 text-amber-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };
  
  // Render severity badge
  const renderSeverityBadge = (severity: 'info' | 'warning' | 'critical') => {
    let variant: 'outline' | 'default' | 'secondary' | 'destructive' = 'outline';
    let icon = <Info className="h-3 w-3 mr-1" />;
    let bgColor = '';
    
    if (severity === 'info') {
      variant = 'outline';
      icon = <Info className="h-3 w-3 mr-1" />;
      bgColor = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (severity === 'warning') {
      variant = 'outline';
      icon = <AlertTriangle className="h-3 w-3 mr-1" />;
      bgColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      variant = 'destructive';
      icon = <AlertCircle className="h-3 w-3 mr-1" />;
    }
    
    return (
      <Badge variant={variant} className={`${bgColor} capitalize`}>
        {icon}
        {severity}
      </Badge>
    );
  };
  
  // Render priority badge
  const renderPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    let variant: 'outline' | 'default' | 'secondary' | 'destructive' = 'outline';
    let bgColor = '';
    
    if (priority === 'low') {
      variant = 'outline';
      bgColor = 'bg-green-50 text-green-700 border-green-200';
    } else if (priority === 'medium') {
      variant = 'outline';
      bgColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      variant = 'destructive';
    }
    
    return (
      <Badge variant={variant} className={`${bgColor} capitalize`}>
        {priority} Priority
      </Badge>
    );
  };
  
  // Render category badge
  const renderCategoryBadge = (category: 'compliance' | 'operational' | 'financial' | 'customs') => {
    let bgColor = '';
    
    switch (category) {
      case 'compliance':
        bgColor = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'operational':
        bgColor = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'financial':
        bgColor = 'bg-green-50 text-green-700 border-green-200';
        break;
      case 'customs':
        bgColor = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
    }
    
    return (
      <Badge variant="outline" className={`${bgColor} capitalize`}>
        {category}
      </Badge>
    );
  };
  
  // Render discrepancy category badge
  const renderDiscrepancyCategoryBadge = (category: 'critical' | 'important' | 'minor') => {
    let variant: 'outline' | 'default' | 'secondary' | 'destructive' = 'outline';
    let bgColor = '';
    
    if (category === 'minor') {
      variant = 'outline';
      bgColor = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (category === 'important') {
      variant = 'outline';
      bgColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    } else {
      variant = 'destructive';
    }
    
    return (
      <Badge variant={variant} className={`${bgColor} capitalize`}>
        {category}
      </Badge>
    );
  };
  
  // Render summary section
  const renderSummarySection = (report: DocumentVerificationReport) => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left column - Key metrics */}
          <div className="flex-1 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Shipment Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Shipment ID</div>
                    <div className="text-lg font-semibold">{report.summary.shipmentIdentifier}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Documents</div>
                    <div className="text-lg font-semibold">{report.summary.documentCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Risk Assessment</div>
                    <div>{renderRiskBadge(report.summary.riskAssessment)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Discrepancies</div>
                    <div className="text-lg font-semibold">{report.discrepancies.length}</div>
                  </div>
                </div>
                
                <div>
                  {renderConsistencyScore(report.summary.consistencyScore)}
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Document Types</div>
                  <div className="flex flex-wrap gap-2">
                    {report.summary.documentTypes.map((type, index) => (
                      <Badge key={index} variant="outline" className="capitalize">
                        {type.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" />
                  Analysis Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Critical Issues</div>
                    <div className="text-lg font-semibold">
                      {report.discrepancies.filter(d => d.category === 'critical').length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Important Issues</div>
                    <div className="text-lg font-semibold">
                      {report.discrepancies.filter(d => d.category === 'important').length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Business Insights</div>
                    <div className="text-lg font-semibold">{report.insights.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Recommendations</div>
                    <div className="text-lg font-semibold">{report.recommendations.length}</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Processing Time</div>
                  <div className="text-base font-medium">
                    {(report.metadata.processingTime / 1000).toFixed(2)} seconds
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right column - Expert summary */}
          <div className="flex-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Expert Summary
                </CardTitle>
                <CardDescription>
                  AI-powered analysis of document consistency and risks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-base leading-relaxed whitespace-pre-line">
                    {report.summary.expertSummary}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Key recommendations preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Key Recommendations
            </CardTitle>
            <CardDescription>
              Top actions to address document discrepancies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.recommendations.slice(0, 3).map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {renderPriorityBadge(recommendation.priority)}
                  </div>
                  <div>
                    <div className="font-medium">{recommendation.action}</div>
                    <div className="text-sm text-muted-foreground">{recommendation.reasoning}</div>
                  </div>
                </div>
              ))}
              
              {report.recommendations.length > 3 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setActiveTab('recommendations')}
                >
                  View all {report.recommendations.length} recommendations
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  // Render discrepancies section
  const renderDiscrepanciesSection = (report: DocumentVerificationReport) => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Document Discrepancies ({report.discrepancies.length})
          </h3>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {report.discrepancies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
              <h3 className="text-lg font-medium mb-1">No discrepancies found</h3>
              <p className="text-muted-foreground text-center">
                All documents are consistent with each other.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {report.discrepancies.map((discrepancy, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {discrepancy.fieldName}
                      </CardTitle>
                      <CardDescription>
                        {renderDiscrepancyCategoryBadge(discrepancy.category)}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleDiscrepancyExpansion(discrepancy.fieldName)}
                    >
                      {expandedDiscrepancies.includes(discrepancy.fieldName) ? 'Collapse' : 'Details'}
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <div className="text-sm mb-2">{discrepancy.impact}</div>
                  
                  <div className="mt-2">
                    <div className="text-sm font-medium mb-1">Values in Documents:</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {discrepancy.documents.map((doc, idx) => (
                        <div key={idx} className="flex flex-col p-2 bg-gray-50 rounded-md">
                          <span className="text-xs text-muted-foreground">{doc.documentName}</span>
                          <span className="text-sm font-medium">{doc.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {expandedDiscrepancies.includes(discrepancy.fieldName) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium mb-1">Recommendation:</div>
                      <div className="text-sm">{discrepancy.recommendation}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // Render insights section
  const renderInsightsSection = (report: DocumentVerificationReport) => {
    // Group insights by category
    const insightsByCategory: Record<string, BusinessInsight[]> = {};
    
    report.insights.forEach(insight => {
      if (!insightsByCategory[insight.category]) {
        insightsByCategory[insight.category] = [];
      }
      insightsByCategory[insight.category].push(insight);
    });
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Business Insights ({report.insights.length})
          </h3>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {report.insights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Info className="h-8 w-8 text-blue-500 mb-2" />
              <h3 className="text-lg font-medium mb-1">No insights available</h3>
              <p className="text-muted-foreground text-center">
                Not enough data to generate business insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Accordion type="multiple" defaultValue={Object.keys(insightsByCategory)}>
              {Object.entries(insightsByCategory).map(([category, insights]) => (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      {renderInsightIcon(category as any)}
                      <span className="capitalize">{category} Insights ({insights.length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                      {insights.map((insight, idx) => (
                        <Card key={idx}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base">{insight.title}</CardTitle>
                              {renderSeverityBadge(insight.severity)}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm">{insight.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    );
  };
  
  // Render recommendations section
  const renderRecommendationsSection = (report: DocumentVerificationReport) => {
    // Group recommendations by priority
    const recommendationsByPriority: Record<string, BusinessRecommendation[]> = {
      high: [],
      medium: [],
      low: []
    };
    
    report.recommendations.forEach(recommendation => {
      recommendationsByPriority[recommendation.priority].push(recommendation);
    });
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Recommendations ({report.recommendations.length})
          </h3>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {report.recommendations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
              <h3 className="text-lg font-medium mb-1">No recommendations needed</h3>
              <p className="text-muted-foreground text-center">
                All documents are consistent and compliant.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* High priority recommendations */}
            {recommendationsByPriority.high.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2 bg-red-50">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    High Priority Actions
                  </CardTitle>
                  <CardDescription>
                    These actions require immediate attention
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {recommendationsByPriority.high.map((recommendation, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {renderPriorityBadge(recommendation.priority)}
                        </div>
                        <div>
                          <div className="font-medium">{recommendation.action}</div>
                          <div className="text-sm text-muted-foreground">{recommendation.reasoning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Medium priority recommendations */}
            {recommendationsByPriority.medium.length > 0 && (
              <Card className="border-yellow-200">
                <CardHeader className="pb-2 bg-yellow-50">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    Medium Priority Actions
                  </CardTitle>
                  <CardDescription>
                    These actions should be addressed soon
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {recommendationsByPriority.medium.map((recommendation, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {renderPriorityBadge(recommendation.priority)}
                        </div>
                        <div>
                          <div className="font-medium">{recommendation.action}</div>
                          <div className="text-sm text-muted-foreground">{recommendation.reasoning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Low priority recommendations */}
            {recommendationsByPriority.low.length > 0 && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2 bg-blue-50">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                    <Info className="h-4 w-4" />
                    Low Priority Actions
                  </CardTitle>
                  <CardDescription>
                    These actions can be addressed when convenient
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {recommendationsByPriority.low.map((recommendation, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {renderPriorityBadge(recommendation.priority)}
                        </div>
                        <div>
                          <div className="font-medium">{recommendation.action}</div>
                          <div className="text-sm text-muted-foreground">{recommendation.reasoning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // If no verification report, show empty state or verification button
  if (!hasVerificationReport) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Document Verification
          </CardTitle>
          <CardDescription>
            Compare and verify documents to identify discrepancies and insights
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="bg-muted rounded-full p-3 mb-4">
            <FileSearch className="h-8 w-8 text-muted-foreground" />
          </div>
          
          {hasExtractionResults ? (
            <>
              <h3 className="text-lg font-medium mb-1">Ready for Verification</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                You have {extractionResults.filter(r => r.success).length} documents extracted successfully.
                Verify them to identify discrepancies and insights.
              </p>
              <Button 
                onClick={handleVerifyClick} 
                disabled={isVerifying}
                className="min-w-[200px]"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4 mr-2" />
                    Verify Documents
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium mb-1">No documents to verify</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Upload and extract at least two documents to enable verification.
                Document verification identifies discrepancies and provides business insights.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Document Verification Report
            </CardTitle>
            <CardDescription>
              Shipment ID: {verificationReport.summary.shipmentIdentifier}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {renderRiskBadge(verificationReport.summary.riskAssessment)}
            
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button 
              size="sm" 
              onClick={handleVerifyClick} 
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="discrepancies">
              Discrepancies ({verificationReport.discrepancies.length})
            </TabsTrigger>
            <TabsTrigger value="insights">
              Insights ({verificationReport.insights.length})
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              Recommendations ({verificationReport.recommendations.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="pt-4">
            {renderSummarySection(verificationReport)}
          </TabsContent>
          
          <TabsContent value="discrepancies" className="pt-4">
            {renderDiscrepanciesSection(verificationReport)}
          </TabsContent>
          
          <TabsContent value="insights" className="pt-4">
            {renderInsightsSection(verificationReport)}
          </TabsContent>
          
          <TabsContent value="recommendations" className="pt-4">
            {renderRecommendationsSection(verificationReport)}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Analysis completed on {new Date(verificationReport.metadata.analysisTimestamp).toLocaleString()}
        </div>
        
        <Button variant="outline" size="sm" onClick={handleVerifyClick} disabled={isVerifying}>
          {isVerifying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Update Analysis
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default VerificationReport;
