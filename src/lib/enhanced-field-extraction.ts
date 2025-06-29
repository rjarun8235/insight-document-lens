import { LogisticsDocumentType } from './document-types';

export interface EnhancedFieldValue {
  value: any;
  confidence: number;
  unit?: string;
  context?: string;
  originalText?: string;
  alternatives?: Array<{
    value: any;
    confidence: number;
    source: string;
  }>;
}

export interface PackageCountExtractionResult {
  packageCount: EnhancedFieldValue;
  packageUnit: string;
  extractionNotes: string[];
}

export class EnhancedFieldExtraction {
  
  /**
   * Enhanced package count extraction with document-specific patterns
   */
  static extractPackageCount(
    content: string, 
    documentType: LogisticsDocumentType
  ): PackageCountExtractionResult {
    const patterns = {
      invoice: [
        // Commercial documents typically count boxes/cartons
        /(\d+(?:\.\d+)?)\s*(boxes?|cartons?|packages?|units?|sets?)/gi,
        /qty[:\s]*(\d+(?:\.\d+)?)\s*(boxes?|cartons?|packages?|units?)/gi,
        /quantity[:\s]*(\d+(?:\.\d+)?)\s*(boxes?|cartons?|packages?)/gi,
        // Sometimes just numbers with context
        /total[:\s]*(\d+(?:\.\d+)?)\s*(boxes?|cartons?)/gi,
      ],
      
      house_waybill: [
        // Shipping documents count pieces/packages
        /(\d+(?:\.\d+)?)\s*(pieces?|pcs?|pkgs?|packages?)/gi,
        /(\d+(?:\.\d+)?)\s*PKG/gi, // Common AWB format
        /pieces?[:\s]*(\d+(?:\.\d+)?)/gi,
        /no\.?\s*of\s*pieces?[:\s]*(\d+(?:\.\d+)?)/gi,
        /total\s*pieces?[:\s]*(\d+(?:\.\d+)?)/gi,
      ],
      
      air_waybill: [
        // Master AWB format
        /(\d+(?:\.\d+)?)\s*PKG/gi,
        /(\d+(?:\.\d+)?)\s*(pieces?|pcs?)/gi,
        /no\.?\s*of\s*packages?[:\s]*(\d+(?:\.\d+)?)/gi,
        /total\s*packages?[:\s]*(\d+(?:\.\d+)?)/gi,
      ],
      
      bill_of_entry: [
        // Customs documents may use either
        /(\d+(?:\.\d+)?)\s*(pieces?|pcs?|pkgs?|packages?|boxes?|cartons?)/gi,
        /qty[:\s]*(\d+(?:\.\d+)?)\s*(pieces?|packages?)/gi,
        /no\.?\s*of\s*packages?[:\s]*(\d+(?:\.\d+)?)/gi,
      ],
      
      packing_list: [
        // Packing lists are detailed
        /(\d+(?:\.\d+)?)\s*(boxes?|cartons?|packages?|cases?)/gi,
        /total[:\s]*(\d+(?:\.\d+)?)\s*(boxes?|cartons?|packages?)/gi,
        /packing[:\s]*(\d+(?:\.\d+)?)\s*(boxes?|cartons?)/gi,
      ],
      
      delivery_note: [
        // Delivery notes track physical packages
        /(\d+(?:\.\d+)?)\s*(packages?|boxes?|cartons?|pieces?)/gi,
        /delivered[:\s]*(\d+(?:\.\d+)?)\s*(packages?|boxes?)/gi,
        /qty[:\s]*(\d+(?:\.\d+)?)\s*(packages?|boxes?)/gi,
      ]
    };

    const documentPatterns = patterns[documentType] || patterns.invoice;
    const extractionNotes: string[] = [];
    const matches: Array<{
      value: number;
      unit: string;
      confidence: number;
      originalText: string;
      source: string;
    }> = [];

    // Extract all possible matches
    documentPatterns.forEach((pattern, index) => {
      const patternMatches = Array.from(content.matchAll(pattern));
      patternMatches.forEach(match => {
        const value = parseFloat(match[1]);
        const unit = match[2] ? match[2].toLowerCase() : 'unknown';
        const originalText = match[0];
        
        if (!isNaN(value) && value > 0) {
          // Calculate confidence based on pattern specificity and document type
          let confidence = 0.7; // Base confidence
          
          // Boost confidence for document-type appropriate units
          if (this.isAppropriateUnit(unit, documentType)) {
            confidence += 0.2;
          }
          
          // Boost confidence for specific patterns (early patterns are more specific)
          confidence += (1 - index * 0.1) * 0.1;
          
          // Ensure confidence doesn't exceed 1.0
          confidence = Math.min(confidence, 1.0);
          
          matches.push({
            value,
            unit,
            confidence,
            originalText,
            source: `pattern_${index}`
          });
        }
      });
    });

    // Remove duplicates and sort by confidence
    const uniqueMatches = this.deduplicateMatches(matches);
    uniqueMatches.sort((a, b) => b.confidence - a.confidence);

    // Analyze matches for consistency
    const analysis = this.analyzePackageCountMatches(uniqueMatches, documentType);
    extractionNotes.push(...analysis.notes);

    // Select the best match
    let bestMatch = uniqueMatches[0];
    let packageUnit = 'packages'; // Default unit
    
    if (bestMatch) {
      packageUnit = this.standardizePackageUnit(bestMatch.unit, documentType);
      
      // If we have multiple matches, consider creating alternatives
      const alternatives = uniqueMatches.slice(1, 3).map(match => ({
        value: match.value,
        confidence: match.confidence,
        source: `Alternative extraction: ${match.originalText}`
      }));

      return {
        packageCount: {
          value: bestMatch.value,
          confidence: bestMatch.confidence,
          unit: packageUnit,
          context: documentType,
          originalText: bestMatch.originalText,
          alternatives: alternatives.length > 0 ? alternatives : undefined
        },
        packageUnit,
        extractionNotes
      };
    }

    // No matches found
    extractionNotes.push(`No package count patterns found for ${documentType}`);
    
    return {
      packageCount: {
        value: null,
        confidence: 0.1,
        unit: packageUnit,
        context: documentType,
        originalText: null
      },
      packageUnit,
      extractionNotes
    };
  }

