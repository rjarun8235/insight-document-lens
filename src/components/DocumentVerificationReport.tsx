import * as React from 'react';
import { DocumentVerificationReport } from '../lib/document-verification-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  XCircle,
  Lightbulb,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  FileText,
  Scale,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';

type ReportProps = {
  report: DocumentVerificationReport;
};

// Helper function to get color based on risk/severity
const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical' | 'important' | 'minor' | 'info' | 'warning') => {
  switch (severity) {
    case 'high':
    case 'critical':
      return 'text-red-600 border-red-500 bg-red-50';
    case 'medium':
    case 'important':
    case 'warning':
      return 'text-yellow-600 border-yellow-500 bg-yellow-50';
    case 'low':
    case 'minor':
    case 'info':
      return 'text-blue-600 border-blue-500 bg-blue-50';
    default:
      return 'text-gray-600 border-gray-500 bg-gray-50';
  }
};

const getBadgeVariant = (severity: 'low' | 'medium' | 'high' | 'critical' | 'important' | 'minor') => {
    switch (severity) {
        case 'high':
        case 'critical':
            return 'destructive' as const;
        case 'medium':
        case 'important':
            return 'secondary' as const;
        case 'low':
        case 'minor':
        default:
            return 'outline' as const;
    }
}

const SeverityIcon = ({ severity }: { severity: string }) => {
  switch (severity) {
    case 'critical': return <ShieldAlert className="h-5 w-5 text-red-500" />;
    case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'info': return <Info className="h-5 w-5 text-blue-500" />;
    default: return <Info className="h-5 w-5 text-gray-500" />;
  }
};

const PriorityIcon = ({ priority }: { priority: string }) => {
    switch (priority) {
      case 'high': return <ChevronsUp className="h-5 w-5 text-red-500 flex-shrink-0" />;
      case 'medium': return <ChevronUp className="h-5 w-5 text-yellow-500 flex-shrink-0" />;
      case 'low': return <ChevronDown className="h-5 w-5 text-green-500 flex-shrink-0" />;
      default: return <Info className="h-5 w-5 text-gray-500 flex-shrink-0" />;
    }
  };

const DiscrepancyItem = ({ discrepancy }: { discrepancy: DocumentVerificationReport['discrepancies'][0] }) => (
    <Alert className={`${getSeverityColor(discrepancy.category)}`}>
        <AlertTitle className="flex items-center gap-2 font-bold">
            <SeverityIcon severity={discrepancy.category} />
            {discrepancy.fieldName}
        </AlertTitle>
        <AlertDescription className="pl-7 space-y-2">
            <p><strong>Impact:</strong> {discrepancy.impact}</p>
            <div className="space-y-1">
                <strong>Values:</strong>
                {discrepancy.documents.map((doc, i) => (
                    <div key={i} className="text-xs flex justify-between items-center bg-white/50 p-1 rounded">
                        <span>{doc.documentName}</span>
                        <Badge variant="secondary">{doc.value}</Badge>
                    </div>
                ))}
            </div>
            <p className="font-semibold"><strong>Recommendation:</strong> {discrepancy.recommendation}</p>
        </AlertDescription>
    </Alert>
);

const InsightItem = ({ insight }: { insight: DocumentVerificationReport['insights'][0] }) => (
    <div className={`p-4 rounded-lg border-l-4 ${getSeverityColor(insight.severity)}`}>
        <div className="flex items-start gap-3">
            <SeverityIcon severity={insight.severity} />
            <div>
                <h4 className="font-bold">{insight.title}</h4>
                <p className="text-sm">{insight.description}</p>
            </div>
        </div>
    </div>
);

export function DocumentVerificationReport({ report }: ReportProps) {
  const consistencyPercentage = Math.round(report.summary.consistencyScore * 100);
  const criticalDiscrepancies = report.discrepancies.filter(d => d.category === 'critical');
  const importantDiscrepancies = report.discrepancies.filter(d => d.category === 'important');
  const minorDiscrepancies = report.discrepancies.filter(d => d.category === 'minor');

  return (
    <div className="space-y-8">
      {/* 1. Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileCheck className="h-6 w-6 text-blue-600" />
            Expert Verification Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <AlertTitle className="font-semibold">Expert Analysis</AlertTitle>
            <AlertDescription>{report.summary.expertSummary}</AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="text-center p-4">
              <FileText className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
              <p className="text-2xl font-bold">{report.summary.documentCount}</p>
              <p className="text-sm text-muted-foreground">Documents</p>
            </Card>
            <Card className="text-center p-4">
              <Scale className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
              <p className="text-2xl font-bold">{consistencyPercentage}%</p>
              <p className="text-sm text-muted-foreground">Consistency</p>
            </Card>
            <Card className="text-center p-4">
              <ShieldCheck className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
              <Badge variant={getBadgeVariant(report.summary.riskAssessment)} className="text-lg">{report.summary.riskAssessment.toUpperCase()}</Badge>
              <p className="text-sm text-muted-foreground mt-1">Risk Level</p>
            </Card>
            <Card className="text-center p-4">
              <ClipboardList className="mx-auto h-8 w-8 text-gray-500 mb-2"/>
              <p className="text-2xl font-bold">{report.discrepancies.length}</p>
              <p className="text-sm text-muted-foreground">Discrepancies</p>
            </Card>
          </div>
          <div>
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Overall Consistency</span>
                <span className="text-sm font-bold">{consistencyPercentage}%</span>
            </div>
            <Progress value={consistencyPercentage} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Discrepancies Section */}
      <Card>
        <CardHeader>
          <CardTitle>Discrepancy Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="critical">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="critical">Critical ({criticalDiscrepancies.length})</TabsTrigger>
              <TabsTrigger value="important">Important ({importantDiscrepancies.length})</TabsTrigger>
              <TabsTrigger value="minor">Minor ({minorDiscrepancies.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="critical" className="mt-4 space-y-3">
              {criticalDiscrepancies.length > 0 ? (
                criticalDiscrepancies.map((d, i) => <DiscrepancyItem key={i} discrepancy={d} />)
              ) : (
                <p className="text-center text-muted-foreground py-4">No critical discrepancies found.</p>
              )}
            </TabsContent>
            <TabsContent value="important" className="mt-4 space-y-3">
              {importantDiscrepancies.length > 0 ? (
                importantDiscrepancies.map((d, i) => <DiscrepancyItem key={i} discrepancy={d} />)
              ) : (
                <p className="text-center text-muted-foreground py-4">No important discrepancies found.</p>
              )}
            </TabsContent>
            <TabsContent value="minor" className="mt-4 space-y-3">
              {minorDiscrepancies.length > 0 ? (
                minorDiscrepancies.map((d, i) => <DiscrepancyItem key={i} discrepancy={d} />)
              ) : (
                <p className="text-center text-muted-foreground py-4">No minor discrepancies found.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 3. Insights Section */}
      <Card>
        <CardHeader>
          <CardTitle>Expert Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.insights.map((insight, i) => (
            <InsightItem key={i} insight={insight} />
          ))}
        </CardContent>
      </Card>

      {/* 4. Recommendations Section */}
      <Card>
        <CardHeader>
          <CardTitle>Actionable Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md">
                <PriorityIcon priority={rec.priority} />
                <div>
                  <p className="font-semibold">{rec.action}</p>
                  <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
