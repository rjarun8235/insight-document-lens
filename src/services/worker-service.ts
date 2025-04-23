import { DocumentFile } from '@/lib/types';

// Worker manager service
class WorkerService {
  private workers: Map<string, Worker> = new Map();
  // Map to store callback functions for each worker
  // Not currently used but could be useful for future extensions
  // private callbacks: Map<string, Function> = new Map();

  constructor() {
    // Initialize worker pool if supported
    if (typeof Worker !== 'undefined') {
      console.log('Web Workers are supported in this browser');
    } else {
      console.warn('Web Workers are not supported in this browser. Parsing will occur on the main thread.');
    }
  }

  // Check if workers are supported
  public isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }

  // Parse a document using a worker
  public parseDocument(
    document: DocumentFile,
    onProgress: (progress: number, metadata?: any) => void,
    onPreview: (preview: string) => void,
    onComplete: (result: string | { image: File, text?: string }) => void,
    onError: (error: string, needsFallback?: boolean) => void
  ): void {
    if (!this.isSupported()) {
      onError('Web Workers not supported in this browser');
      return;
    }

    try {
      // Create a new worker for this document
      const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });
      this.workers.set(document.id, worker);

      // Set up message handler
      worker.onmessage = (event) => {
        const { type, result, error, progress, metadata, needsFallback, text } = event.data;

        switch (type) {
          case 'PARSE_COMPLETE':
            onComplete(result);
            this.terminateWorker(document.id);
            break;

          case 'PARSE_ERROR':
            onError(error, needsFallback);
            this.terminateWorker(document.id);
            break;

          case 'PARSE_PROGRESS':
            onProgress(progress, metadata);
            break;

          case 'PAGE_PREVIEW':
            onPreview(text);
            break;

          default:
            console.warn('Unknown message from worker:', event.data);
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        onError(`Worker error: ${error.message}`);
        this.terminateWorker(document.id);
      };

      // Convert file to ArrayBuffer and send to worker
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target?.result as ArrayBuffer;

        // Send the appropriate message based on document type
        switch (document.type) {
          case 'csv':
            worker.postMessage({
              type: 'PARSE_CSV',
              payload: { fileData, fileId: document.id }
            });
            break;

          case 'excel':
            worker.postMessage({
              type: 'PARSE_EXCEL',
              payload: { fileData, fileId: document.id }
            });
            break;

          // PDF processing is now handled directly with Claude vision
          case 'pdf':
            // Instead of processing in worker, use Claude vision directly
            onComplete({
              image: document.file,
              text: `[PDF content from ${document.file.name} - Using Claude's vision capabilities to process this PDF]`
            });
            this.terminateWorker(document.id);
            break;

          default:
            onError(`Unsupported file type for worker: ${document.type}`);
            this.terminateWorker(document.id);
        }
      };

      reader.onerror = () => {
        onError('Failed to read file');
        this.terminateWorker(document.id);
      };

      reader.readAsArrayBuffer(document.file);

    } catch (error) {
      onError(`Failed to create worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Terminate a worker
  private terminateWorker(documentId: string): void {
    const worker = this.workers.get(documentId);
    if (worker) {
      worker.terminate();
      this.workers.delete(documentId);
      console.log(`Worker for document ${documentId} terminated`);
    }
  }

  // Terminate all workers
  public terminateAll(): void {
    this.workers.forEach((worker, id) => {
      worker.terminate();
      console.log(`Worker for document ${id} terminated`);
    });
    this.workers.clear();
  }
}

// Export a singleton instance
export const workerService = new WorkerService();
