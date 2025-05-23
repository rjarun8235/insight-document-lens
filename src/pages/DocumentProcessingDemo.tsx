import React, { useState } from 'react';
import { DocumentProcessingUpload, ProcessedDocument } from '../components/DocumentProcessingUpload';

export function DocumentProcessingDemo() {
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [showJsonOutput, setShowJsonOutput] = useState(false);

  const handleProcessedDocuments = (docs: ProcessedDocument[]) => {
    console.log('Documents processed:', docs);
    setProcessedDocuments(docs);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Document Processing Pipeline</h1>
        <p className="text-gray-600">
          Upload logistics documents to extract structured data using AI-powered document processing.
        </p>
      </div>

      {/* Document Processing Component */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <DocumentProcessingUpload onProcessedDocuments={handleProcessedDocuments} />
      </div>

      {/* Results Section */}
      {processedDocuments.length > 0 && processedDocuments.some(doc => doc.extraction?.success) && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Extraction Results</h2>
            <button
              onClick={() => setShowJsonOutput(!showJsonOutput)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              {showJsonOutput ? 'Show Summary View' : 'Show JSON Output'}
            </button>
          </div>

          {showJsonOutput ? (
            // JSON Output View
            <pre className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[600px] text-xs">
              {JSON.stringify(
                processedDocuments
                  .filter(doc => doc.extraction?.success)
                  .map(doc => ({
                    fileName: doc.name,
                    documentType: doc.extraction?.data?.metadata.documentType,
                    confidence: doc.extraction?.data?.metadata.extractionConfidence,
                    data: doc.extraction?.data
                  })), 
                null, 
                2
              )}
            </pre>
          ) : (
            // Summary View
            <div className="space-y-6">
              {processedDocuments
                .filter(doc => doc.extraction?.success)
                .map((doc, index) => {
                  const data = doc.extraction?.data;
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-lg">{doc.name}</h3>
                          <p className="text-sm text-gray-500">
                            {data?.metadata.documentType.replace('_', ' ').toUpperCase()} • 
                            Confidence: {(data?.metadata.extractionConfidence || 0).toFixed(2)}
                          </p>
                        </div>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Extracted
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Identifiers */}
                        <div className="bg-gray-50 p-3 rounded">
                          <h4 className="font-medium mb-2 text-gray-700">Document Identifiers</h4>
                          <div className="space-y-1 text-sm">
                            {data?.identifiers.invoiceNumber && (
                              <p>Invoice Number: <span className="font-medium">{data.identifiers.invoiceNumber}</span></p>
                            )}
                            {data?.identifiers.customerPO && (
                              <p>Customer PO: <span className="font-medium">{data.identifiers.customerPO}</span></p>
                            )}
                            {data?.identifiers.shipmentID && (
                              <p>Shipment ID: <span className="font-medium">{data.identifiers.shipmentID}</span></p>
                            )}
                            {data?.identifiers.awbNumber && (
                              <p>AWB Number: <span className="font-medium">{data.identifiers.awbNumber}</span></p>
                            )}
                            {data?.identifiers.hawbNumber && (
                              <p>HAWB Number: <span className="font-medium">{data.identifiers.hawbNumber}</span></p>
                            )}
                          </div>
                        </div>

                        {/* Parties */}
                        <div className="bg-gray-50 p-3 rounded">
                          <h4 className="font-medium mb-2 text-gray-700">Parties</h4>
                          <div className="space-y-2 text-sm">
                            {data?.parties.shipper.name && (
                              <div>
                                <p className="font-medium">Shipper:</p>
                                <p>{data.parties.shipper.name}</p>
                                {data.parties.shipper.country && (
                                  <p className="text-gray-500">{data.parties.shipper.country}</p>
                                )}
                              </div>
                            )}
                            {data?.parties.consignee.name && (
                              <div>
                                <p className="font-medium">Consignee:</p>
                                <p>{data.parties.consignee.name}</p>
                                {data.parties.consignee.country && (
                                  <p className="text-gray-500">{data.parties.consignee.country}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Shipment Details */}
                        <div className="bg-gray-50 p-3 rounded">
                          <h4 className="font-medium mb-2 text-gray-700">Shipment Details</h4>
                          <div className="space-y-1 text-sm">
                            {data?.shipment.packageCount?.value && (
                              <p>Packages: <span className="font-medium">
                                {data.shipment.packageCount.value} {data.shipment.packageCount.unit || ''}
                              </span></p>
                            )}
                            {data?.shipment.grossWeight?.value && (
                              <p>Gross Weight: <span className="font-medium">
                                {data.shipment.grossWeight.value} {data.shipment.grossWeight.unit || ''}
                              </span></p>
                            )}
                            {data?.shipment.netWeight?.value && (
                              <p>Net Weight: <span className="font-medium">
                                {data.shipment.netWeight.value} {data.shipment.netWeight.unit || ''}
                              </span></p>
                            )}
                            {data?.shipment.dimensions && (
                              <p>Dimensions: <span className="font-medium">{data.shipment.dimensions}</span></p>
                            )}
                          </div>
                        </div>

                        {/* Commercial Details */}
                        <div className="bg-gray-50 p-3 rounded">
                          <h4 className="font-medium mb-2 text-gray-700">Commercial Details</h4>
                          <div className="space-y-1 text-sm">
                            {data?.commercial.invoiceValue?.amount && (
                              <p>Invoice Value: <span className="font-medium">
                                {data.commercial.invoiceValue.amount} {data.commercial.invoiceValue.currency || ''}
                              </span></p>
                            )}
                            {data?.commercial.terms && (
                              <p>Terms: <span className="font-medium">{data.commercial.terms}</span></p>
                            )}
                            {data?.product.description && (
                              <p>Product: <span className="font-medium">{data.product.description}</span></p>
                            )}
                            {data?.product.hsnCode && (
                              <p>HSN Code: <span className="font-medium">{data.product.hsnCode}</span></p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentProcessingDemo;
