/**
 * ExtractionResults Component
 * 
 * A presentation-only component that displays extraction results from document processing.
 * Shows data in tables, cards, and JSON format with filtering and sorting capabilities.
 * 
 * Responsibility: Owns UI presentation for extraction results, including visualization
 * of confidence scores, validation results, and data quality indicators.
 * Delegates all business operations to DocumentProcessingContext.
 */

import React, { useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Download, 
  Code, 
  Filter, 
  SortAsc, 
  SortDesc, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  FileJson, 
  Search, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Layers, 
  RefreshCw
} from 'lucide-react';
import { useDocumentProcessing } from '@/contexts/DocumentProcessingContext';
import { LogisticsDocumentType } from '@/lib/document-types';
import { EnhancedExtractionResult } from '@/lib/services/document-extractor.service';

/**
 * Props for the ExtractionResults component
 */
interface ExtractionResultsProps {
  className?: string;
}

/**
 * Filter options for extraction results
 */
type FilterOption = 'all' | 'success' | 'error' | LogisticsDocumentType;

/**
 * Sort options for extraction results
 */
type SortOption = 'name' | 'type' | 'confidence' | 'date';

/**
 * Sort direction
 */
type SortDirection = 'asc' | 'desc';

/**
 * ExtractionResults Component
 * 
 * A presentation-only component for displaying extraction results.
 */
