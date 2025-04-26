import React, { useEffect, useState } from 'react';

interface ModernLoadingProps {
  text: string;
  progress: number;
  showProgress?: boolean;
}

function ModernLoading({ 
  text, 
  progress, 
  showProgress = true 
}: ModernLoadingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [dots, setDots] = useState('');

  // Animate progress smoothly
  useEffect(() => {
    const duration = 500; // ms
    const interval = 10; // ms
    const steps = duration / interval;
    const increment = (progress - animatedProgress) / steps;
    
    if (Math.abs(progress - animatedProgress) < 1) {
      setAnimatedProgress(progress);
      return;
    }
    
    const timer = setTimeout(() => {
      setAnimatedProgress(prev => Math.min(100, prev + increment));
    }, interval);
    
    return () => clearTimeout(timer);
  }, [progress, animatedProgress]);

  // Animate loading dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, []);

  // Generate a color based on progress
  const getGradientColor = () => {
    if (progress < 30) return 'from-blue-500 to-blue-600';
    if (progress < 60) return 'from-blue-600 to-indigo-600';
    if (progress < 90) return 'from-indigo-600 to-purple-600';
    return 'from-purple-600 to-pink-600';
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
        <div className="flex items-center mb-6">
          <div className="relative mr-4">
            <div className="w-12 h-12 rounded-full border-4 border-gray-200 animate-spin border-t-blue-600"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">DocLens AI</h3>
            <p className="text-sm text-gray-500">Intelligent Document Processing</p>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-700 font-medium mb-2">{text}{dots}</p>
          {showProgress && (
            <div className="relative pt-1">
              <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
                <div 
                  style={{ width: `${animatedProgress}%` }} 
                  className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r transition-all duration-500 ease-out ${getGradientColor()}`}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs font-semibold inline-block text-blue-600">
                  Processing
                </span>
                <span className="text-xs font-semibold inline-block text-blue-600">
                  {Math.round(animatedProgress)}%
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500 italic">
          {progress < 30 && "Extracting document data..."}
          {progress >= 30 && progress < 60 && "Analyzing content structures..."}
          {progress >= 60 && progress < 90 && "Applying advanced reasoning..."}
          {progress >= 90 && "Finalizing results..."}
        </div>
      </div>
    </div>
  );
}

export default ModernLoading;
