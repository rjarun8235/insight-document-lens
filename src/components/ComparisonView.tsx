import React, { useState, ReactNode } from 'react';
import { ComparisonResult, ComparisonTable } from '@/lib/types';
import { Button } from '@/components/ui/custom-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ComparisonViewProps {
  result: ComparisonResult;
  documentNames: string[];
}

// Component to highlight differences between text
const TextDiff = ({ original, modified }: { original: string; modified: string }) => {
  // Simple diff implementation that highlights differences
  if (!original || !modified) return null;
  
  // Split into words for comparison
  const originalWords = original.split(/\s+/);
  const modifiedWords = modified.split(/\s+/);
  
  // Find common prefix and suffix
  let prefixLength = 0;
  while (
    prefixLength < originalWords.length && 
    prefixLength < modifiedWords.length && 
    originalWords[prefixLength] === modifiedWords[prefixLength]
  ) {
    prefixLength++;
  }
  
  let suffixLength = 0;
  while (
    suffixLength < originalWords.length - prefixLength && 
    suffixLength < modifiedWords.length - prefixLength && 
    originalWords[originalWords.length - 1 - suffixLength] === 
    modifiedWords[modifiedWords.length - 1 - suffixLength]
  ) {
    suffixLength++;
  }
  
  // Extract the different parts
  const originalDiff = originalWords.slice(prefixLength, originalWords.length - suffixLength);
  const modifiedDiff = modifiedWords.slice(prefixLength, modifiedWords.length - suffixLength);
  
  // Render with highlighting
  return (
    <div className="text-diff">
      <div className="prefix">
        {originalWords.slice(0, prefixLength).join(' ')}
      </div>
      {originalDiff.length > 0 && (
        <div className="diff bg-red-100 px-1 rounded">
          {originalDiff.join(' ')}
        </div>
      )}
      {modifiedDiff.length > 0 && (
        <div className="diff bg-green-100 px-1 rounded">
          {modifiedDiff.join(' ')}
        </div>
      )}
      <div className="suffix">
        {originalWords.slice(originalWords.length - suffixLength).join(' ')}
      </div>
    </div>
  );
};

