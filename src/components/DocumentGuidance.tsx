import React, { useRef, useEffect, useState } from 'react';
import { DOCUMENT_TYPE_GUIDANCE } from '../lib/document-types';

/**
 * Document Guidance Component
 * 
 * Provides guidance on document naming conventions and content requirements
 * for better automatic detection of document types.
 */
interface DocumentGuidanceProps {
  isVisible: boolean;
  onClose: () => void;
}

export function DocumentGuidance({ isVisible, onClose }: DocumentGuidanceProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Set focus to the modal when it opens
  useEffect(() => {
    if (isVisible && modalRef.current) {
      // Find the first focusable element
      const firstFocusable = modalRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus();
      }
    }
  }, [isVisible]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);
  
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isVisible) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible, onClose]);
  
  // Function to copy example filename to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      // Reset the copied text after 2 seconds
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  if (!isVisible) return null;

  return (
    <div 
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Document Upload Guidelines</h2>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
              aria-label="Close guidelines"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(DOCUMENT_TYPE_GUIDANCE).map(([type, guidance]) => (
              <div key={type} className="border rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">{guidance.icon}</span>
                  <h3 className="font-semibold">{guidance.name}</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Filename Keywords:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {guidance.keywords.map(keyword => (
                        <span key={keyword} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-700">Example Filenames:</p>
                    <ul className="mt-1 space-y-1">
                      {guidance.filenameExamples.map(example => (
                        <li key={example} className="flex items-center justify-between text-gray-600 text-xs font-mono bg-gray-50 px-2 py-1 rounded">
                          <span>{example}</span>
                          <button
                            onClick={() => copyToClipboard(example)}
                            className={`ml-2 text-xs px-2 py-1 rounded ${copiedText === example ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                            aria-label={`Copy ${example} to clipboard`}
                          >
                            {copiedText === example ? 'Copied!' : 'Copy'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-700">Content Should Include:</p>
                    <ul className="mt-1 space-y-1">
                      {guidance.contentHints.map(hint => (
                        <li key={hint} className="text-gray-600 text-xs">• {hint}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <p className="text-xs text-blue-600 font-medium">{guidance.importance}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">💡 Pro Tips for Better Detection:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Include document type and number in filename (e.g., "Invoice_CD970077514.pdf")</li>
              <li>• Use clear, descriptive names rather than generic ones like "Document1.pdf"</li>
              <li>• If auto-detection fails, you can manually select the document type</li>
              <li>• Ensure documents are clear and readable for better processing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