  /**
   * Check if a unit is appropriate for the document type
   */
  private static isAppropriateUnit(unit: string, documentType: LogisticsDocumentType): boolean {
    const unitMappings = {
      invoice: ['boxes', 'cartons', 'packages', 'units', 'sets'],
      house_waybill: ['pieces', 'pcs', 'pkgs', 'packages'],
      air_waybill: ['pieces', 'pcs', 'pkgs', 'packages'],
      bill_of_entry: ['pieces', 'pcs', 'pkgs', 'packages', 'boxes', 'cartons'],
      packing_list: ['boxes', 'cartons', 'packages', 'cases'],
      delivery_note: ['packages', 'boxes', 'cartons', 'pieces']
    };

    const appropriateUnits = unitMappings[documentType] || [];
    return appropriateUnits.some(appropriateUnit => 
      unit.includes(appropriateUnit) || appropriateUnit.includes(unit)
    );
  }

  /**
   * Standardize package units based on document type
   */
  private static standardizePackageUnit(unit: string, documentType: LogisticsDocumentType): string {
    const lowerUnit = unit.toLowerCase();
    
    // Commercial documents prefer "boxes" or "cartons"
    if (['invoice', 'packing_list'].includes(documentType)) {
      if (lowerUnit.includes('box') || lowerUnit.includes('carton')) {
        return lowerUnit.includes('box') ? 'boxes' : 'cartons';
      }
      return 'packages';
    }
    
    // Shipping documents prefer "pieces"
    if (['house_waybill', 'air_waybill'].includes(documentType)) {
      if (lowerUnit.includes('piece') || lowerUnit.includes('pcs')) {
        return 'pieces';
      }
      if (lowerUnit.includes('pkg')) {
        return 'packages';
      }
      return 'pieces';
    }
    
    // Default standardization
    if (lowerUnit.includes('box')) return 'boxes';
    if (lowerUnit.includes('carton')) return 'cartons';
    if (lowerUnit.includes('piece') || lowerUnit.includes('pcs')) return 'pieces';
    if (lowerUnit.includes('pkg')) return 'packages';
    
    return 'packages';
  }

