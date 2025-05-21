import React, { useState, ReactNode } from 'react';
import { ComparisonResult, ComparisonTable } from '@/lib/types';
import { Button } from '@/components/ui/custom-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DocumentComparisonTable } from './DocumentComparisonTable';

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

export function ComparisonView({ result, documentNames }: ComparisonViewProps) {
  const [activeTab, setActiveTab] = useState('tables'); // Default to tables tab
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Toggle section expansion
  const toggleSection = (sectionName: string) => {
    if (expandedSection === sectionName) {
      setExpandedSection(null);
    } else {
      setExpandedSection(sectionName);
    }
  };
  
  // Extract sections from the result - include everything, even if empty
  const sections = [
    { id: 'validation', title: 'Validation', content: result.validation || '' },
    { id: 'verification', title: 'Verification', content: result.verification || '' },
    { id: 'analysis', title: 'Analysis', content: result.analysis || '' },
    { id: 'summary', title: 'Summary', content: result.summary || '' },
    { id: 'insights', title: 'Key Insights', content: result.insights || '' }
  ];
  
  // Check if result has tables
  const hasTables = result.tables && result.tables.length > 0;
  
  // Helper function to ensure content exists
  const hasContent = (content: any): boolean => {
    if (!content) return false;
    if (typeof content === 'string') return content.trim().length > 0;
    return true;
  };

  // Format section content with proper spacing and line breaks
  const formatSectionContent = (content: string) => {
    if (!content) return '';
    // Add line breaks if missing
    const formattedContent = content.replace(/\.\s+([A-Z])/g, '.\n$1');
    // Replace single newlines with double newlines for better spacing
    return formattedContent.replace(/\n(?!\n)/g, '\n\n');
  };
  
  // Extract document values from a table row
  const getDocumentValues = (row: string[]) => {
    // The first cell is the field name
    const field = row[0];
    
    // The rest are document values
    if (row.length === 2) {
      // Single document
      return { field, doc1: row[1] };
    } else if (row.length === 3) {
      // Two documents
      return { field, doc1: row[1], doc2: row[2] };
    } else {
      // Multiple documents
      return { field, values: row.slice(1) };
    }
  };
  
  // Render markdown content
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

  // Render a comparison table
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
            {/* Debug toggle button */}
            <div className="flex justify-end mb-2">
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
              >
                {showDebug ? 'Hide Debug Info' : 'Show Debug Info'} 
              </button>
            </div>
            
            {/* Debug information */}
            {showDebug && (
              <div className="mb-4 p-3 border border-gray-300 rounded bg-gray-50 text-xs overflow-auto">
                <h4 className="font-bold mb-1">Raw Result Data:</h4>
                <pre className="whitespace-pre-wrap overflow-x-auto max-h-40">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
            
            {/* Always show standardized TSV Global logistics fields */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Document Field Validation</h2>
              <p className="text-sm text-gray-600 mb-4">Showing validation results for TSV Global's standardized logistics fields</p>
              
              {/* Field Validation Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Field</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">Value</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {[
                      'Consignee',
                      'Shipper',
                      'Invoice Number',
                      'Date',
                      'Consignee PO Order Number',
                      'Number of Packages',
                      'Gross Weight',
                      'Net Weight',
                      'Product Description',
                      'Cargo Value',
                      'Packing List Details'
                    ].map((field, index) => {
                      // Search in different ways to find any matching field data
                      let value = '—';
                      
                      // First try the structured table approach
                      const fieldTableRow = result.tables?.find(t => t.title === 'Document Field Comparison')?.rows?.find(r => r[0] === field);
                      if (fieldTableRow && fieldTableRow.length > 1) {
                        value = fieldTableRow[1];
                      }
                      
                      // If no value found and we have extractedFields, try there
                      // Use optional chaining and type assertion to safely access extractedFields
                      const extractedFields = (result as any).extractedFields;
                      if (value === '—' && extractedFields && field in extractedFields) {
                        value = String(extractedFields[field]);
                      }
                      
                      // Look for validation status in validation text
                      let status = 'NOT VERIFIED';
                      if (result.validation) {
                        if (result.validation.includes(`✅ ${field}`)) {
                          status = 'SUCCESS';
                        } else if (result.validation.includes(`❌ ${field}`)) {
                          status = 'FAILED';
                        } else if (result.validation.includes(field)) {
                          // Field is mentioned but without clear status
                          status = 'MENTIONED';
                        }
                      }
                        
                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900 border-r">{field}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 border-r">{value}</td>
                          <td className="px-4 py-3 text-sm">
                            {status === 'SUCCESS' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
                                  <circle cx="4" cy="4" r="3" />
                                </svg>
                                Verified
                              </span>
                            )}
                            {status === 'FAILED' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-red-400" fill="currentColor" viewBox="0 0 8 8">
                                  <circle cx="4" cy="4" r="3" />
                                </svg>
                                Issue Found
                              </span>
                            )}
                            {status === 'NOT VERIFIED' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-gray-400" fill="currentColor" viewBox="0 0 8 8">
                                  <circle cx="4" cy="4" r="3" />
                                </svg>
                                Not Verified
                              </span>
                            )}
                            {status === 'MENTIONED' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-yellow-400" fill="currentColor" viewBox="0 0 8 8">
                                  <circle cx="4" cy="4" r="3" />
                                </svg>
                                Mentioned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {hasTables ? (
              <div className="space-y-6">
                {result.tables?.map((table, i) => renderTable(table, i))}
              </div>
            ) : (
              <div className="py-4 text-center text-gray-500">
                <p>No comparison tables available. {showDebug ? 'Check debug data above for raw API response.' : 'Enable debug view to see raw data.'}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Side by Side View with documents as rows and fields as columns */}
        {activeTab === 'sideBySide' && (
          <div className="mt-4">
            {documentNames.length > 0 ? (
              <DocumentComparisonTable 
                documentNames={documentNames}
                extractedFields={(result as any).extractedFields || {}}
              />
            ) : (
              <div className="py-4 text-center text-gray-500">
                <p>No documents available for comparison. Please upload at least two documents.</p>
              </div>
            )}
          </div>
        )}
        
        {/* Analysis View - Show all sections */}
        {activeTab === 'analysis' && (
          <div className="space-y-6 mt-4">
            {sections.map((section, index) => (
              <div key={section.id} className="mb-6">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection(section.id)}
                >
                  <h2 className="text-lg font-semibold text-gray-800">{section.title}</h2>
                  {hasContent(section.content) && (
                    <button className="p-1 hover:bg-gray-100 rounded">
                      {expandedSection === section.id ? (
                        <span>▲</span>
                      ) : (
                        <span>▼</span>
                      )}
                    </button>
                  )}
                </div>
                
                {(expandedSection === section.id || !expandedSection) && hasContent(section.content) && (
                  <div className="mt-2">
                    {renderMarkdown(formatSectionContent(section.content))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Export buttons */}
        <div className="flex justify-end space-x-2 mt-6">
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
}
