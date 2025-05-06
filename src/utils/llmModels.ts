import { GoogleGenerativeAI } from '@google/generative-ai';
import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

import OpenAI from 'openai';
dotenv.config();

// Models Initialization
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gptCall = async (
  modelName: string,
  prompt: string,
  specifyRole: string,
  retryCount = 0,
  maxRetries = 3
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    const completion = await openaiClient.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: specifyRole as 'system' | 'user' | 'assistant',
          content: prompt,
        },
      ],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    return completion.choices[0].message.content?.trim();
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Check if we should retry
    if (retryCount < maxRetries) {
      // Calculate exponential backoff delay: 2^retryCount seconds (2, 4, 8 seconds)
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`GPT call failed${error.name === 'AbortError' ? ' (timeout)' : ''}. Retrying in ${delay/1000} seconds... (Attempt ${retryCount + 1} of ${maxRetries})`);
      console.error('Error details:', error);
      
      // Wait for the backoff period
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the call recursively
      return gptCall(modelName, prompt, specifyRole, retryCount + 1, maxRetries);
    }
    
    // If we've exhausted all retries, throw the error
    console.error('Max retries reached for GPT call. Final error:', error);
    throw error;
  }
};

const geminiKey = process.env.GEMINI_API_KEY;
const geminiClient = new GoogleGenerativeAI(geminiKey ?? '');
const model_2_0_flash = geminiClient.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

const firecrawlApp = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});


export {
  firecrawlApp,
  gptCall,
  model_2_0_flash,
  openaiClient,
};