  /**
   * Remove duplicate matches that are likely the same value
   */
  private static deduplicateMatches(matches: Array<{
    value: number;
    unit: string;
    confidence: number;
    originalText: string;
    source: string;
  }>): typeof matches {
    const unique: typeof matches = [];
    
    for (const match of matches) {
      const isDuplicate = unique.some(existing => 
        existing.value === match.value && 
        this.areSimilarUnits(existing.unit, match.unit)
      );
      
      if (!isDuplicate) {
        unique.push(match);
      }
    }
    
    return unique;
  }

  /**
   * Check if two units are similar (e.g., "boxes" and "box")
   */
  private static areSimilarUnits(unit1: string, unit2: string): boolean {
    const normalize = (unit: string) => unit.toLowerCase().replace(/s$/, '');
    return normalize(unit1) === normalize(unit2);
  }

  /**
   * Analyze package count matches for consistency and issues
   */
  private static analyzePackageCountMatches(
    matches: Array<{
      value: number;
      unit: string;
      confidence: number;
      originalText: string;
      source: string;
    }>,
    documentType: LogisticsDocumentType
  ): { notes: string[] } {
    const notes: string[] = [];
    
    if (matches.length === 0) {
      notes.push('No package count found in document');
      return { notes };
    }
    
    if (matches.length === 1) {
      notes.push(`Single package count found: ${matches[0].value} ${matches[0].unit}`);
      return { notes };
    }
    
    // Multiple matches - analyze for consistency
    const values = matches.map(m => m.value);
    const uniqueValues = [...new Set(values)];
    
    if (uniqueValues.length === 1) {
      notes.push(`Consistent package count across multiple mentions: ${uniqueValues[0]}`);
    } else {
      notes.push(`Multiple different package counts found: ${uniqueValues.join(', ')}`);
      
      // Check for reasonable ratios (e.g., 2 boxes = 8 pieces)
      const ratios = [];
      for (let i = 0; i < values.length - 1; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const ratio = values[i] / values[j];
          ratios.push(ratio);
        }
      }
      
      const hasReasonableRatio = ratios.some(ratio => 
        (ratio >= 0.25 && ratio <= 4) || (1/ratio >= 0.25 && 1/ratio <= 4)
      );
      
      if (hasReasonableRatio) {
        notes.push('Package count variations may represent different counting methods (boxes vs pieces)');
      } else {
        notes.push('Package count variations appear inconsistent - manual review recommended');
      }
    }
    
    // Check units appropriateness
    const appropriateUnits = matches.filter(m => 
      this.isAppropriateUnit(m.unit, documentType)
    );
    
    if (appropriateUnits.length < matches.length) {
      notes.push(`Some package units may not be typical for ${documentType} documents`);
    }
    
