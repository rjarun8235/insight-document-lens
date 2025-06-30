/**
 * DocumentUpload Component
 * 
 * A presentation-only component that handles file selection, drag/drop,
 * and document type selection UI for the document processing application.
 * 
 * Responsibility: Owns UI presentation and user interaction for document upload.
 * Delegates all business operations to DocumentProcessingContext.
 */

import React, { useState, useCallback, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Trash2, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X, 
  RefreshCw, 
  FileUp 
} from 'lucide-react';
import { useDocumentProcessing } from '@/contexts/DocumentProcessingContext';
import { LogisticsDocumentType } from '@/lib/document-types';

/**
 * Document type options for the select dropdown
 */
const DOCUMENT_TYPE_OPTIONS: Array<{ value: LogisticsDocumentType; label: string }> = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'air_waybill', label: 'Air Waybill' },
  { value: 'bill_of_entry', label: 'Bill of Entry' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'certificate_of_origin', label: 'Certificate of Origin' },
  { value: 'commercial_invoice', label: 'Commercial Invoice' },
  { value: 'customs_invoice', label: 'Customs Invoice' },
  { value: 'dangerous_goods_declaration', label: 'Dangerous Goods Declaration' },
  { value: 'delivery_order', label: 'Delivery Order' },
  { value: 'export_declaration', label: 'Export Declaration' },
  { value: 'health_certificate', label: 'Health Certificate' },
  { value: 'import_permit', label: 'Import Permit' },
  { value: 'inspection_certificate', label: 'Inspection Certificate' },
  { value: 'insurance_certificate', label: 'Insurance Certificate' },
  { value: 'letter_of_credit', label: 'Letter of Credit' },
  { value: 'manifest', label: 'Manifest' },
  { value: 'phytosanitary_certificate', label: 'Phytosanitary Certificate' },
  { value: 'proforma_invoice', label: 'Proforma Invoice' },
  { value: 'shipping_bill', label: 'Shipping Bill' },
  { value: 'unknown', label: 'Unknown Document' }
];

/**
 * Props for the DocumentUpload component
 */
interface DocumentUploadProps {
  className?: string;
}

/**
 * DocumentUpload Component
 * 
 * A presentation-only component for uploading and managing documents.
 */
const DocumentUpload: React.FC<DocumentUploadProps> = ({ className }) => {
  // Get document processing context
  const {
    state,
    addDocuments,
    removeDocument,
    updateDocumentType,
    extractDocuments,
    isComplete,
    progressPercentage,
    hasDocuments,
    selectedDocuments
  } = useDocumentProcessing();
  
  // Local state for drag/drop UI
  const [isDragging, setIsDragging] = useState(false);
  
  // Reference to file input element
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    // Convert FileList to array
    const fileArray = Array.from(files);
    
    // Add documents to context
    addDocuments(fileArray);
  }, [addDocuments]);
  
  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);
  
  // Handle click on file input button
  const handleFileInputClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  // Handle drag events
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    // Get files from drop event
    const files = event.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);
  
  // Handle document type change
  const handleDocumentTypeChange = useCallback((id: string, documentType: LogisticsDocumentType) => {
    updateDocumentType(id, documentType);
  }, [updateDocumentType]);
  
  // Handle document removal
  const handleRemoveDocument = useCallback((id: string) => {
    removeDocument(id);
  }, [removeDocument]);
  
  // Handle extract button click
  const handleExtractClick = useCallback(async () => {
    await extractDocuments({ enhancedExtraction: true });
  }, [extractDocuments]);
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Document Upload
        </CardTitle>
        <CardDescription>
          Upload logistics documents for extraction and verification
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Drag and drop area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drag and drop your documents here
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Supported formats: PDF, DOCX, TXT, PNG, JPG
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFileInputClick}
          >
            <FileText className="h-4 w-4 mr-2" />
            Browse Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
        
        {/* Document list */}
        {hasDocuments && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Uploaded Documents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Name</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>
                      <Select
                        value={doc.documentType}
                        onValueChange={(value) => 
                          handleDocumentTypeChange(doc.id, value as LogisticsDocumentType)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {doc.isProcessing ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Processing
                        </Badge>
                      ) : doc.error ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      ) : doc.extraction?.success ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Extracted
                        </Badge>
                      ) : doc.content ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <FileText className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Loading
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDocument(doc.id)}
                        disabled={doc.isProcessing}
                        title="Remove document"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {/* Processing progress */}
        {state.isExtracting && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Processing {state.currentProgress.fileName}
              </span>
              <span className="text-sm text-muted-foreground">
                {state.currentProgress.current} of {state.currentProgress.total}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}
        
        {/* Error display */}
        {state.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          disabled={!hasDocuments || state.isExtracting}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <FileText className="h-4 w-4 mr-2" />
          Add More
        </Button>
        
        <Button
          disabled={!hasDocuments || state.isExtracting || selectedDocuments.length === 0}
          onClick={handleExtractClick}
        >
          {state.isExtracting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4 mr-2" />
              Extract Documents
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DocumentUpload;
