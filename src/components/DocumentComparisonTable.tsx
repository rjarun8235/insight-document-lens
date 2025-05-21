import React from 'react';

interface DocumentComparisonTableProps {
  documentNames: string[];
  extractedFields: Record<string, any>;
}

/**
 * DocumentComparisonTable - A component that displays document comparison with
 * documents as rows and fields as columns
 */
export function DocumentComparisonTable({ documentNames, extractedFields }: DocumentComparisonTableProps) {
  // Standard fields to display in the comparison
  const standardFields = [
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
  ];

  // Function to get a field value for a specific document
  const getFieldValue = (documentIndex: number, field: string) => {
    // Check if we have document-specific fields
    if (extractedFields && extractedFields[documentIndex] && extractedFields[documentIndex][field]) {
      return extractedFields[documentIndex][field];
    }
    
    // Check if we have general fields
    if (extractedFields && extractedFields[field]) {
      return extractedFields[field];
    }
    
    return '—'; // Em dash for missing values
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Document Comparison</h2>
      <p className="text-sm text-gray-600 mb-4">Side-by-side view of key fields across all documents</p>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          {/* Header row with field names */}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                Document
              </th>
              {standardFields.map((field, index) => (
                <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r">
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          
          {/* Document rows */}
          <tbody className="bg-white divide-y divide-gray-200">
            {documentNames.map((name, docIndex) => (
              <tr key={docIndex} className={docIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r">{name}</td>
                {standardFields.map((field, fieldIndex) => {
                  const value = getFieldValue(docIndex, field);
                  return (
                    <td key={fieldIndex} className="px-4 py-3 text-sm text-gray-900 border-r">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
