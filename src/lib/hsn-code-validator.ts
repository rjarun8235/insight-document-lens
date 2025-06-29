export interface HSNCodeValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  standardizedCode: string | null;
  codeLevel: 'chapter' | 'heading' | 'subheading' | 'tariff' | 'invalid';
  productCategory: string | null;
}

export interface HSNCodeMappingResult {
  commercialCode: string | null;
  customsCode: string | null;
  isConsistent: boolean;
  mappingConfidence: number;
  discrepancyType: 'none' | 'level_difference' | 'category_difference' | 'major_mismatch';
  explanation: string;
  recommendations: string[];
}

export class HSNCodeValidator {
  
  // Common HSN code structure mapping
  private static readonly HSN_STRUCTURE = {
    // Chapter level (2 digits) - broad product categories
    chapters: {
      '01-05': 'Live animals and animal products',
      '06-14': 'Vegetable products',
      '15': 'Animal or vegetable fats and oils',
      '16-24': 'Prepared foodstuffs, beverages, spirits, vinegar, tobacco',
      '25-27': 'Mineral products',
      '28-38': 'Products of chemical or allied industries',
      '39-40': 'Plastics and rubber',
      '41-43': 'Raw hides, skins, leather, furskins',
      '44-46': 'Wood and articles of wood, cork, basketware',
      '47-49': 'Pulp, paper, paperboard and articles thereof',
      '50-63': 'Textiles and textile articles',
      '64-67': 'Footwear, headgear, umbrellas, walking sticks',
      '68-70': 'Articles of stone, plaster, cement, asbestos, mica, glass',
      '71': 'Natural or cultured pearls, precious stones, metals, coins',
      '72-83': 'Base metals and articles of base metal',
      '84-85': 'Machinery, mechanical appliances, electrical equipment',
      '86-89': 'Vehicles, aircraft, vessels and transport equipment',
      '90-92': 'Optical, photographic, cinematographic, measuring, musical instruments',
      '93': 'Arms and ammunition',
      '94-96': 'Miscellaneous manufactured articles',
      '97': 'Works of art, collectors pieces and antiques'
    }
  };

  // Common HSN code patterns for validation
  private static readonly COMMON_PATTERNS = {
    // Electronics and machinery
    '8471': 'Automatic data processing machines',
    '8517': 'Telephone sets, other apparatus for transmission',
    '8528': 'Monitors and projectors',
    '8544': 'Insulated wire, cable and other conductors',
    
    // Automotive parts
    '8708': 'Parts and accessories of motor vehicles',
    '8409': 'Parts for internal combustion engines',
    '4011': 'New pneumatic tyres',
    
    // Textiles
    '6109': 'T-shirts, singlets and other vests, knitted',
    '6203': 'Men\'s suits, ensembles, jackets, trousers',
    '5208': 'Woven fabrics of cotton',
    
    // Chemicals
    '3204': 'Synthetic organic colouring matter',
    '3808': 'Insecticides, rodenticides, fungicides',
    '3926': 'Other articles of plastics',
    
    // Base metals
    '7326': 'Other articles of iron or steel',
    '7318': 'Screws, bolts, nuts, washers',
    '7323': 'Table, kitchen or other household articles of iron/steel'
  };

  /**
   * Validate a single HSN code
   */
  static validateHSNCode(hsnCode: string): HSNCodeValidationResult {
    if (!hsnCode) {
      return {
        isValid: false,
        confidence: 0,
        issues: ['HSN code is empty or null'],
        suggestions: ['Please provide a valid HSN code'],
        standardizedCode: null,
        codeLevel: 'invalid',
        productCategory: null
      };
    }

    // Clean the HSN code (remove spaces, special characters)
    const cleanCode = hsnCode.replace(/\D/g, '');
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.5;
    let isValid = true;

    // Check basic format
    if (cleanCode.length < 4) {
      isValid = false;
      confidence = 0.1;
      issues.push('HSN code too short (minimum 4 digits required)');
      suggestions.push('HSN codes should be at least 4 digits (heading level)');
    } else if (cleanCode.length > 10) {
      isValid = false;
      confidence = 0.2;
      issues.push('HSN code too long (maximum 10 digits)');
      suggestions.push('HSN codes should not exceed 10 digits');
    } else {
      confidence = 0.7;
    }

    // Determine code level
    let codeLevel: HSNCodeValidationResult['codeLevel'] = 'invalid';
    if (cleanCode.length >= 2) {
      if (cleanCode.length === 2) codeLevel = 'chapter';
      else if (cleanCode.length === 4) codeLevel = 'heading';
      else if (cleanCode.length === 6) codeLevel = 'subheading';
      else if (cleanCode.length >= 8) codeLevel = 'tariff';
    }

    // Get product category
    const productCategory = this.getProductCategory(cleanCode);
    if (productCategory) {
      confidence += 0.1;
    }

    // Check against common patterns
    const headingCode = cleanCode.substring(0, 4);
    if (this.COMMON_PATTERNS[headingCode]) {
      confidence += 0.1;
      suggestions.push(`This appears to be: ${this.COMMON_PATTERNS[headingCode]}`);
    }

    // Validate chapter (first 2 digits)
    const chapterCode = parseInt(cleanCode.substring(0, 2));
    if (chapterCode < 1 || chapterCode > 97) {
      isValid = false;
      confidence = Math.min(confidence, 0.3);
      issues.push(`Invalid chapter code: ${chapterCode} (should be 01-97)`);
      suggestions.push('HSN chapter codes range from 01 to 97');
    }

    // Check for suspicious patterns
    if (cleanCode.includes('00000') || cleanCode === '0'.repeat(cleanCode.length)) {
      isValid = false;
      confidence = 0.1;
      issues.push('HSN code appears to be placeholder zeros');
      suggestions.push('Please provide the actual HSN code, not placeholder values');
    }

    return {
      isValid,
      confidence: Math.max(0.1, confidence),
      issues,
      suggestions,
      standardizedCode: isValid ? cleanCode : null,
      codeLevel,
      productCategory
    };
  }

