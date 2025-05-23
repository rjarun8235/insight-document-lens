
// @ts-nocheck - Disables TypeScript checking for this file to resolve React 18 compatibility issues with UI components
import * as React from 'react';
import { Toaster as CustomToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import { DocumentProcessingDemo } from "./pages/DocumentProcessingDemo";

/**
 * App Component
 * 
 * Main application component with routing and UI providers.
 */
const App: React.FC = () => (
  <React.Suspense fallback={<div>Loading...</div>}>
    <TooltipProvider>
      <CustomToaster />
      <SonnerToaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/document-processing" element={<DocumentProcessingDemo />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </React.Suspense>
);

export default App;
