import { ParallelProcessor } from '@/components/ParallelProcessor';
import { Branding } from '@/components/ui/branding';

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Branding size="lg" showTagline={true} />
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ParallelProcessor />
        
        <div className="mt-16 border-t border-gray-200 pt-10">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <span className="text-xl text-primary">📄</span>
              </div>
              <h3 className="text-lg font-medium mb-2">Upload Documents</h3>
              <p className="text-gray-600">
                Upload multiple documents in various formats including PDF, images, CSV, Excel, Word, and text files.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <span className="text-xl text-primary">🔍</span>
              </div>
              <h3 className="text-lg font-medium mb-2">AI Analysis</h3>
              <p className="text-gray-600">
                Our AI engine powered by Claude analyzes the documents, comparing content and extracting key information.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                <span className="text-xl text-primary">✅</span>
              </div>
              <h3 className="text-lg font-medium mb-2">Get Insights</h3>
              <p className="text-gray-600">
                Receive detailed comparison results, highlighting differences and providing analysis, recommendations, and insights.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-16 border-t border-gray-200 pt-10 pb-16">
          <h2 className="text-2xl font-bold text-center mb-6">Supported Document Types</h2>
          <p className="text-center text-gray-600 max-w-3xl mx-auto mb-10">
            DocLens supports a wide range of document formats to meet your comparison needs, 
            with specialized capabilities for logistics documents like packing lists, invoices, and bills of entry.
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {[
              { name: 'PDF', icon: '📄' },
              { name: 'Images', icon: '🖼️' },
              { name: 'CSV', icon: '📊' },
              { name: 'Excel', icon: '📊' },
              { name: 'Word', icon: '📝' },
              { name: 'Text', icon: '📝' }
            ].map((format, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow-sm text-center">
                <div className="mx-auto rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center mb-2">
                  <span className="text-lg">{format.icon}</span>
                </div>
                <span className="text-sm font-medium">{format.name}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Branding className="text-white" />
              <p className="text-gray-400 text-sm mt-2">© 2025 TSV Global Solutions Pvt Limited. All rights reserved.</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
