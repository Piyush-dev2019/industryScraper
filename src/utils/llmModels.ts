import { GoogleGenerativeAI } from '@google/generative-ai';
import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

import OpenAI from 'openai';
import { extractJsonFromResponse } from './jsonExtractor';
dotenv.config();

// Models Initialization
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gptCall = async (
  modelName: string,
  prompt: string,
  specifyRole: string,
) => {
  const completion = await openaiClient.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: specifyRole as 'system' | 'user' | 'assistant',
        content: prompt,
      },
    ],
  });
  return completion.choices[0].message.content?.trim();
};

const gptWebSearch = async (prompt: string) => {
  const response = await openaiClient.responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    tool_choice: { type: 'web_search_preview' },
    input: prompt,
  });

  // Extract description and source URL from response
  const responseText = response.output_text;
  return responseText;
};

const geminiKey = process.env.GEMINI_API_KEY;
const geminiClient = new GoogleGenerativeAI(geminiKey ?? '');
const model_2_0_flash = geminiClient.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

const firecrawlApp = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});



// Add a new function to get descriptions for multiple people
const getDescriptions = async (
  people: Record<string, string>[],
  companyName: string,
) => {
  // Process all descriptions in parallel
  const descriptionPromises = people.map(async (person) => {
    const prompt = `
    Search the web for every information about ${person.person_name}, ${person.person_position} at ${companyName} use only trusted and credible sources.
    `;

    const searchResult = await gptWebSearch(prompt);

    const formatPrompt = `
      ${searchResult}

      above is a information about ${person.person_name}, ${person.person_position} at ${companyName}.
      Format the description in a way that it can be easily included in a credit memo for a client.

    1. Format: Write a single, concise paragraph
    2. Content Requirements:
       - Focus on professional achievements and leadership
       - Include relevant experience and expertise
       - Highlight contributions to their company
       - Maintain a formal, business-appropriate tone
       - use true facts and not opinions
    3. Restrictions:
       - Keep the description factual and objective
    4. Length: Aim for 2-3 sentences maximum
        remove all the links and any other text that is not part of the description.

        the description should be in the following JSON format:
        {
        "description": 2-3 line paragraph
        "sourceUrls": [list of urls]
        }
        `;

    const result = await gptCall('gpt-4o', formatPrompt, 'user');
    const jsonResponse = await extractJsonFromResponse(result ?? '');
    return {
      person_name: person.person_name,
      person_position: person.person_position,
      person_image_url: person.person_image_url,
      person_description: jsonResponse.description,
    };
  });

  // Wait for all descriptions to be processed
  const descriptions = await Promise.all(descriptionPromises);
  return descriptions;
};

export {
  firecrawlApp,
  getDescriptions,
  gptCall,
  gptWebSearch,
  model_2_0_flash,
  openaiClient,
};