// Create simple wrapper components for shadcn/ui Tabs
const CustomTabs = ({ value, onValueChange, className, children }: {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

const CustomTabsList = ({ className, children }: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

const CustomTabsTrigger = ({ value, children }: {
  value: string;
  children: ReactNode;
}) => {
  return (
    <button className={`px-4 py-2 ${value}`}>
      {children}
    </button>
  );
};

const CustomTabsContent = ({ value, className, children }: {
  value: string;
  className?: string;
  children: ReactNode;
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export const ComparisonView = ({ result, documentNames }: ComparisonViewProps) => {
  const [activeTab, setActiveTab] = useState<string>('tables');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  // Toggle section expansion
  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };
  
  // Format section content with proper spacing and line breaks
  const formatSectionContent = (content: string) => {
    if (!content) return 'No content available';
    
    // Replace line breaks with proper HTML breaks
    return content.split('\n').map((line, i) => (
      <div key={i} className="line">
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </div>
    ));
  };
  
  // Extract document values from a table row
  const getDocumentValues = (row: string[]) => {
    if (row.length < 3) return { field: row[0] || '', doc1: '', doc2: '' };
    return {
      field: row[0] || '',
      doc1: row[1] || '',
      doc2: row[2] || ''
    };
  };
  
  return (
    <div className="comparison-view space-y-6">
      <div className="w-full">
        <div className="grid w-full grid-cols-3">
          <button 
            className={`px-4 py-2 ${activeTab === 'tables' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => setActiveTab('tables')}
          >
            Comparison Tables
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'sideBySide' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => setActiveTab('sideBySide')}
          >
            Side by Side
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'analysis' ? 'bg-primary text-white' : 'bg-gray-100'}`}
            onClick={() => setActiveTab('analysis')}
          >
            Analysis
          </button>
        </div>
        
        {/* Tables View */}
        {activeTab === 'tables' && (
          <div className="space-y-4 mt-4">
            {result.tables.map((table, tableIndex) => (
              <div key={tableIndex} className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b">
                  {table.title || `Table ${tableIndex + 1}`}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        {table.headers.map((header, i) => (
                          <th key={i} className="p-2 text-left font-medium text-sm">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="p-2 text-sm border-t">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Side by Side View */}
        {activeTab === 'sideBySide' && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document 1 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b">
                  {documentNames[0] || 'Document 1'}
                </div>
                <div className="p-4 space-y-3">
                  {result.tables.map((table, tableIndex) => (
                    <div key={tableIndex} className="space-y-2">
                      <h3 className="font-medium text-sm">{table.title || `Table ${tableIndex + 1}`}</h3>
                      <div className="space-y-1">
                        {table.rows.map((row, rowIndex) => {
                          const { field, doc1 } = getDocumentValues(row);
                          return (
                            <div key={rowIndex} className="text-sm">
                              <span className="font-medium">{field}:</span> {doc1}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Document 2 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b">
                  {documentNames[1] || 'Document 2'}
                </div>
                <div className="p-4 space-y-3">
                  {result.tables.map((table, tableIndex) => (
                    <div key={tableIndex} className="space-y-2">
                      <h3 className="font-medium text-sm">{table.title || `Table ${tableIndex + 1}`}</h3>
                      <div className="space-y-1">
                        {table.rows.map((row, rowIndex) => {
                          const { field, doc2 } = getDocumentValues(row);
                          return (
                            <div key={rowIndex} className="text-sm">
                              <span className="font-medium">{field}:</span> {doc2}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Differences Highlighted */}
            <div className="border rounded-lg overflow-hidden mt-6">
              <div className="bg-muted p-3 font-medium border-b">
                Differences Highlighted
              </div>
              <div className="p-4 space-y-3">
                {result.tables.map((table, tableIndex) => (
                  <div key={tableIndex} className="space-y-2">
                    <h3 className="font-medium">{table.title || `Table ${tableIndex + 1}`}</h3>
                    <div className="space-y-2">
                      {table.rows.map((row, rowIndex) => {
                        const { field, doc1, doc2 } = getDocumentValues(row);
                        const isDifferent = doc1 !== doc2;
                        
                        return (
                          <div key={rowIndex} className={`p-2 rounded text-sm ${isDifferent ? 'bg-amber-50' : ''}`}>
                            <div className="font-medium">{field}</div>
                            {isDifferent ? (
                              <div>
                                <TextDiff original={doc1} modified={doc2} />
                              </div>
                            ) : (
                              <div className="text-gray-500">No differences</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Analysis View */}
        {activeTab === 'analysis' && (
          <div className="space-y-4 mt-4">
            {[
              { key: 'verification', title: 'Verification' },
              { key: 'validation', title: 'Validation' },
              { key: 'review', title: 'Review' },
              { key: 'analysis', title: 'Analysis' },
              { key: 'summary', title: 'Summary' },
              { key: 'insights', title: 'Insights' },
              { key: 'recommendations', title: 'Recommendations' },
              { key: 'risks', title: 'Risks' },
              { key: 'issues', title: 'Issues' }
            ].map(section => (
              <div key={section.key} className="border rounded-lg overflow-hidden">
                <div 
                  className="bg-muted p-3 font-medium border-b flex justify-between items-center cursor-pointer"
                  onClick={() => toggleSection(section.key)}
                >
                  <h3>{section.title}</h3>
                  <Button variant="ghost" size="sm">
                    {expandedSection === section.key ? '−' : '+'}
                  </Button>
                </div>
                {(expandedSection === section.key || expandedSection === null) && (
                  <div className="p-4 prose prose-sm max-w-none">
                    {formatSectionContent(result[section.key as keyof ComparisonResult] as string)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Export buttons */}
      <div className="flex justify-end space-x-2">
        <Button 
          variant="outline" 
          onClick={() => {
            // Create a text version of the results
            const content = `
              # Document Comparison Results
              
              ${result.tables.map(table => `
                ## ${table.title || 'Comparison Table'}
                ${table.headers.join(' | ')}
                ${'-'.repeat(table.headers.join(' | ').length)}
                ${table.rows.map(row => row.join(' | ')).join('\n')}
              `).join('\n\n')}
              
              ## Analysis Sections
              
              ${Object.entries(result)
                .filter(([key]) => key !== 'tables')
                .map(([key, value]) => `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n${value}`)
                .join('\n\n')}
            `;
            
            // Create and download text file
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document-comparison.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          Export as Text
        </Button>
        
        <Button
          variant="default"
          onClick={() => {
            // Create HTML content for PDF export
            const content = `
              <html>
                <head>
                  <title>Document Comparison</title>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    h1, h2, h3 { color: #333; }
                    .section { margin-bottom: 20px; }
                  </style>
                </head>
                <body>
                  <h1>Document Comparison Results</h1>
                  
                  ${result.tables.map(table => `
                    <h2>${table.title || 'Comparison Table'}</h2>
                    <table>
                      <thead>
                        <tr>
                          ${table.headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                      </thead>
                      <tbody>
                        ${table.rows.map(row => `
                          <tr>
                            ${row.map(cell => `<td>${cell}</td>`).join('')}
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  `).join('')}
                  
                  <h2>Analysis Sections</h2>
                  
                  ${Object.entries(result)
                    .filter(([key]) => key !== 'tables')
                    .map(([key, value]) => `
                      <div class="section">
                        <h3>${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                        <div>${(value as string).replace(/\n/g, '<br>')}</div>
                      </div>
                    `).join('')}
                </body>
              </html>
            `;
            
            // Create and download HTML file (can be opened in browser and printed to PDF)
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document-comparison.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          Export as HTML
        </Button>
      </div>
    </div>
  );
};
