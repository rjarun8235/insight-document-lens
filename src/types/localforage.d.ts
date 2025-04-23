declare module 'localforage' {
  interface LocalForageOptions {
    name?: string;
    storeName?: string;
    driver?: string | string[];
    size?: number;
    version?: number;
    description?: string;
  }

  interface LocalForageDbMethodsCore {
    getItem<T>(key: string): Promise<T | null>;
    setItem<T>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    length(): Promise<number>;
    key(keyIndex: number): Promise<string>;
    keys(): Promise<string[]>;
    iterate<T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U): Promise<U>;
  }

  interface LocalForageDbMethods extends LocalForageDbMethodsCore {
    getItem<T>(key: string, callback: (err: any, value: T | null) => void): void;
    setItem<T>(key: string, value: T, callback: (err: any, value: T) => void): void;
    removeItem(key: string, callback: (err: any) => void): void;
    clear(callback: (err: any) => void): void;
    length(callback: (err: any, numberOfKeys: number) => void): void;
    key(keyIndex: number, callback: (err: any, key: string) => void): void;
    keys(callback: (err: any, keys: string[]) => void): void;
    iterate<T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U, callback: (err: any, result: U) => void): void;
  }

  interface LocalForageConfig {
    description?: string;
    driver?: string | string[];
    name?: string;
    size?: number;
    storeName?: string;
    version?: number;
  }

  interface LocalForageDriverMethodsOptional {
    _initStorage?(options: LocalForageOptions): void;
    _support?: boolean | (() => boolean);
    _initDriver?(): Promise<void>;
    _ready?(): Promise<void>;
  }

  interface LocalForageDriverMethods extends LocalForageDbMethodsCore, LocalForageDriverMethodsOptional {
    _driver: string;
  }

  interface LocalForageSerializer {
    serialize<T>(value: T, callback: (value: string, error: any) => void): void;
    deserialize<T>(value: string): T;
    stringToBuffer(serializedString: string): ArrayBuffer;
    bufferToString(buffer: ArrayBuffer): string;
  }

  interface LocalForageDriver extends LocalForageDriverMethods {
    _driver: string;
    _initStorage(options: LocalForageOptions): void;
    _support?: boolean | (() => boolean);
  }

  interface LocalForageInstance extends LocalForageDbMethods {
    INDEXEDDB: string;
    WEBSQL: string;
    LOCALSTORAGE: string;
    config(options: LocalForageOptions): void;
    createInstance(options: LocalForageOptions): LocalForageInstance;
    driver(): string;
    setDriver(driver: string | string[], onSuccess?: () => void, onError?: (error: any) => void): Promise<void>;
    defineDriver(driver: LocalForageDriver, onSuccess?: () => void, onError?: (error: any) => void): Promise<void>;
    getSerializer(): Promise<LocalForageSerializer>;
    supports(driverName: string): boolean;
    ready(callback?: (error: any) => void): Promise<void>;
  }

  const localforage: LocalForageInstance;
  export = localforage;
}