const ExtractionResults: React.FC<ExtractionResultsProps> = ({ className }) => {
  // Get document processing context
  const {
    state,
    setShowJsonOutput
  } = useDocumentProcessing();
  
  // Local state for UI interactions
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedResults, setExpandedResults] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<'table' | 'cards'>('cards');
  
  // Computed properties
  const { extractionResults } = state;
  const hasResults = extractionResults.length > 0;
  
  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    // Filter results
    let filtered = [...extractionResults];
    
    if (filterOption === 'success') {
      filtered = filtered.filter(result => result.success);
    } else if (filterOption === 'error') {
      filtered = filtered.filter(result => !result.success);
    } else if (filterOption !== 'all') {
      // Filter by document type
      filtered = filtered.filter(result => 
        result.documentType === filterOption || 
        result.data?.metadata?.documentType === filterOption
      );
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result => {
        // Search in file name
        if (result.fileName?.toLowerCase().includes(query)) {
          return true;
        }
        
        // Search in data (if success)
        if (result.success && result.data) {
          // Convert data to string and search
          const dataString = JSON.stringify(result.data).toLowerCase();
          return dataString.includes(query);
        }
        
        return false;
      });
    }
    
    // Sort results
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortOption) {
        case 'name':
          comparison = (a.fileName || '').localeCompare(b.fileName || '');
          break;
        case 'type':
          const typeA = a.documentType || a.data?.metadata?.documentType || 'unknown';
          const typeB = b.documentType || b.data?.metadata?.documentType || 'unknown';
          comparison = typeA.localeCompare(typeB);
          break;
        case 'confidence':
          const confidenceA = a.success ? (a.data?.metadata?.extractionConfidence || 0) : 0;
          const confidenceB = b.success ? (b.data?.metadata?.extractionConfidence || 0) : 0;
          comparison = confidenceA - confidenceB;
          break;
        case 'date':
          // Use file name as a proxy for date (assuming newer files are processed later)
          comparison = (a.fileName || '').localeCompare(b.fileName || '');
          break;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [extractionResults, filterOption, sortOption, sortDirection, searchQuery]);
  
  // Toggle JSON view
  const handleToggleJsonView = (show: boolean) => {
    setShowJsonOutput(show);
  };
  
  // Toggle result expansion
  const toggleResultExpansion = (id: string) => {
    setExpandedResults(prev => 
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };
  
  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilterOption('all');
    setSortOption('name');
    setSortDirection('asc');
    setSearchQuery('');
  };
  
  // Handle export
  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    // This would be implemented in a real application
    // Here we just show what would happen
    console.log(`Exporting results in ${format} format`);
    
    // In a real implementation, this would call a method from the context
    // or a utility function to handle the export
    alert(`Export to ${format.toUpperCase()} would happen here`);
  };
  
  // Render confidence badge
  const renderConfidenceBadge = (confidence: number) => {
    let variant: 'outline' | 'default' | 'secondary' | 'destructive' = 'outline';
    let icon = <AlertCircle className="h-3 w-3 mr-1" />;
    let label = 'Low';
    
    if (confidence >= 0.9) {
      variant = 'default';
      icon = <CheckCircle className="h-3 w-3 mr-1" />;
      label = 'High';
    } else if (confidence >= 0.7) {
      variant = 'secondary';
      icon = <CheckCircle className="h-3 w-3 mr-1" />;
      label = 'Medium';
    } else if (confidence >= 0.5) {
      variant = 'outline';
      icon = <AlertTriangle className="h-3 w-3 mr-1" />;
      label = 'Fair';
    } else {
      variant = 'destructive';
      icon = <AlertCircle className="h-3 w-3 mr-1" />;
      label = 'Low';
    }
    
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant={variant} className="flex items-center">
          {icon}
          {label} ({Math.round(confidence * 100)}%)
        </Badge>
        <Progress value={confidence * 100} className="h-1 w-20" />
      </div>
    );
  };
  
  // Render document type badge
  const renderDocumentTypeBadge = (type: LogisticsDocumentType) => {
    const typeLabels: Record<LogisticsDocumentType, string> = {
      'invoice': 'Invoice',
      'air_waybill': 'Air Waybill',
      'bill_of_entry': 'Bill of Entry',
      'packing_list': 'Packing List',
      'bill_of_lading': 'Bill of Lading',
      'certificate_of_origin': 'Certificate of Origin',
      'commercial_invoice': 'Commercial Invoice',
      'customs_invoice': 'Customs Invoice',
      'dangerous_goods_declaration': 'Dangerous Goods Declaration',
      'delivery_order': 'Delivery Order',
      'export_declaration': 'Export Declaration',
      'health_certificate': 'Health Certificate',
      'import_permit': 'Import Permit',
      'inspection_certificate': 'Inspection Certificate',
      'insurance_certificate': 'Insurance Certificate',
      'letter_of_credit': 'Letter of Credit',
      'manifest': 'Manifest',
      'phytosanitary_certificate': 'Phytosanitary Certificate',
      'proforma_invoice': 'Proforma Invoice',
      'shipping_bill': 'Shipping Bill',
      'unknown': 'Unknown Document'
    };
    
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        {typeLabels[type] || type}
      </Badge>
    );
  };
  
  // Render data quality indicators
  const renderDataQualityIndicators = (result: EnhancedExtractionResult) => {
    if (!result.success || !result.data || !result.data.metadata) {
      return null;
    }
    
    const { metadata } = result.data;
    const missingFields = metadata.missingFields || [];
    const issues = metadata.issues || [];
    
    return (
      <div className="mt-2">
        {missingFields.length > 0 && (
          <div className="text-sm text-amber-600 flex items-start gap-1 mt-1">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Missing fields: </span>
              {missingFields.join(', ')}
            </div>
          </div>
        )}
        
        {issues.length > 0 && (
          <div className="text-sm text-red-600 flex items-start gap-1 mt-1">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Issues: </span>
              {issues.join('; ')}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Render JSON view
  const renderJsonView = (result: EnhancedExtractionResult) => {
    if (!result.success || !result.data) {
      return <div className="text-red-500">No data available</div>;
    }
    
    return (
      <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto max-h-96">
        {JSON.stringify(result.data, null, 2)}
      </pre>
    );
  };
  
  // Render table view
  const renderTableView = () => {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Document</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedResults.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No extraction results match your filters
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedResults.map((result) => {
              const isExpanded = expandedResults.includes(result.fileName || '');
              const documentType = result.documentType || result.data?.metadata?.documentType || 'unknown';
              const confidence = result.success ? (result.data?.metadata?.extractionConfidence || 0) : 0;
              
              return (
                <React.Fragment key={result.fileName}>
                  <TableRow className={isExpanded ? 'border-b-0' : ''}>
                    <TableCell className="font-medium">{result.fileName}</TableCell>
                    <TableCell>{renderDocumentTypeBadge(documentType as LogisticsDocumentType)}</TableCell>
                    <TableCell>
                      {result.success ? renderConfidenceBadge(confidence) : '-'}
                    </TableCell>
                    <TableCell>
                      {result.success ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleResultExpansion(result.fileName || '')}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExport('json')}
                          title="Export as JSON"
                          disabled={!result.success}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-gray-50 p-4">
                        <div className="space-y-4">
                          {renderDataQualityIndicators(result)}
                          
                          <Tabs defaultValue="data" className="w-full">
                            <TabsList>
                              <TabsTrigger value="data">Structured Data</TabsTrigger>
                              <TabsTrigger value="json">JSON</TabsTrigger>
                              {result.rawExtraction && (
                                <TabsTrigger value="raw">Raw Response</TabsTrigger>
                              )}
                            </TabsList>
                            
                            <TabsContent value="data" className="p-4 bg-white rounded-md">
                              {result.success && result.data ? (
                                <div className="space-y-4">
                                  {/* Identifiers */}
                                  {result.data.identifiers && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Identifiers</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(result.data.identifiers).map(([key, value]) => (
                                          <div key={key} className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">{key}</span>
                                            <span className="text-sm">{String(value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Parties */}
                                  {result.data.parties && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Parties</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(result.data.parties).map(([key, value]) => (
                                          <div key={key} className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">{key}</span>
                                            <span className="text-sm">
                                              {typeof value === 'object' 
                                                ? JSON.stringify(value) 
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Shipment */}
                                  {result.data.shipment && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Shipment</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(result.data.shipment).map(([key, value]) => (
                                          <div key={key} className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">{key}</span>
                                            <span className="text-sm">
                                              {typeof value === 'object' 
                                                ? JSON.stringify(value) 
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Goods */}
                                  {result.data.goods && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Goods</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(result.data.goods).map(([key, value]) => (
                                          <div key={key} className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">{key}</span>
                                            <span className="text-sm">
                                              {typeof value === 'object' 
                                                ? JSON.stringify(value) 
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Financial */}
                                  {result.data.financial && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Financial</h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(result.data.financial).map(([key, value]) => (
                                          <div key={key} className="flex flex-col">
                                            <span className="text-xs text-muted-foreground">{key}</span>
                                            <span className="text-sm">
                                              {typeof value === 'object' 
                                                ? JSON.stringify(value) 
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-red-500">No data available</div>
                              )}
                            </TabsContent>
                            
                            <TabsContent value="json" className="p-4 bg-white rounded-md">
                              {renderJsonView(result)}
                            </TabsContent>
                            
                            {result.rawExtraction && (
                              <TabsContent value="raw" className="p-4 bg-white rounded-md">
                                <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto max-h-96">
                                  {result.rawExtraction}
                                </pre>
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    );
  };
  
  // Render card view
  const renderCardView = () => {
    if (filteredAndSortedResults.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No extraction results match your filters
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedResults.map((result) => {
          const isExpanded = expandedResults.includes(result.fileName || '');
          const documentType = result.documentType || result.data?.metadata?.documentType || 'unknown';
          const confidence = result.success ? (result.data?.metadata?.extractionConfidence || 0) : 0;
          
          return (
            <Card key={result.fileName} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{result.fileName}</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleResultExpansion(result.fileName || '')}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <CardDescription className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderDocumentTypeBadge(documentType as LogisticsDocumentType)}
                    
                    {result.success ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pb-2">
                {result.success ? (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                      {renderConfidenceBadge(confidence)}
                    </div>
                    
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Fields</div>
                      <div className="flex items-center gap-1">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {result.data ? Object.keys(result.data).length - 1 : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive" className="p-2 text-xs">
                    <AlertDescription>
                      {result.error?.message || 'Extraction failed'}
                    </AlertDescription>
                  </Alert>
                )}
                
                {renderDataQualityIndicators(result)}
              </CardContent>
              
              {isExpanded && (
                <div className="px-6 pb-6">
                  <Tabs defaultValue="data" className="w-full">
                    <TabsList>
                      <TabsTrigger value="data">Data</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="data" className="p-4 bg-gray-50 rounded-md mt-2">
                      {result.success && result.data ? (
                        <div className="space-y-3">
                          {/* Show key fields based on document type */}
                          {result.data.identifiers && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Identifiers</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(result.data.identifiers).map(([key, value]) => (
                                  <div key={key} className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">{key}</span>
                                    <span className="text-sm font-medium">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Show a few more important fields based on document type */}
                          {result.data.parties?.shipper && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Shipper</h4>
                              <div className="text-sm">
                                {typeof result.data.parties.shipper === 'object'
                                  ? result.data.parties.shipper.name
                                  : String(result.data.parties.shipper)}
                              </div>
                            </div>
                          )}
                          
                          {result.data.parties?.consignee && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Consignee</h4>
                              <div className="text-sm">
                                {typeof result.data.parties.consignee === 'object'
                                  ? result.data.parties.consignee.name
                                  : String(result.data.parties.consignee)}
                              </div>
                            </div>
                          )}
                          
                          {result.data.financial?.totalAmount && (
                            <div>
                              <h4 className="text-xs font-medium text-muted-foreground mb-1">Total Amount</h4>
                              <div className="text-sm font-medium">
                                {typeof result.data.financial.totalAmount === 'object'
                                  ? `${result.data.financial.totalAmount.currency} ${result.data.financial.totalAmount.amount}`
                                  : String(result.data.financial.totalAmount)}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-500 text-sm">No data available</div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="json" className="mt-2">
                      {renderJsonView(result)}
                    </TabsContent>
                  </Tabs>
                </div>
              )}
              
              <CardFooter className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport('json')}
                  title="Export as JSON"
                  disabled={!result.success}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    );
  };
  
  // If no results, show empty state
  if (!hasResults) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extraction Results
          </CardTitle>
          <CardDescription>
            Upload and process documents to see extraction results
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="bg-muted rounded-full p-3 mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No extraction results yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Upload documents and extract data to see results here. You can then view, filter, and export the extracted information.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extraction Results
            </CardTitle>
            <CardDescription>
              {filteredAndSortedResults.length} of {extractionResults.length} documents
            </CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="json-mode"
                  checked={state.showJsonOutput}
                  onCheckedChange={handleToggleJsonView}
                />
                <label
                  htmlFor="json-mode"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  JSON View
                </label>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                title="Export as JSON"
              >
                <FileJson className="h-4 w-4 mr-2" />
                JSON
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                title="Export as CSV"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filters and search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Select
                value={filterOption}
                onValueChange={(value) => setFilterOption(value as FilterOption)}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="success">Successful Only</SelectItem>
                  <SelectItem value="error">Failed Only</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="air_waybill">Air Waybills</SelectItem>
                  <SelectItem value="packing_list">Packing Lists</SelectItem>
                  <SelectItem value="bill_of_entry">Bills of Entry</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={sortOption}
                onValueChange={(value) => setSortOption(value as SortOption)}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <div className="flex items-center">
                    {sortDirection === 'asc' ? (
                      <SortAsc className="h-4 w-4 mr-2" />
                    ) : (
                      <SortDesc className="h-4 w-4 mr-2" />
                    )}
                    <SelectValue placeholder="Sort by" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">File Name</SelectItem>
                  <SelectItem value="type">Document Type</SelectItem>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="date">Processing Date</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSortDirection}
                title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortDirection === 'asc' ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              disabled={filterOption === 'all' && sortOption === 'name' && sortDirection === 'asc' && !searchQuery}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={selectedTab === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSelectedTab('cards')}
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedTab === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setSelectedTab('table')}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Results display */}
        <div className="mt-4">
          {state.showJsonOutput ? (
            <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto max-h-[600px]">
              {JSON.stringify(filteredAndSortedResults, null, 2)}
            </pre>
          ) : (
            <div>
              {selectedTab === 'table' ? renderTableView() : renderCardView()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExtractionResults;
