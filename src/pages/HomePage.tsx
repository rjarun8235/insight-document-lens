import React, { useState } from 'react';
import { DocumentProcessingUpload, ProcessedDocument } from '../components/DocumentProcessingUpload';
import Header from '../components/Header';

/**
 * HomePage Component
 * 
 * Professional page that allows users to upload and analyze logistics documents.
 * Features TSV Global Solutions branding and modern UI design.
 */
const HomePage: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  
  // Handle document selection
  const handleProcessedDocuments = (files: ProcessedDocument[]) => {
    setDocuments(files);
    console.log('Documents processed:', files);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header title="DocLens AI" subtitle="Intelligent Document Analysis" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Upload Card */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-blue-50 mb-8">
          <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Document Processing
            </h2>
            <p className="text-blue-200 text-sm mt-1">Upload your logistics documents for AI-powered analysis</p>
          </div>
          
          <div className="p-6">
            {/* Info Box */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800">About DocLens AI</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>DocLens AI uses advanced GenAI technology to automatically extract and analyze data from your logistics documents. The system can identify document types, extract key information, and provide confidence scores for the extracted data.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Upload Component */}
            <DocumentProcessingUpload onProcessedDocuments={handleProcessedDocuments} />
          </div>
        </div>
        
        {/* Processed Documents Section removed to avoid redundancy */}
        
        {/* Features Section */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-blue-50 mb-8">
          <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-2 2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Key Features
            </h2>
            <p className="text-indigo-200 text-sm mt-1">Discover what makes DocLens AI powerful</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50">
                <div className="text-indigo-600 mb-2">🤖</div>
                <h3 className="font-semibold text-indigo-900 mb-1">GenAI Powered</h3>
                <p className="text-sm text-indigo-700">Leverages advanced AI models to accurately extract data from complex documents.</p>
              </div>
              <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50">
                <div className="text-indigo-600 mb-2">🔍</div>
                <h3 className="font-semibold text-indigo-900 mb-1">Auto-Detection</h3>
                <p className="text-sm text-indigo-700">Automatically identifies document types without manual selection.</p>
              </div>
              <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50">
                <div className="text-indigo-600 mb-2">📊</div>
                <h3 className="font-semibold text-indigo-900 mb-1">Confidence Scoring</h3>
                <p className="text-sm text-indigo-700">Provides detailed confidence scores for extracted data fields.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Supported Document Types */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-blue-50">
          <div className="bg-gradient-to-r from-purple-700 to-purple-800 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Supported Document Types
            </h2>
            <p className="text-purple-200 text-sm mt-1">DocLens AI works with various document formats</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { name: 'Invoice', icon: '🧾' },
                { name: 'House Waybill', icon: '✈️' },
                { name: 'Air Waybill', icon: '✈️' },
                { name: 'Bill of Entry', icon: '🏛️' },
                { name: 'Delivery Note', icon: '📦' },
                { name: 'Packing List', icon: '📋' }
              ].map((docType, i) => (
                <div key={i} className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                  <div className="text-2xl mb-1">{docType.icon}</div>
                  <div className="text-sm font-medium text-purple-900">{docType.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <img src="/logo.png" alt="TSV Global Solutions" className="h-8 w-auto mr-3" />
              <div>
                <div className="font-semibold">DocLens AI</div>
                <div className="text-xs text-gray-400">© 2025 TSV Global Solutions Pvt Ltd</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              Powered by advanced GenAI technology
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
