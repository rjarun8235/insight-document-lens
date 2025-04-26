import React, { useState, ReactNode } from 'react';
import { ComparisonResult, ComparisonTable } from '@/lib/types';
import { Button } from '@/components/ui/custom-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ComparisonViewProps {
  result: Partial<ComparisonResult>;
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

export function ComparisonView({ result, documentNames }: ComparisonViewProps) {
  const [activeTab, setActiveTab] = useState('analysis'); // Default to analysis tab
  const [expandedSection, setExpandedSection] = useState<string | null>('analysis'); // Expand analysis by default
  
  // Extract sections from the result
  const sections = [
    { id: 'analysis', title: 'Analysis', content: result.analysis || '' },
    { id: 'summary', title: 'Summary', content: result.summary || '' },
    { id: 'insights', title: 'Insights', content: result.insights || '' },
    { id: 'verification', title: 'Verification', content: result.verification || '' },
    { id: 'validation', title: 'Validation', content: result.validation || '' },
    { id: 'review', title: 'Review', content: result.review || '' },
    { id: 'recommendations', title: 'Recommendations', content: result.recommendations || '' },
    { id: 'risks', title: 'Risks', content: result.risks || '' },
    { id: 'issues', title: 'Issues', content: result.issues || '' }
  ].filter(section => section.content); // Only include sections with content
  
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
    // Handle multi-document tables (more than 2 documents)
    if (row.length > 3) {
      return {
        field: row[0] || '',
        values: row.slice(1) // Get all document values
      };
    }
    
    // Handle traditional 2-document comparison
    if (row.length < 3) return { field: row[0] || '', doc1: '', doc2: '' };
    return {
      field: row[0] || '',
      doc1: row[1] || '',
      doc2: row[2] || ''
    };
  };

  // Check if we have any tables to display
  const hasTables = result.tables && result.tables.length > 0;
  
  // Check if we have any analysis sections to display
  const hasAnalysis = sections.length > 0;
  
  // If no results yet, show a placeholder
  if (!hasTables && !hasAnalysis) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No comparison results available yet. Please process documents to see results.</p>
      </div>
    );
  }
  
  /**
   * Render a comparison table
   */
  const renderTable = (table: ComparisonTable, index: number) => {
    if (!table.headers || !table.rows || table.headers.length === 0 || table.rows.length === 0) {
      return null;
    }

    return (
      <div key={`table-${index}`} className="mb-6 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-2">{table.title || `Comparison Table ${index + 1}`}</h3>
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              {table.headers.map((header, i) => (
                <th 
                  key={`header-${i}`} 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIndex) => (
                  <td 
                    key={`cell-${rowIndex}-${cellIndex}`} 
                    className="px-4 py-3 text-sm text-gray-500 border-r border-gray-300 last:border-r-0 whitespace-pre-wrap"
                  >
                    {cell || 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * Render markdown content
   */
  const renderMarkdown = (content: string) => {
    if (!content) return null;
    
    return (
      <div className="prose prose-sm max-w-none">
        {/* @ts-ignore - Ignoring type issues with ReactMarkdown */}
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({node, ...props}) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300" {...props} />
              </div>
            ),
            thead: ({node, ...props}) => <thead className="bg-gray-50" {...props} />,
            tr: ({node, children, ...props}) => <tr className="border-b border-gray-200" {...props}>{children}</tr>,
            th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 last:border-r-0" {...props} />,
            td: ({node, ...props}) => <td className="px-4 py-3 text-sm text-gray-500 border-r border-gray-300 last:border-r-0" {...props} />,
            code: ({node, inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  language={match[1]}
                  style={vscDarkPlus}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
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
            {result.tables?.map((table, tableIndex) => renderTable(table, tableIndex))}
          </div>
        )}
        
        {/* Side by Side View */}
        {activeTab === 'sideBySide' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {documentNames.length > 0 && result.tables?.length > 0 && (
              <>
                {/* First document column */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted p-3 font-medium border-b">
                    {documentNames[0] || 'Document 1'}
                  </div>
                  <div className="p-4 space-y-2">
                    {result.tables[0].rows.map((row, i) => {
                      const { field, doc1 } = getDocumentValues(row);
                      return (
                        <div key={i} className="py-1">
                          <div className="font-medium text-sm">{field}</div>
                          <div className="text-sm">{doc1}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Second document column */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted p-3 font-medium border-b">
                    {documentNames[1] || 'Document 2'}
                  </div>
                  <div className="p-4 space-y-2">
                    {result.tables[0].rows.map((row, i) => {
                      const { field, doc1, doc2, values } = getDocumentValues(row) as any;
                      return (
                        <div key={i} className="py-1">
                          <div className="font-medium text-sm">{field}</div>
                          <div className="text-sm">{doc2 || (values && values[1]) || ''}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Additional document columns for multi-document comparison */}
                {documentNames.length > 2 && documentNames.slice(2).map((docName, docIndex) => (
                  <div key={docIndex} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted p-3 font-medium border-b">
                      {docName || `Document ${docIndex + 3}`}
                    </div>
                    <div className="p-4 space-y-2">
                      {result.tables[0].rows.map((row, i) => {
                        const { field, values } = getDocumentValues(row) as any;
                        // Check if we have values for this document
                        const value = values && values[docIndex + 2] ? values[docIndex + 2] : '';
                        
                        return (
                          <div key={i} className="py-1">
                            <div className="font-medium text-sm">{field}</div>
                            <div className="text-sm">
                              {value || <span className="text-gray-400 italic">No data</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        
        {/* Analysis View */}
        {activeTab === 'analysis' && (
          <div className="space-y-6 mt-4">
            {/* Analysis Section */}
            {result.analysis && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b flex justify-between items-center">
                  <span>Analysis</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('analysis')}
                  >
                    {expandedSection === 'analysis' ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                {(expandedSection === 'analysis' || expandedSection === null) && (
                  <div className="p-4">
                    {renderMarkdown(result.analysis)}
                  </div>
                )}
              </div>
            )}

            {/* Summary Section */}
            {result.summary && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b flex justify-between items-center">
                  <span>Summary</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('summary')}
                  >
                    {expandedSection === 'summary' ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                {(expandedSection === 'summary' || expandedSection === null) && (
                  <div className="p-4">
                    {renderMarkdown(result.summary)}
                  </div>
                )}
              </div>
            )}

            {/* Insights Section */}
            {result.insights && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b flex justify-between items-center">
                  <span>Insights</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('insights')}
                  >
                    {expandedSection === 'insights' ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                {(expandedSection === 'insights' || expandedSection === null) && (
                  <div className="p-4">
                    {renderMarkdown(result.insights)}
                  </div>
                )}
              </div>
            )}

            {/* Issues Section */}
            {result.issues && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b flex justify-between items-center">
                  <span>Issues</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('issues')}
                  >
                    {expandedSection === 'issues' ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                {(expandedSection === 'issues' || expandedSection === null) && (
                  <div className="p-4">
                    {renderMarkdown(result.issues)}
                  </div>
                )}
              </div>
            )}

            {/* Recommendations Section */}
            {result.recommendations && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 font-medium border-b flex justify-between items-center">
                  <span>Recommendations</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSection('recommendations')}
                  >
                    {expandedSection === 'recommendations' ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                {(expandedSection === 'recommendations' || expandedSection === null) && (
                  <div className="p-4">
                    {renderMarkdown(result.recommendations)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Export buttons */}
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              // Create a text version of the results
              const content = `
                # Document Comparison Results
                
                ${result.tables?.map(table => `
                  ## ${table.title || 'Comparison Table'}
                  ${table.headers.join(' | ')}
                  ${'-'.repeat(table.headers.join(' | ').length)}
                  ${table.rows.map(row => row.join(' | ')).join('\n')}
                `).join('\n\n')}
                
                ## Analysis Sections
                
                ${sections.map(section => `### ${section.title}\n${section.content}`).join('\n\n')}
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
                    
                    ${result.tables?.map(table => `
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
                    
                    ${sections.map(section => `
                      <div class="section">
                        <h3>${section.title}</h3>
                        <div>${(section.content).replace(/\n/g, '<br>')}</div>
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
    </div>
  );
};
