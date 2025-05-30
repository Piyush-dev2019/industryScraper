import { GoogleGenerativeAI } from '@google/generative-ai';
import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';
import { AzureOpenAI } from "openai";
import "@azure/openai/types";
import fs from 'fs';
import path from 'path';
dotenv.config();

const openaiClient41mini = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY_41,
  endpoint: process.env.AZURE_OPENAI_API_KEY_41_ENDPOINT,
  apiVersion: "2024-02-15-preview" // Using the current stable version
});

const openaiClient_41_Sweden = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY_REPORTWORKFLOW_SWEDEN,
  endpoint: process.env.AZURE_OPENAI_API_KEY_REPORTWORKFLOW_SWEDEN_ENDPOINT,
  apiVersion: "2024-12-01-preview" // Using the current stable version
});

const openaiClient_O3_MINI = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY_O3_MINI,
  endpoint: process.env.AZURE_OPENAI_API_KEY_O3_MINI_ENDPOINT,
  apiVersion: "2024-02-15-preview" // Using the current stable version
});

const openaiClient_4o = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY_4o,
  endpoint: process.env.AZURE_OPENAI_API_KEY_4o_ENDPOINT,
  apiVersion: "2025-03-01-preview"
});

const gptCallImage = async (
  modelName: string,
  prompt: string,
  specifyRole: string,
  base64Image: string,
  retryCount = 0,
  maxRetries = 3
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    // Validate the image URL format
    if (!base64Image.match(/^data:(image\/jpeg|image\/png);base64,/)) {
      throw new Error('Invalid image format. Must be JPEG or PNG with proper data URL format');
    }

    // Log the image format being used
    console.log('Using image format:', base64Image.split(';')[0]);

    const completion = await openaiClient_41_Sweden.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 500
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
      return gptCallImage(modelName, prompt, specifyRole, base64Image, retryCount + 1, maxRetries);
    }
    
    // If we've exhausted all retries, throw the error
    console.error('Max retries reached for GPT call. Final error:', error);
    throw error;
  }
};

const gptCall = async (
  modelName: string,
  prompt: string,
  specifyRole: string,
  retryCount = 0,
  maxRetries = 3
) => {
  
  // Save prompt to file with error handling
  try {
    const filePath = path.join(process.cwd(), 'prompts.txt');

    fs.appendFileSync(filePath, prompt + '\n');

  } catch (error) {
    console.error('Error writing prompt to file:', error);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

  try {
    const completion = await openaiClient41mini.chat.completions.create({
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
  gptCallImage,
  model_2_0_flash,
  openaiClient41mini,
  openaiClient_O3_MINI,
  openaiClient_4o,
};
