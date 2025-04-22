
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Share2, Printer, Save } from 'lucide-react';
import { ComparisonResult } from '@/lib/types';

interface ExportPanelProps {
  results: ComparisonResult;
}

export function ExportPanel({ results }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = () => {
    // Format the results as text
    const text = `
    DOCUMENT COMPARISON RESULTS

    SUMMARY:
    ${results.summary}

    ANALYSIS:
    ${results.analysis}

    INSIGHTS:
    ${results.insights}

    RECOMMENDATIONS:
    ${results.recommendations}
    `;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    // In a real implementation, this would generate a PDF file
    alert('PDF export would be implemented here in production');
  };

  const handleSaveReport = () => {
    // In a real implementation, this would save the report to a database
    alert('Save report functionality would be implemented here in production');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Export Options</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto" onClick={handleExportPDF}>
            <Download className="h-5 w-5 mb-1" />
            <span className="text-xs">Export PDF</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col items-center p-4 h-auto" 
            onClick={handleCopyToClipboard}
          >
            <Copy className="h-5 w-5 mb-1" />
            <span className="text-xs">{copied ? 'Copied!' : 'Copy Text'}</span>
          </Button>
          
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto">
            <Printer className="h-5 w-5 mb-1" />
            <span className="text-xs">Print Report</span>
          </Button>
          
          <Button variant="outline" className="flex flex-col items-center p-4 h-auto" onClick={handleSaveReport}>
            <Save className="h-5 w-5 mb-1" />
            <span className="text-xs">Save Report</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