  /**
   * Compare and map HSN codes from different documents
   */
  static mapHSNCodes(
    commercialHSN?: string,
    customsHSN?: string,
    context?: { productDescription?: string; documentTypes?: string[] }
  ): HSNCodeMappingResult {
    
    // Handle missing codes
    if (!commercialHSN && !customsHSN) {
      return {
        commercialCode: null,
        customsCode: null,
        isConsistent: false,
        mappingConfidence: 0.1,
        discrepancyType: 'major_mismatch',
        explanation: 'No HSN codes found in either document',
        recommendations: ['HSN codes are required for customs compliance']
      };
    }

    if (!commercialHSN) {
      const customsValidation = this.validateHSNCode(customsHSN!);
      return {
        commercialCode: null,
        customsCode: customsValidation.standardizedCode,
        isConsistent: false,
        mappingConfidence: customsValidation.confidence * 0.5,
        discrepancyType: 'major_mismatch',
        explanation: 'HSN code only found in customs document',
        recommendations: ['Commercial documents should also include HSN codes for verification']
      };
    }

    if (!customsHSN) {
      const commercialValidation = this.validateHSNCode(commercialHSN);
      return {
        commercialCode: commercialValidation.standardizedCode,
        customsCode: null,
        isConsistent: false,
        mappingConfidence: commercialValidation.confidence * 0.5,
        discrepancyType: 'major_mismatch',
        explanation: 'HSN code only found in commercial document',
        recommendations: ['Customs documents should include HSN codes for duty calculation']
      };
    }

    // Both codes present - validate and compare
    const commercialValidation = this.validateHSNCode(commercialHSN);
    const customsValidation = this.validateHSNCode(customsHSN);

    const cleanCommercial = commercialValidation.standardizedCode || '';
    const cleanCustoms = customsValidation.standardizedCode || '';

    // Exact match
    if (cleanCommercial === cleanCustoms) {
      return {
        commercialCode: cleanCommercial,
        customsCode: cleanCustoms,
        isConsistent: true,
        mappingConfidence: Math.min(commercialValidation.confidence, customsValidation.confidence),
        discrepancyType: 'none',
        explanation: `Exact HSN code match: ${cleanCommercial}`,
        recommendations: ['HSN codes are consistent across documents']
      };
    }

    // Compare at different levels
    const levelComparison = this.compareHSNLevels(cleanCommercial, cleanCustoms);
    
    let mappingConfidence = (commercialValidation.confidence + customsValidation.confidence) / 2;
    let isConsistent = false;
    let discrepancyType: HSNCodeMappingResult['discrepancyType'] = 'major_mismatch';
    let explanation = '';
    const recommendations: string[] = [];

    if (levelComparison.chapter.match) {
      mappingConfidence *= 0.9; // Slight reduction for non-exact match
      
      if (levelComparison.subheading.match) {
        isConsistent = true;
        discrepancyType = 'level_difference';
        mappingConfidence *= 0.95;
        explanation = `HSN codes match at subheading level (6 digits): Commercial(${cleanCommercial}) vs Customs(${cleanCustoms})`;
        recommendations.push('HSN codes are substantially consistent - minor difference in tariff classification');
        
      } else if (levelComparison.heading.match) {
        isConsistent = true;
        discrepancyType = 'level_difference';
        mappingConfidence *= 0.85;
        explanation = `HSN codes match at heading level (4 digits): Commercial(${cleanCommercial}) vs Customs(${cleanCustoms})`;
        recommendations.push('HSN codes represent the same product category but different sub-classifications');
        
      } else {
        discrepancyType = 'category_difference';
        mappingConfidence *= 0.6;
        explanation = `HSN codes match only at chapter level (2 digits): Commercial(${cleanCommercial}) vs Customs(${cleanCustoms})`;
        recommendations.push('HSN codes are in the same broad category but represent different products');
        recommendations.push('Manual review recommended to ensure correct classification');
      }
    } else {
      discrepancyType = 'major_mismatch';
      mappingConfidence *= 0.3;
      explanation = `HSN codes represent completely different product categories: Commercial(${cleanCommercial}) vs Customs(${cleanCustoms})`;
      recommendations.push('Major HSN code discrepancy detected - immediate review required');
      recommendations.push('Verify product descriptions and correct classification');
    }

    // Add context-specific recommendations
    if (context?.productDescription) {
      const productKeywords = this.extractProductKeywords(context.productDescription);
      if (productKeywords.length > 0) {
        recommendations.push(`Product description contains: ${productKeywords.join(', ')} - verify HSN classification matches`);
      }
    }

    return {
      commercialCode: cleanCommercial,
      customsCode: cleanCustoms,
      isConsistent,
      mappingConfidence: Math.max(0.1, mappingConfidence),
      discrepancyType,
      explanation,
      recommendations
    };
  }

