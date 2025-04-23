import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonResult } from '@/lib/types';

interface StreamingResultsProps {
  result: ComparisonResult | null;
  isStreaming: boolean;
  streamProgress?: number;
}

export function StreamingResults({
  result,
  isStreaming,
  streamProgress = 0
}: StreamingResultsProps) {
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  const [activeTimeoutId, setActiveTimeoutId] = useState<number | null>(null);

  // Sections to display in order
  const sections = [
    { id: 'summary', title: 'Summary', content: result?.summary || '' },
    { id: 'analysis', title: 'Analysis', content: result?.analysis || '' },
    { id: 'insights', title: 'Key Insights', content: result?.insights || '' },
    { id: 'verification', title: 'Verification', content: result?.verification || '' },
    { id: 'recommendations', title: 'Recommendations', content: result?.recommendations || '' },
    { id: 'risks', title: 'Potential Risks', content: result?.risks || '' },
    { id: 'issues', title: 'Issues', content: result?.issues || '' },
  ];

  // Simulate streaming by gradually revealing sections
  useEffect(() => {
    if (isStreaming && result) {
      // Clear any existing timeout
      if (activeTimeoutId !== null) {
        clearTimeout(activeTimeoutId);
        setActiveTimeoutId(null);
      }

      // Calculate how many sections to show based on progress
      const sectionsToShow = Math.ceil((sections.length * streamProgress) / 100);
      const newVisibleSections = sections.slice(0, sectionsToShow).map(s => s.id);

      // Only update if there are new sections to show
      if (newVisibleSections.length > visibleSections.length) {
        // Add a small delay to simulate streaming
        const newTimeoutId = window.setTimeout(() => {
          setVisibleSections(newVisibleSections);
        }, 300);
        setActiveTimeoutId(newTimeoutId);
      }
    } else if (result) {
      // If not streaming but we have results, show all sections
      setVisibleSections(sections.map(s => s.id));
    }

    return () => {
      if (activeTimeoutId !== null) {
        clearTimeout(activeTimeoutId);
        setActiveTimeoutId(null);
      }
    };
  }, [isStreaming, result, streamProgress, sections, visibleSections.length, activeTimeoutId]);

  if (!result && !isStreaming) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {sections.map((section) => {
        const isVisible = visibleSections.includes(section.id);
        const isLoading = isStreaming && !isVisible;

        return (
          <Card key={section.id} className={`transition-all duration-500 ${
            isVisible ? 'opacity-100 transform translate-y-0' :
            isLoading ? 'opacity-70' : 'opacity-0 transform translate-y-4'
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {section.title}
                {isLoading && <span className="ml-2 text-muted-foreground text-sm">Loading...</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isVisible ? (
                <div className="prose prose-sm max-w-none">
                  {section.content.split('\n').map((paragraph, i) => (
                    <p key={i} className={`animate-in fade-in-50 slide-in-from-bottom-3 duration-500 delay-${i * 100}`}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
