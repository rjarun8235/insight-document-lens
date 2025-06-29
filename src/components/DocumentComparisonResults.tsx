import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { CheckCircle, XCircle, AlertTriangle, Info, Download } from 'lucide-react';
import { Button } from './ui/button';
import { DocumentComparisonReport, FieldComparison } from '../lib/document-field-comparator';

interface DocumentComparisonResultsProps {
  comparisonReport: DocumentComparisonReport;
  onExportReport?: (format: 'text' | 'html' | 'json') => void;
}

export function DocumentComparisonResults({ 
  comparisonReport, 
  onExportReport 
}: DocumentComparisonResultsProps) {
  const { summary, fieldComparisons, criticalIssues, recommendations } = comparisonReport;
  
  const consistencyPercentage = Math.round(summary.overallConsistencyScore * 100);
  
  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive' as const;
      case 'medium': return 'secondary' as const;
      case 'low': return 'default' as const;
      default: return 'secondary' as const;
    }
  };

  const getFieldIcon = (comparison: FieldComparison) => {
    if (comparison.isConsistent) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return comparison.category === 'critical' ? 
      <XCircle className="h-4 w-4 text-red-600" /> : 
      <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  const getFieldBadgeVariant = (category: string) => {
    switch (category) {
      case 'critical': return 'destructive' as const;
      case 'important': return 'secondary' as const;
      case 'minor': return 'outline' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Document Comparison Report
            <div className="flex gap-2">
              {onExportReport && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportReport('text')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Text
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportReport('html')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    HTML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportReport('json')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.totalDocuments}</div>
              <div className="text-sm text-gray-600">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{consistencyPercentage}%</div>
              <div className="text-sm text-gray-600">Consistency</div>
            </div>
            <div className="text-center">
              <Badge variant={getRiskBadgeVariant(summary.riskLevel)}>
                {summary.riskLevel.toUpperCase()}
              </Badge>
              <div className="text-sm text-gray-600 mt-1">Risk Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{summary.totalFieldsCompared}</div>
              <div className="text-sm text-gray-600">Fields Compared</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Consistency</span>
              <span>{consistencyPercentage}%</span>
            </div>
            <Progress value={consistencyPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{summary.consistentFields} consistent</span>
              <span>{summary.discrepantFields} discrepant</span>
              <span>{summary.missingFields} missing</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Documents compared:</p>
            <div className="flex flex-wrap gap-2">
              {summary.documentsCompared.map((doc, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {doc}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues Alert */}
      {criticalIssues.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalIssues.length} Critical Issues Detected</strong>
            <ul className="mt-2 space-y-1">
              {criticalIssues.slice(0, 3).map((issue, index) => (
                <li key={index} className="text-sm">• {issue.description}</li>
              ))}
              {criticalIssues.length > 3 && (
                <li className="text-sm text-gray-500">
                  ... and {criticalIssues.length - 3} more
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Field Comparison</TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({criticalIssues.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <div className="grid gap-4">
            {fieldComparisons.map((comparison, index) => (
              <Card key={index} className="border-l-4" style={{
                borderLeftColor: comparison.isConsistent ? '#10b981' : 
                  comparison.category === 'critical' ? '#ef4444' : '#f59e0b'
              }}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      {getFieldIcon(comparison)}
                      {comparison.fieldName}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getFieldBadgeVariant(comparison.category)}>
                        {comparison.category}
                      </Badge>
                      <Badge variant={comparison.isConsistent ? "default" : "destructive"}>
                        {comparison.discrepancyType.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Values across documents:</h4>
                      <div className="grid gap-2">
                        {comparison.values.map((value, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-medium text-sm">{value.documentName}</span>
                            <span className="text-sm">
                              {value.formatted || value.value || 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-700">
                        <strong>Analysis:</strong> {comparison.explanation}
                      </p>
                    </div>

                    {comparison.recommendedAction && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Recommended Action:</strong> {comparison.recommendedAction}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {criticalIssues.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="font-medium text-lg mb-2">No Critical Issues</h3>
                  <p className="text-gray-600">All critical fields are consistent across documents.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            criticalIssues.map((issue, index) => (
              <Alert key={index} variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>{issue.description}</strong></p>
                    <p className="text-sm"><strong>Impact:</strong> {issue.impact}</p>
                    <p className="text-sm">
                      <strong>Affected Documents:</strong> {issue.affectedDocuments.join(', ')}
                    </p>
                    <p className="text-sm">
                      <strong>Action Required:</strong> {issue.recommendedAction}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            ))
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{recommendation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}