declare module 'xlsx' {
  export function read(data: ArrayBuffer | Uint8Array, opts?: any): Workbook;
  
  export namespace utils {
    export function sheet_to_json(worksheet: Worksheet, opts?: any): any[];
  }
  
  export interface Workbook {
    SheetNames: string[];
    Sheets: { [key: string]: Worksheet };
  }
  
  export interface Worksheet {
    [key: string]: any;
  }
}
