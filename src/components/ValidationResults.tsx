import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertTriangle, XCircle, Info, TrendingUp, FileText } from "lucide-react";
import type { EnhancedExtractionResult } from "../lib/LLMExtractionService";

interface ValidationResultsProps {
  results: EnhancedExtractionResult[];
  className?: string;
}

export const ValidationResults: React.FC<ValidationResultsProps> = ({ results, className }) => {
  // Calculate overall statistics
  const totalDocuments = results.length;
  const successfulExtractions = results.filter(r => r.success).length;
  const averageQuality = results.reduce((sum, r) => sum + (r.documentQuality?.score || 0), 0) / totalDocuments;
  const averageCompliance = results.reduce((sum, r) => sum + (r.businessRuleValidation?.overallCompliance || 0), 0) / totalDocuments;
  
  const allCriticalIssues = results.flatMap(r => r.businessRuleValidation?.criticalIssues || []);
  const allWarnings = results.flatMap(r => r.businessRuleValidation?.warnings || []);

  const getStatusIcon = (success: boolean, quality?: number) => {
    if (!success) return <XCircle className="w-4 h-4 text-red-500" />;
    if ((quality || 0) >= 0.8) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if ((quality || 0) >= 0.6) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getComplianceColor = (score: number) => {
    if (score >= 0.9) return "bg-green-500";
    if (score >= 0.7) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalDocuments}</div>
              <div className="text-sm text-gray-600">Total Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{successfulExtractions}</div>
              <div className="text-sm text-gray-600">Successful Extractions</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getQualityColor(averageQuality)}`}>
                {(averageQuality * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Average Quality</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getQualityColor(averageCompliance)}`}>
                {(averageCompliance * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Rule Compliance</div>
            </div>
          </div>

          {/* Critical Issues Alert */}
          {allCriticalIssues.length > 0 && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>{allCriticalIssues.length} critical issues</strong> found across documents that require immediate attention.
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings Alert */}
          {allWarnings.length > 0 && (
            <Alert className="mt-2 border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>{allWarnings.length} warnings</strong> found that should be reviewed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Individual Document Results */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality Scores</TabsTrigger>
          <TabsTrigger value="business-rules">Business Rules</TabsTrigger>
          <TabsTrigger value="hsn-validation">HSN Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {results.map((result, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getStatusIcon(result.success, result.documentQuality?.score)}
                    Document {index + 1}
                    {result.data?.metadata?.documentType && (
                      <Badge variant="outline" className="ml-2">
                        {result.data.metadata.documentType.replace('_', ' ').toUpperCase()}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    {result.documentQuality && (
                      <Badge variant="secondary" className={getQualityColor(result.documentQuality.score)}>
                        Quality: {(result.documentQuality.score * 100).toFixed(1)}%
                      </Badge>
                    )}
                    {result.businessRuleValidation && (
                      <Badge variant="secondary" className={getQualityColor(result.businessRuleValidation.overallCompliance)}>
                        Compliance: {(result.businessRuleValidation.overallCompliance * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Processing</h4>
                    <div className="text-sm text-gray-600">
                      <div>Time: {result.processingTime.toFixed(2)}s</div>
                      <div>Tokens: {result.inputTokens + result.outputTokens}</div>
                    </div>
                  </div>
                  
                  {result.businessRuleValidation && (
                    <div>
                      <h4 className="font-medium mb-2">Issues</h4>
                      <div className="text-sm">
                        {result.businessRuleValidation.criticalIssues.length > 0 && (
                          <div className="text-red-600">
                            🔴 {result.businessRuleValidation.criticalIssues.length} Critical
                          </div>
                        )}
                        {result.businessRuleValidation.warnings.length > 0 && (
                          <div className="text-yellow-600">
                            🟡 {result.businessRuleValidation.warnings.length} Warnings
                          </div>
                        )}
                        {result.businessRuleValidation.criticalIssues.length === 0 && 
                         result.businessRuleValidation.warnings.length === 0 && (
                          <div className="text-green-600">✅ No Issues</div>
                        )}
                      </div>
                    </div>
                  )}

                  {result.hsnValidation && (
                    <div>
                      <h4 className="font-medium mb-2">HSN Validation</h4>
                      <div className="text-sm">
                        {result.hsnValidation.commercial && (
                          <div className={`${result.hsnValidation.commercial.isValid ? 'text-green-600' : 'text-red-600'}`}>
                            Commercial: {result.hsnValidation.commercial.isValid ? '✅' : '❌'}
                          </div>
                        )}
                        {result.hsnValidation.customs && (
                          <div className={`${result.hsnValidation.customs.isValid ? 'text-green-600' : 'text-red-600'}`}>
                            Customs: {result.hsnValidation.customs.isValid ? '✅' : '❌'}
                          </div>
                        )}
                        {result.hsnValidation.mapping && (
                          <div className={`${result.hsnValidation.mapping.isConsistent ? 'text-green-600' : 'text-yellow-600'}`}>
                            Mapping: {result.hsnValidation.mapping.isConsistent ? '✅' : '⚠️'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Show recommendations if available */}
                {result.documentQuality?.recommendations && result.documentQuality.recommendations.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">📋 Recommendations</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {result.documentQuality.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          {results.map((result, index) => (
            result.documentQuality && (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Document {index + 1} - Quality Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Overall Quality Score</span>
                        <span className={`font-bold ${getQualityColor(result.documentQuality.score)}`}>
                          {(result.documentQuality.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={result.documentQuality.score * 100} 
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(result.documentQuality.factors).map(([factor, score]) => (
                        <div key={factor}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm capitalize">
                              {factor.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-sm font-medium">
                              {(score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={score * 100} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>

        <TabsContent value="business-rules" className="space-y-4">
          {results.map((result, index) => (
            result.businessRuleValidation && (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Document {index + 1} - Business Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Overall Compliance */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Overall Compliance</span>
                        <span className="font-bold">
                          {(result.businessRuleValidation.overallCompliance * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={result.businessRuleValidation.overallCompliance * 100}
                        className={`w-full ${getComplianceColor(result.businessRuleValidation.overallCompliance)}`}
                      />
                    </div>

                    {/* Individual Rules */}
                    <div className="space-y-2">
                      <h5 className="font-medium">Rule Results</h5>
                      {result.businessRuleValidation.results.map((rule, ruleIndex) => (
                        <div key={ruleIndex} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center gap-2">
                            {rule.passed ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">{rule.rule.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </div>
                          <Badge variant={rule.passed ? "default" : rule.severity === "error" ? "destructive" : "secondary"}>
                            {rule.passed ? "Passed" : rule.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Critical Issues */}
                    {result.businessRuleValidation.criticalIssues.length > 0 && (
                      <Alert className="border-red-200 bg-red-50">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription>
                          <strong>Critical Issues:</strong>
                          <ul className="mt-2 space-y-1">
                            {result.businessRuleValidation.criticalIssues.map((issue, i) => (
                              <li key={i} className="text-sm">• {issue}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Warnings */}
                    {result.businessRuleValidation.warnings.length > 0 && (
                      <Alert className="border-yellow-200 bg-yellow-50">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription>
                          <strong>Warnings:</strong>
                          <ul className="mt-2 space-y-1">
                            {result.businessRuleValidation.warnings.map((warning, i) => (
                              <li key={i} className="text-sm">• {warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>

        <TabsContent value="hsn-validation" className="space-y-4">
          {results.map((result, index) => (
            result.hsnValidation && Object.keys(result.hsnValidation).length > 0 && (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Document {index + 1} - HSN Code Validation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Commercial HSN */}
                    {result.hsnValidation.commercial && (
                      <div className="p-3 border rounded">
                        <h5 className="font-medium mb-2">Commercial HSN Code</h5>
                        <div className="flex items-center gap-2 mb-2">
                          {result.hsnValidation.commercial.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-mono">{result.hsnValidation.commercial.standardizedCode}</span>
                          <Badge variant={result.hsnValidation.commercial.isValid ? "default" : "destructive"}>
                            {result.hsnValidation.commercial.codeLevel}
                          </Badge>
                        </div>
                        {result.hsnValidation.commercial.productCategory && (
                          <p className="text-sm text-gray-600">{result.hsnValidation.commercial.productCategory}</p>
                        )}
                      </div>
                    )}

                    {/* Customs HSN */}
                    {result.hsnValidation.customs && (
                      <div className="p-3 border rounded">
                        <h5 className="font-medium mb-2">Customs HSN Code</h5>
                        <div className="flex items-center gap-2 mb-2">
                          {result.hsnValidation.customs.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-mono">{result.hsnValidation.customs.standardizedCode}</span>
                          <Badge variant={result.hsnValidation.customs.isValid ? "default" : "destructive"}>
                            {result.hsnValidation.customs.codeLevel}
                          </Badge>
                        </div>
                        {result.hsnValidation.customs.productCategory && (
                          <p className="text-sm text-gray-600">{result.hsnValidation.customs.productCategory}</p>
                        )}
                      </div>
                    )}

                    {/* HSN Mapping */}
                    {result.hsnValidation.mapping && (
                      <div className="p-3 border rounded">
                        <h5 className="font-medium mb-2">HSN Code Mapping</h5>
                        <div className="flex items-center gap-2 mb-2">
                          {result.hsnValidation.mapping.isConsistent ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                          <Badge variant={result.hsnValidation.mapping.isConsistent ? "default" : "secondary"}>
                            {result.hsnValidation.mapping.discrepancyType.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm">
                            Confidence: {(result.hsnValidation.mapping.mappingConfidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{result.hsnValidation.mapping.explanation}</p>
                        {result.hsnValidation.mapping.recommendations.length > 0 && (
                          <div className="mt-2">
                            <strong className="text-sm">Recommendations:</strong>
                            <ul className="mt-1 space-y-1">
                              {result.hsnValidation.mapping.recommendations.map((rec, i) => (
                                <li key={i} className="text-sm text-gray-600">• {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};