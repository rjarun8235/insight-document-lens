import React from 'react';

function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="mr-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="white" />
              <path d="M14 12L26 12C27.1046 12 28 12.8954 28 14V26C28 27.1046 27.1046 28 26 28H14C12.8954 28 12 27.1046 12 26V14C12 12.8954 12.8954 12 14 12Z" fill="#3B82F6" />
              <path d="M16 16L24 16C24.5523 16 25 16.4477 25 17V23C25 23.5523 24.5523 24 24 24H16C15.4477 24 15 23.5523 15 23V17C15 16.4477 15.4477 16 16 16Z" fill="white" />
              <path d="M20 14L22 18H18L20 14Z" fill="white" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">DocLens</h1>
            <p className="text-xs md:text-sm opacity-80">Intelligent Document Analysis & Comparison</p>
          </div>
        </div>
        <div className="text-sm md:text-right">
          <p className="font-medium">TSV Global Solutions Pvt Limited</p>
          <p className="text-xs opacity-80">&copy; {new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </div>
    </header>
  );
}

export default Header;
