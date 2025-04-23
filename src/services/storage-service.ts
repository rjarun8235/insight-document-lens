import { DocumentFile } from '@/lib/types';

// Simple storage service using IndexedDB
// This is a fallback implementation if localforage is not available
class SimpleStorage {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error('Error opening IndexedDB', event);
        reject('Error opening IndexedDB');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async setItem<T>(key: string, value: T): Promise<T> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put({ id: key, value });

        request.onsuccess = () => resolve(value);
        request.onerror = () => reject('Error storing data');
      });
    } catch (error) {
      console.error('Error in setItem:', error);
      return value; // Return the value even if storage fails
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };

        request.onerror = () => reject('Error retrieving data');
      });
    } catch (error) {
      console.error('Error in getItem:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error removing data');
      });
    } catch (error) {
      console.error('Error in removeItem:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error clearing data');
      });
    } catch (error) {
      console.error('Error in clear:', error);
    }
  }
}

// Create a storage instance
const storage = new SimpleStorage('document-insight-lens', 'documents');

// Define storage keys
const KEYS = {
  DOCUMENTS: 'cached-documents',
  PARSED_CONTENT: 'parsed-content',
  COMPARISON_TYPE: 'comparison-type',
  LAST_ANALYSIS: 'last-analysis-result'
};

// Define the structure of cached document content
interface CachedDocumentContent {
  id: string;
  content: string | { text?: string };
  hash: string;
  timestamp: number;
}

// Generate a simple hash for a file
async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Storage service
export const storageService = {
  // Save document metadata
  async saveDocuments(documents: DocumentFile[]): Promise<void> {
    try {
      // Store only metadata, not the actual file content
      const metadata = documents.map(({ id, name, type, parsed, parseError }) => ({
        id, name, type, parsed, parseError
      }));

      await storage.setItem(KEYS.DOCUMENTS, metadata);
    } catch (error) {
      console.error('Failed to save documents to storage:', error);
    }
  },

  // Load document metadata
  async loadDocuments(): Promise<Partial<DocumentFile>[]> {
    try {
      const documents = await storage.getItem<Partial<DocumentFile>[]>(KEYS.DOCUMENTS);
      return documents || [];
    } catch (error) {
      console.error('Failed to load documents from storage:', error);
      return [];
    }
  },

  // Save parsed content with file hash for cache invalidation
  async saveParsedContent(
    documentId: string,
    file: File,
    content: string | { image: File, text?: string }
  ): Promise<void> {
    try {
      // Generate a hash of the file to detect changes
      const hash = await generateFileHash(file);

      // Get existing cached content
      const cachedContent = await storage.getItem<CachedDocumentContent[]>(KEYS.PARSED_CONTENT) || [];

      // Remove any existing entry for this document
      const filteredContent = cachedContent.filter((item: CachedDocumentContent) => item.id !== documentId);

      // Add the new content
      const newCachedContent = [
        ...filteredContent,
        {
          id: documentId,
          content: typeof content === 'string' ? content : { text: content.text },
          hash,
          timestamp: Date.now()
        }
      ];

      // Save to storage
      await storage.setItem(KEYS.PARSED_CONTENT, newCachedContent);
    } catch (error) {
      console.error('Failed to save parsed content:', error);
    }
  },

  // Load parsed content if hash matches
  async loadParsedContent(documentId: string, file: File): Promise<string | { text?: string } | null> {
    try {
      // Generate hash for the current file
      const currentHash = await generateFileHash(file);

      // Get cached content
      const cachedContent = await storage.getItem<CachedDocumentContent[]>(KEYS.PARSED_CONTENT) || [];

      // Find the matching document
      const matchingContent = cachedContent.find((item: CachedDocumentContent) => item.id === documentId);

      // Return content if hash matches (cache hit)
      if (matchingContent && matchingContent.hash === currentHash) {
        console.log(`Cache hit for document ${documentId}`);
        return matchingContent.content;
      }

      console.log(`Cache miss for document ${documentId}`);
      return null;
    } catch (error) {
      console.error('Failed to load parsed content:', error);
      return null;
    }
  },

  // Save comparison type
  async saveComparisonType(type: string): Promise<void> {
    try {
      await storage.setItem(KEYS.COMPARISON_TYPE, type);
    } catch (error) {
      console.error('Failed to save comparison type:', error);
    }
  },

  // Load comparison type
  async loadComparisonType(): Promise<string> {
    try {
      return (await storage.getItem<string>(KEYS.COMPARISON_TYPE)) || 'general';
    } catch (error) {
      console.error('Failed to load comparison type:', error);
      return 'general';
    }
  },

  // Save analysis result
  async saveAnalysisResult(result: any): Promise<void> {
    try {
      await storage.setItem(KEYS.LAST_ANALYSIS, {
        result,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to save analysis result:', error);
    }
  },

  // Load analysis result if not older than maxAge (in milliseconds)
  async loadAnalysisResult(maxAge: number = 3600000): Promise<any> {
    try {
      const saved = await storage.getItem<{ result: any, timestamp: number }>(KEYS.LAST_ANALYSIS);

      if (saved && Date.now() - saved.timestamp < maxAge) {
        return saved.result;
      }

      return null;
    } catch (error) {
      console.error('Failed to load analysis result:', error);
      return null;
    }
  },

  // Clear all storage
  async clearAll(): Promise<void> {
    try {
      await storage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
};
