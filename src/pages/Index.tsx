
import { DocumentProcessor } from '@/components/DocumentProcessor';
import { FileText, Search, BookText, ClipboardCheck, FileCode, BookOpen, FileType } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center">
            <FileCode className="h-8 w-8 text-primary mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Insight Lens</h1>
              <p className="mt-1 text-sm text-gray-600">
                Advanced document comparison and analysis powered by AI
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DocumentProcessor />
        
        <div className="mt-16 border-t border-gray-200 pt-10">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Upload Documents</h3>
              <p className="text-gray-600">
                Upload multiple documents in various formats including PDF, images, CSV, Excel, and Word documents.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">AI Analysis</h3>
              <p className="text-gray-600">
                Our AI engine powered by Claude analyzes the documents, comparing content and extracting key information.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <ClipboardCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Structured Insights</h3>
              <p className="text-gray-600">
                Receive detailed comparison tables and comprehensive analysis sections including verification, validation, and recommendations.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-16 border-t border-gray-200 pt-10">
          <h2 className="text-2xl font-bold text-center mb-6">Document Types Supported</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {[
              { name: 'PDF Files', icon: FileText },
              { name: 'Images', icon: FileCode },
              { name: 'CSV Files', icon: FileType },
              { name: 'Excel Files', icon: Search },
              { name: 'Word Documents', icon: BookText },
            ].map((item, index) => (
              <div key={index} className="bg-white p-4 rounded-md shadow-sm">
                <item.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Document Insight Lens — Advanced document analysis powered by Claude AI
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Upload your documents for comparison, analysis, and insights
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
