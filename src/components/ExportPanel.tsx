
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Printer, Save } from 'lucide-react';
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

  // Helper function to render a button with icon and text
  const ExportButton = ({
    icon,
    label,
    onClick
  }: {
    icon: any,
    label: string,
    onClick?: () => void
  }) => (
    <button
      type="button"
      className="flex flex-col items-center p-4 h-auto border rounded-md hover:bg-muted transition-colors"
      onClick={onClick}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Export Options</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ExportButton
            icon={<Download className="h-5 w-5" />}
            label="Export PDF"
            onClick={handleExportPDF}
          />

          <ExportButton
            icon={<Copy className="h-5 w-5" />}
            label={copied ? 'Copied!' : 'Copy Text'}
            onClick={handleCopyToClipboard}
          />

          <ExportButton
            icon={<Printer className="h-5 w-5" />}
            label="Print Report"
          />

          <ExportButton
            icon={<Save className="h-5 w-5" />}
            label="Save Report"
            onClick={handleSaveReport}
          />
        </div>
      </CardContent>
    </Card>
  );
}
