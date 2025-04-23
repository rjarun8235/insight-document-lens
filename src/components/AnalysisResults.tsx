
import { ComparisonResult, AnalysisSection } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookText,
  FileText,
  FileType,
  ClipboardCheck,
  ClipboardList,
  Layers,
  Search,
  Download,
} from 'lucide-react';
import { ExportPanel } from './ExportPanel';

interface AnalysisResultsProps {
  results: ComparisonResult;
}

export function AnalysisResults({ results }: AnalysisResultsProps) {
  const sections: (AnalysisSection & { icon: React.ReactNode })[] = [
    { title: 'Summary', content: results.summary, icon: <Layers className="h-4 w-4" /> },
    { title: 'Verification', content: results.verification, icon: <ClipboardCheck className="h-4 w-4" /> },
    { title: 'Validation', content: results.validation, icon: <ClipboardList className="h-4 w-4" /> },
    { title: 'Review', content: results.review, icon: <BookText className="h-4 w-4" /> },
    { title: 'Analysis', content: results.analysis, icon: <Search className="h-4 w-4" /> },
    { title: 'Insights', content: results.insights, icon: <FileText className="h-4 w-4" /> },
    { title: 'Recommendations', content: results.recommendations, icon: <FileType className="h-4 w-4" /> },
    { title: 'Risks', content: results.risks, icon: <FileType className="h-4 w-4" /> },
    { title: 'Issues', content: results.issues, icon: <FileType className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <ExportPanel results={results} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Comparison Results</CardTitle>
              <CardDescription>
                AI-generated analysis and comparison of your documents
              </CardDescription>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              AI Generated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Layers className="h-5 w-5 mr-2" />
              Comparison Tables
            </h3>
            <div className="space-y-6 rounded-md border">
              {results.tables.map((table, tableIndex) => (
                <div key={tableIndex} className={tableIndex > 0 ? "border-t pt-6" : ""}>
                  <div className="px-4 py-2">
                    <h4 className="text-base font-medium">{table.title}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {table.headers.map((header, index) => (
                            <TableHead key={index} className={index === 0 ? "font-medium" : ""}>
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex} className={rowIndex % 2 === 0 ? "bg-muted/20" : ""}>
                            {row.map((cell, cellIndex) => (
                              <TableCell
                                key={cellIndex}
                                className={cellIndex === 0 ? "font-medium" : ""}
                              >
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Analysis Sections
            </h3>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap">
                {sections.map((section) => (
                  <TabsTrigger
                    key={section.title.toLowerCase()}
                    value={section.title.toLowerCase()}
                    className="flex items-center"
                  >
                    <span className="mr-1.5">{section.icon}</span>
                    {section.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {sections.map((section) => (
                <TabsContent key={section.title.toLowerCase()} value={section.title.toLowerCase()}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center">
                        <div className="mr-2">
                          {section.icon}
                        </div>
                        <div>
                          <CardTitle>{section.title}</CardTitle>
                          <CardDescription>
                            {section.title === 'Summary'
                              ? 'High-level overview of the document comparison'
                              : `Detailed ${section.title.toLowerCase()} of the compared documents`
                            }
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose max-w-none">
                        {section.content.includes('Quotes:') ? (
                          <div>
                            {section.content.split('\n\n').map((part, index) => {
                              if (part.startsWith('Quotes:')) {
                                return (
                                  <div key={`quotes-${index}`} className="mb-4">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Document References</h4>
                                    <div className="bg-muted/30 p-3 rounded-md text-sm">
                                      {part.replace('Quotes:', '').split('\n').map((quote, i) => (
                                        <p key={`quote-${i}`} className="mb-1">{quote}</p>
                                      ))}
                                    </div>
                                  </div>
                                );
                              } else if (part.startsWith('Analysis:')) {
                                return (
                                  <div key={`analysis-${index}`}>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Analysis</h4>
                                    <div>
                                      {part.replace('Analysis:', '').split('\n').map((line, i) => (
                                        <p key={`line-${i}`} className="mb-2">{line}</p>
                                      ))}
                                    </div>
                                  </div>
                                );
                              } else {
                                return <p key={`part-${index}`} className="leading-relaxed">{part}</p>;
                              }
                            })}
                          </div>
                        ) : (
                          <p className="leading-relaxed">{section.content}</p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end border-t pt-4">
                      <Button variant="ghost" size="sm">
                        Export as PDF
                      </Button>
                      <Button variant="ghost" size="sm">
                        Copy to Clipboard
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