    return { notes };
  }

  /**
   * Enhanced HSN code extraction with validation
   */
  static extractHSNCode(
    content: string,
    documentType: LogisticsDocumentType
  ): EnhancedFieldValue {
    const patterns = [
      // Standard HSN/HS code patterns
      /hsn[:\s]*(\d{6,10})/gi,
      /hs[:\s]*(\d{6,10})/gi,
      /tariff[:\s]*(\d{6,10})/gi,
      /commodity[:\s]*code[:\s]*(\d{6,10})/gi,
      /classification[:\s]*(\d{6,10})/gi,
      // Less specific patterns
      /code[:\s]*(\d{6,10})/gi,
      // Customs-specific patterns
      /ritc[:\s]*(\d{6,10})/gi,
      /cth[:\s]*(\d{6,10})/gi,
    ];

    const matches: Array<{
      value: string;
      confidence: number;
      originalText: string;
      pattern: string;
    }> = [];

    patterns.forEach((pattern, index) => {
      const patternMatches = Array.from(content.matchAll(pattern));
      patternMatches.forEach(match => {
        const value = match[1];
        const originalText = match[0];
        
        // Validate HSN code format (6-10 digits)
        if (value.length >= 6 && value.length <= 10) {
          let confidence = 0.6; // Base confidence
          
          // Higher confidence for specific patterns
          if (index < 3) confidence += 0.3; // HSN, HS, Tariff
          if (index < 5) confidence += 0.1; // Commodity, Classification
          
          // Document-specific confidence adjustments
          if (documentType === 'bill_of_entry' && index <= 2) {
            confidence += 0.1; // BOE likely to have accurate HSN codes
          }
          
          confidence = Math.min(confidence, 1.0);
          
          matches.push({
            value,
            confidence,
            originalText,
            pattern: `pattern_${index}`
          });
        }
      });
    });

    // Sort by confidence and remove duplicates
    const uniqueMatches = matches.filter((match, index, self) => 
      index === self.findIndex(m => m.value === match.value)
    );
    
    uniqueMatches.sort((a, b) => b.confidence - a.confidence);

    if (uniqueMatches.length > 0) {
      const bestMatch = uniqueMatches[0];
      const alternatives = uniqueMatches.slice(1, 3).map(match => ({
        value: match.value,
        confidence: match.confidence,
        source: `Alternative HSN: ${match.originalText}`
      }));

      return {
        value: bestMatch.value,
        confidence: bestMatch.confidence,
        context: documentType,
        originalText: bestMatch.originalText,
        alternatives: alternatives.length > 0 ? alternatives : undefined
      };
    }

    return {
      value: null,
      confidence: 0.1,
      context: documentType,
      originalText: null
    };
  }

  /**
   * Enhanced weight extraction with unit standardization
   */
  static extractWeight(
    content: string,
    weightType: 'gross' | 'net' | 'chargeable' = 'gross'
  ): EnhancedFieldValue {
    const weightPatterns = {
      gross: [
        /gross\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg|kilograms?)/gi,
        /g\.?w\.?[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
        /total\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
        /weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
      ],
      net: [
        /net\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg|kilograms?)/gi,
        /n\.?w\.?[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
        /actual\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
      ],
      chargeable: [
        /chargeable\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
        /c\.?w\.?[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
        /billing\s*weight[:\s]*(\d+(?:\.\d+)?)\s*(kgs?|kg)/gi,
      ]
    };

    const patterns = weightPatterns[weightType];
    const matches: Array<{
      value: number;
      unit: string;
      confidence: number;
      originalText: string;
    }> = [];

    patterns.forEach((pattern, index) => {
      const patternMatches = Array.from(content.matchAll(pattern));
      patternMatches.forEach(match => {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const originalText = match[0];
        
        if (!isNaN(value) && value > 0) {
          // Higher confidence for more specific patterns
          let confidence = 0.8 - (index * 0.1);
          confidence = Math.max(confidence, 0.5);
          
          matches.push({
            value,
            unit: this.standardizeWeightUnit(unit),
            confidence,
            originalText
          });
        }
      });
    });

    // Sort by confidence and take the best match
    matches.sort((a, b) => b.confidence - a.confidence);

    if (matches.length > 0) {
      const bestMatch = matches[0];
      return {
        value: bestMatch.value,
        confidence: bestMatch.confidence,
        unit: bestMatch.unit,
        originalText: bestMatch.originalText
      };
    }

    return {
      value: null,
      confidence: 0.1,
      unit: 'kg',
      originalText: null
    };
  }

  /**
   * Standardize weight units
   */
  private static standardizeWeightUnit(unit: string): string {
    const lowerUnit = unit.toLowerCase();
    if (lowerUnit.includes('kg') || lowerUnit.includes('kilogram')) {
      return 'kg';
    }
    if (lowerUnit.includes('lb') || lowerUnit.includes('pound')) {
      return 'lbs';
    }
    if (lowerUnit.includes('ton') || lowerUnit.includes('tonne')) {
      return 'tons';
    }
    return 'kg'; // Default to kg
  }
}