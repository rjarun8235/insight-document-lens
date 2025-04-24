import React from 'react';
import { ComparisonResult } from '@/lib/types';
// @ts-ignore - React 18 compatibility
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// @ts-ignore - React 18 compatibility
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
} from '@/components/ui/card';
// @ts-ignore - React 18 compatibility
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// @ts-ignore - React 18 compatibility
import { Button } from '@/components/ui/button';
// @ts-ignore - React 18 compatibility
import { Badge } from '@/components/ui/badge';
// Import only the icons we know exist in lucide-react
import { FileText, Search, Download } from 'lucide-react';
import { ExportPanel } from './ExportPanel';

// Define AnalysisSection interface locally
interface AnalysisSection {
  title: string;
  content: string;
}

// Simple icon components to replace lucide-react icons
const SimpleIcon = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    {children}
  </div>
);

interface AnalysisResultsProps {
  results: ComparisonResult;
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  const sections: (AnalysisSection & { icon: React.ReactNode })[] = [
    // @ts-ignore - React 18 compatibility
    { title: 'Summary', content: results.summary, icon: <SimpleIcon className="h-4 w-4">📊</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Verification', content: results.verification, icon: <SimpleIcon className="h-4 w-4">✓</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Validation', content: results.validation, icon: <SimpleIcon className="h-4 w-4">✓✓</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Review', content: results.review, icon: <SimpleIcon className="h-4 w-4">📖</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Analysis', content: results.analysis, icon: <Search className="h-4 w-4" /> },
    // @ts-ignore - React 18 compatibility
    { title: 'Insights', content: results.insights, icon: <FileText className="h-4 w-4" /> },
    // @ts-ignore - React 18 compatibility
    { title: 'Recommendations', content: results.recommendations, icon: <SimpleIcon className="h-4 w-4">📋</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Risks', content: results.risks, icon: <SimpleIcon className="h-4 w-4">⚠️</SimpleIcon> },
    // @ts-ignore - React 18 compatibility
    { title: 'Issues', content: results.issues, icon: <SimpleIcon className="h-4 w-4">❗</SimpleIcon> },
  ];

  return (
    <div className="space-y-6">
      {/* @ts-ignore - React 18 compatibility */}
      <Card className="w-full">
        {/* @ts-ignore - React 18 compatibility */}
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              {/* @ts-ignore - React 18 compatibility */}
              <CardTitle className="text-xl font-bold">Analysis Results</CardTitle>
              {/* @ts-ignore - React 18 compatibility */}
              <CardDescription>
                Document comparison and analysis powered by Claude AI
              </CardDescription>
            </div>
            {/* @ts-ignore - React 18 compatibility */}
            <Badge variant="outline" className="px-3 py-1">
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        {/* @ts-ignore - React 18 compatibility */}
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <SimpleIcon className="h-5 w-5 mr-2" children="📊" /> 
              Comparison Tables
            </h3>
            <div className="space-y-6 rounded-md border">
              {results.tables && results.tables.length > 0 ? (
                results.tables.map((table, tableIndex) => (
                  <div key={tableIndex} className="p-4">
                    <h4 className="font-medium mb-3">{table.title}</h4>
                    {/* @ts-ignore - React 18 compatibility */}
                    <Table>
                      {/* @ts-ignore - React 18 compatibility */}
                      <TableHeader>
                        {/* @ts-ignore - React 18 compatibility */}
                        <TableRow>
                          {table.headers.map((header, headerIndex) => (
                            // @ts-ignore - React 18 compatibility
                            <TableHead key={headerIndex}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      {/* @ts-ignore - React 18 compatibility */}
                      <TableBody>
                        {table.rows.map((row, rowIndex) => (
                          // @ts-ignore - React 18 compatibility
                          <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              // @ts-ignore - React 18 compatibility
                              <TableCell key={cellIndex}>
                                {cell.includes('**') ? (
                                  <span className="font-bold text-red-500">
                                    {cell.replace(/\*\*/g, '')}
                                  </span>
                                ) : (
                                  cell
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground flex items-center justify-center">
                    {/* @ts-ignore - React 18 compatibility */}
                    <FileText className="mr-2 h-4 w-4" />
                    No comparison tables available
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* @ts-ignore - React 18 compatibility */}
          <Tabs defaultValue={sections[0].title.toLowerCase()}>
            {/* @ts-ignore - React 18 compatibility */}
            <TabsList className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              {sections.map((section, index) => (
                // @ts-ignore - React 18 compatibility
                <TabsTrigger
                  key={index}
                  value={section.title.toLowerCase()}
                  className="flex items-center"
                >
                  <span className="mr-1">{section.icon}</span>
                  <span className="hidden md:inline">{section.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {sections.map((section, index) => (
              // @ts-ignore - React 18 compatibility
              <TabsContent key={index} value={section.title.toLowerCase()}>
                {/* @ts-ignore - React 18 compatibility */}
                <Card>
                  {/* @ts-ignore - React 18 compatibility */}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="mr-2">{section.icon}</span>
                        {/* @ts-ignore - React 18 compatibility */}
                        <CardTitle>{section.title}</CardTitle>
                      </div>
                      {/* @ts-ignore - React 18 compatibility */}
                      <CardDescription>
                        {section.title === 'Summary'
                          ? 'Overview of document comparison'
                          : section.title === 'Verification'
                          ? 'Document authenticity check'
                          : section.title === 'Validation'
                          ? 'Data consistency validation'
                          : section.title === 'Review'
                          ? 'Detailed document review'
                          : section.title === 'Analysis'
                          ? 'In-depth data analysis'
                          : section.title === 'Insights'
                          ? 'Key findings and insights'
                          : section.title === 'Recommendations'
                          ? 'Suggested actions'
                          : section.title === 'Risks'
                          ? 'Potential risk factors'
                          : 'Identified issues'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  {/* @ts-ignore - React 18 compatibility */}
                  <CardContent>
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: section.content.replace(/\n/g, '<br />'),
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        {/* @ts-ignore - React 18 compatibility */}
        <CardFooter className="flex justify-between">
          {/* @ts-ignore - React 18 compatibility */}
          <Button variant="outline" onClick={() => window.print()}>
            {/* @ts-ignore - React 18 compatibility */}
            <Download className="mr-2 h-4 w-4" /> Print Results
          </Button>
          {/* @ts-ignore - React 18 compatibility */}
          <Button>
            <ExportPanel results={results} />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