  /**
   * Compare HSN codes at different hierarchical levels
   */
  private static compareHSNLevels(code1: string, code2: string): {
    chapter: { match: boolean; code1: string; code2: string };
    heading: { match: boolean; code1: string; code2: string };
    subheading: { match: boolean; code1: string; code2: string };
  } {
    const chapter1 = code1.substring(0, 2);
    const chapter2 = code2.substring(0, 2);
    
    const heading1 = code1.substring(0, 4);
    const heading2 = code2.substring(0, 4);
    
    const subheading1 = code1.substring(0, 6);
    const subheading2 = code2.substring(0, 6);

    return {
      chapter: {
        match: chapter1 === chapter2,
        code1: chapter1,
        code2: chapter2
      },
      heading: {
        match: heading1 === heading2,
        code1: heading1,
        code2: heading2
      },
      subheading: {
        match: subheading1 === subheading2,
        code1: subheading1,
        code2: subheading2
      }
    };
  }

  /**
   * Get product category based on HSN chapter
   */
  private static getProductCategory(hsnCode: string): string | null {
    if (hsnCode.length < 2) return null;
    
    const chapterNum = parseInt(hsnCode.substring(0, 2));
    
    for (const [range, category] of Object.entries(this.HSN_STRUCTURE.chapters)) {
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n));
        if (chapterNum >= start && chapterNum <= end) {
          return category;
        }
      } else {
        if (chapterNum === parseInt(range)) {
          return category;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract product keywords from description for HSN validation
   */
  private static extractProductKeywords(description: string): string[] {
    const keywords: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Common product indicators
    const patterns = {
      'electronic': ['electronic', 'digital', 'computer', 'software', 'circuit'],
      'textile': ['fabric', 'cloth', 'cotton', 'polyester', 'yarn', 'garment'],
      'metal': ['steel', 'iron', 'aluminum', 'brass', 'copper', 'alloy'],
      'plastic': ['plastic', 'polymer', 'synthetic', 'resin'],
      'chemical': ['chemical', 'acid', 'compound', 'solution', 'reagent'],
      'machinery': ['machine', 'equipment', 'tool', 'apparatus', 'device'],
      'automotive': ['car', 'vehicle', 'auto', 'engine', 'brake', 'tire'],
    };

    for (const [category, words] of Object.entries(patterns)) {
      for (const word of words) {
        if (lowerDesc.includes(word)) {
          if (!keywords.includes(category)) {
            keywords.push(category);
          }
        }
      }
    }

    return keywords;
  }

  /**
   * Suggest correct HSN code based on product description
   */
  static suggestHSNCode(productDescription: string): {
    suggestions: Array<{
      code: string;
      description: string;
      confidence: number;
    }>;
    reasoning: string[];
  } {
    const suggestions: Array<{
      code: string;
      description: string;
      confidence: number;
    }> = [];
    const reasoning: string[] = [];

    const keywords = this.extractProductKeywords(productDescription);
    
    // Basic keyword-based suggestions
    if (keywords.includes('electronic')) {
      suggestions.push({
        code: '8517',
        description: 'Telephone sets, other apparatus for transmission',
        confidence: 0.6
      });
      suggestions.push({
        code: '8471',
        description: 'Automatic data processing machines',
        confidence: 0.5
      });
      reasoning.push('Product appears to be electronic equipment');
    }

    if (keywords.includes('textile')) {
      suggestions.push({
        code: '6109',
        description: 'T-shirts, singlets and other vests, knitted',
        confidence: 0.6
      });
      suggestions.push({
        code: '5208',
        description: 'Woven fabrics of cotton',
        confidence: 0.5
      });
      reasoning.push('Product appears to be textile/clothing');
    }

    if (keywords.includes('metal')) {
      suggestions.push({
        code: '7326',
        description: 'Other articles of iron or steel',
        confidence: 0.6
      });
      suggestions.push({
        code: '7318',
        description: 'Screws, bolts, nuts, washers',
        confidence: 0.5
      });
      reasoning.push('Product appears to be metal articles');
    }

    if (suggestions.length === 0) {
      reasoning.push('Unable to determine specific HSN code from product description');
      reasoning.push('Manual classification recommended based on detailed product specifications');
    }

    return { suggestions, reasoning };
  }
}