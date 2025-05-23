import React from 'react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

/**
 * Header Component
 * 
 * A professional header with the TSV Global Solutions logo and application branding.
 */
const Header = ({ 
  title = 'DocLens AI', 
  subtitle = 'Intelligent Document Analysis' 
}: HeaderProps) => {
  return (
    <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-3">
              <img 
                src="/logo.png" 
                alt="TSV Global Solutions" 
                className="h-10 w-auto"
              />
              <div className="border-l border-blue-400 h-10 mx-2"></div>
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                <p className="text-blue-200 text-sm">{subtitle}</p>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="px-3 py-1 bg-blue-700 rounded-full text-xs text-white font-medium flex items-center">
              <span className="h-2 w-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              GenAI Powered
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
