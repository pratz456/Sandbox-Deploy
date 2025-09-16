import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Zod schema for validation
const AnalysisResultSchema = z.object({
  deductionStatus: z.enum(['Likely Deductible', 'Possibly Deductible', 'Non-Deductible']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(280),
  irsReference: z.object({
    publication: z.string().optional(),
    section: z.string().optional(),
  }).optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export interface TransactionInput {
  merchant_name: string;
  amount: number;
  category: string;
  date: string;
  account_id?: string;
  description?: string;
  notes?: string;
}

export interface UserContext {
  profession?: string;
  income?: number;
  state?: string;
  filing_status?: string;
}

export async function analyzeTransaction(
  transaction: TransactionInput,
  userContext?: UserContext
): Promise<{ success: true; result: AnalysisResult } | { success: false; error: string }> {
  try {
    console.log('🤖 [AI Analyzer] Starting transaction analysis:', {
      merchant: transaction.merchant_name,
      amount: transaction.amount,
      category: transaction.category,
    });

    // Build user context string
    const contextString = userContext ? `
User Context:
- Profession: ${userContext.profession || 'Not specified'}
- Income: ${userContext.income ? `$${userContext.income.toLocaleString()}` : 'Not specified'}
- State: ${userContext.state || 'Not specified'}
- Filing Status: ${userContext.filing_status || 'Not specified'}
` : '';

    const prompt = `${contextString}

Transaction Details:
- Merchant: ${transaction.merchant_name}
- Amount: $${transaction.amount}
- Category: ${transaction.category}
- Date: ${transaction.date}
- Description: ${transaction.description || 'Not provided'}
- Notes: ${transaction.notes || 'Not provided'}

Analyze this transaction for tax deductibility and provide a JSON response with these exact fields:

{
  "deductionStatus": "Likely Deductible" | "Possibly Deductible" | "Non-Deductible",
  "confidence": 0.85,
  "reasoning": "Brief IRS-aligned explanation (≤280 characters)",
  "irsReference": {
    "publication": "Publication 535",
    "section": "Section 162"
  }
}

Guidelines:
- "Likely Deductible": High confidence (0.8-1.0) that expense is deductible
- "Possibly Deductible": Medium confidence (0.4-0.79) - requires more context or documentation
- "Non-Deductible": Low confidence (0.0-0.39) that expense is deductible
- Reasoning must be concise and IRS-aligned
- Include relevant IRS publication/section when applicable
- Consider if expense is ordinary, necessary, and directly related to business
- Negative amounts (income/refunds) are typically Non-Deductible with 0.0 confidence

Examples:
- Office supplies: "Likely Deductible", 0.95 confidence, "Office supplies are ordinary and necessary business expenses"
- Business meals: "Possibly Deductible", 0.75 confidence, "Business meals deductible up to 50% with proper documentation"
- Personal expenses: "Non-Deductible", 0.95 confidence, "Personal expenses not related to business operations"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a tax expert specializing in business deductions. Provide accurate, concise analysis following IRS guidelines. Always respond with valid JSON matching the exact schema provided."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      return { success: false, error: 'No response from OpenAI' };
    }

    console.log('🤖 [AI Analyzer] Raw OpenAI response:', responseText);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in OpenAI response' };
    }

    try {
      const parsedResult = JSON.parse(jsonMatch[0]);
      console.log('🤖 [AI Analyzer] Parsed result:', parsedResult);

      // Validate with Zod schema
      const validatedResult = AnalysisResultSchema.parse(parsedResult);
      
      console.log('✅ [AI Analyzer] Analysis complete:', {
        status: validatedResult.deductionStatus,
        confidence: validatedResult.confidence,
        reasoning: validatedResult.reasoning,
        irsRef: validatedResult.irsReference,
      });

      return { success: true, result: validatedResult };
    } catch (parseError) {
      console.error('❌ [AI Analyzer] JSON parsing/validation error:', parseError);
      return { success: false, error: 'Invalid JSON response from OpenAI' };
    }

  } catch (error) {
    console.error('❌ [AI Analyzer] Error during analysis:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during analysis' 
    };
  }
}

// Retry function for invalid responses
export async function analyzeTransactionWithRetry(
  transaction: TransactionInput,
  userContext?: UserContext,
  maxRetries: number = 2
): Promise<{ success: true; result: AnalysisResult } | { success: false; error: string }> {
  let lastError = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🤖 [AI Analyzer] Attempt ${attempt}/${maxRetries}`);
    
    const result = await analyzeTransaction(transaction, userContext);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    console.warn(`⚠️ [AI Analyzer] Attempt ${attempt} failed: ${lastError}`);
    
    if (attempt < maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return { success: false, error: `Failed after ${maxRetries} attempts. Last error: ${lastError}` };
}