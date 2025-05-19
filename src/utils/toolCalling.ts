// import { openaiClient } from "./llmModels";

import dotenv from "dotenv";
import axios from "axios";
import { gptCall, gptCallImage, openaiClient_4o, openaiClient_O3_MINI } from "./llmModels";
import { extractJsonFromResponse } from "./jsonExtractor";
import fs from 'fs';
import path from 'path';

dotenv.config();


const tools = [
  {
    type: "function" as const,
    name: "search_chunks",
    description: "Search for relevant information in PDF documents chunks based on the query.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"],
      additionalProperties: false
    },
    strict: true
  }
];

async function imageToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/jpeg,image/png'
      } 
    });
    
    // Force content type to image/jpeg if not explicitly PNG
    const contentType = response.headers['content-type']?.includes('png') ? 'image/png' : 'image/jpeg';
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    // Validate base64 string
    if (!base64 || base64.length === 0) {
      throw new Error('Empty base64 string');
    }

    // Return proper data URL format
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    // Log some debug info
    console.log('Content-Type:', contentType);
    console.log('Base64 length:', base64.length);
    console.log('First 100 chars of base64:', base64.substring(0, 100));
    
    return dataUrl;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

async function checkImageRelevance(base64Image: string, query: string, type: string): Promise<boolean> {
  try {
    const prompt = `Given the following image of a ${type} from a tourism report and a search query,  determine if the image is relevant to the query or not.
    return only the JSON object : 
    {
      "reason": "reason for the response", 
      "isRelevant": true/false
    }

    Query: "${query}"
    `;

    // Make sure we're using the proper data URL format
    let imageUrl;
    if (base64Image.startsWith('data:')) {
      imageUrl = base64Image;
    } else {
      // Force JPEG if no prefix
      imageUrl = `data:image/jpeg;base64,${base64Image}`;
    }
    
    // Validate the data URL
    if (!imageUrl.match(/^data:(image\/jpeg|image\/png);base64,/)) {
      console.error('Invalid image format. Must be JPEG or PNG');
      return false;
    }

    console.log('Image format:', imageUrl.split(';')[0]);
    console.log('Total image URL length:', imageUrl.length);

    const answer = await gptCallImage(
      "gpt-4.1",
      prompt,
      "user",
      imageUrl
    );

    if (!answer) {
      console.log("No response from vision model");
      return false;
    }

    const jsonResult = await extractJsonFromResponse(answer);
    if (jsonResult) {
      console.log("jsonResult Image", jsonResult);
      return jsonResult.isRelevant;
    }
    return false;
  } catch (error) {
    console.error('Error checking image relevance:', error);
    return false;
  }
}

async function checkTextRelevance(text: string, query: string): Promise<boolean> {
  try {
    const prompt = `Given the following text from a tourism report and a search query, respond with a JSON object containing a single boolean field "isRelevant" indicating if the text is relevant to the query.

Query: "${query}"

Text: "${text}"

Respond only with a JSON object : {"reason": "reason for the response", "isRelevant": true/false}`;

    const response = await gptCall(
      "gpt-4.1-mini",  // modelName
      prompt,     // prompt
      "user"      // specifyRole
    );

    if (!response) {
      console.log("No response from GPT");
      return false;
    }

    const jsonResult = await extractJsonFromResponse(response);
    if (jsonResult) {
      console.log("jsonResult Text", jsonResult);
      return jsonResult.isRelevant;
    }
    return false;
  } catch (error) {
    console.error('Error checking text relevance:', error);
    return false;
  }
}

async function saveImage(base64Data: string, type: string, index: number): Promise<string> {
  try {
    // Create images directory if it doesn't exist
    const imageDir = path.join(process.cwd(), 'saved_results', 'images');
    fs.mkdirSync(imageDir, { recursive: true });

    // Remove the data URL prefix and get just the base64 data
    const base64Image = base64Data.split(';base64,').pop() || '';
    
    // Generate filename
    const filename = `${type}_${index}.png`;
    const filepath = path.join(imageDir, filename);

    // Save the image
    fs.writeFileSync(filepath, base64Image, { encoding: 'base64' });
    
    return filepath;
  } catch (error) {
    console.error(`Error saving ${type} image:`, error);
    throw error;
  }
}

async function saveKeyDataPoints(type: 'table' | 'graph' | 'text', content: string, query: string, index: number): Promise<string | null> {
  try {
    let prompt = '';
    if (type === 'text') {
      prompt = `Analyze the following text input and extract the key data points from the text that are relevant to the query ${query} and prepare a markdown containing table for data pointsand 1-2 line summary. Include:
1. Time period analysis
2. Key metrics and their values
3. Important trends and patterns
4. Regional or segment-specific insights
5. Notable growth indicators (CAGR, YOY)

Input:
${content}

Format the response in markdown with appropriate headers, bullet points, and tables. Include a 1-2 summary.
Make sure to highlight the most significant data points and trends.`;
    } else {
      prompt = `Analyze the following text input and extract the key data points from the text that are relevant to the query ${query} and prepare a markdown containing table for data pointsand 1-2 line summary. Include:
1. Time period analysis
2. Key metrics and their values
3. Important trends and patterns
4. Regional or segment-specific insights
5. Notable growth indicators (CAGR, YOY)

Input:
${content}

Format the response in markdown with appropriate headers, bullet points, and tables. Include a summary section at the top.
Make sure to highlight the most significant data points and trends.`;
    }

    const markdownResponse = await gptCall("gpt-4.1-mini", prompt, "user");
    if (!markdownResponse) return null;

    // Create section header based on content type and index
    const sectionHeader = `\n\n## ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis ${index}\n\n`;
    
    // Return the formatted markdown section
    return sectionHeader + markdownResponse + '\n\n---\n';
    
  } catch (error) {
    console.error(`Error extracting key points from ${type}:`, error);
    return null;
  }
}

async function extractDataFromMarkdown(combinedMarkdown: string, query: string) {
  console.log("inside extractDataFromMarkdown")
  try {
    const dataExtractionPrompt = `You are a financial analyst.

Your task is to thoroughly analyze the entire JSON dataset provided, which contains multiple metrics spanning different years and tables.

Carefully examine and combine data from **all available years and all metrics** in the JSON to derive the best possible metric(s) that answer the user query with a meaningful, comprehensive graph.

You may logically combine, transform, or derive new metrics as needed using **only the numbers explicitly present** anywhere in the JSON dataset.

Do NOT fabricate, assume, or invent any numbers that are not contained in the data.

Return the resulting metric(s) as a JSON object suitable for graphing, including for each metric:

- "name": a descriptive title relevant to the user query,
- "unit": the measurement unit,
- "data": an array of {"timestamp": ..., "value": ...},
- optionally, "growth" or other derived arrays if relevant.

Only output the JSON of the best metric(s) to plot the graph for the user query.

Do not add any explanations, comments, or extra text.

Given:

1. User query describing the desired analysis or graph:  
"${query}"

2. JSON object containing multiple metrics extracted from a detailed markdown report:  
${combinedMarkdown}
`;

    const extractedData = await openaiClient_O3_MINI.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "user",
          content: dataExtractionPrompt
        }
      ],
      reasoning_effort: "high"
    });
    const responseMetric = extractedData.choices[0].message.content;
    console.log("extractedData", responseMetric)
    return responseMetric;
  } catch (error) {
    console.error('Error in data extraction:', error);
    return null;
  }
}

async function createVisualizationAssistant() {
  const assistant = await openaiClient_4o.beta.assistants.create({
    name: "Data Visualization Assistant",
    instructions: `You are a data visualization expert. Your role is to:
1. Analyze provided data and queries
2. Generate appropriate matplotlib visualization in only one graph if multiple metrics are present then use multi line or multi bar graph or any other graph that is appropriate
3. Execute the code and show the results
4. Explain any insights from the visualizations`,
    model: "gpt-4o",
    tools: [{ type: "code_interpreter" }]
  });
  return assistant;
}

async function visualizeData(query: string, extractedData: any) {
  try {
    // Create directory if it doesn't exist
    const visualizationsDir = path.join(process.cwd(), 'saved_results', 'visualizations');
    fs.mkdirSync(visualizationsDir, { recursive: true });

    // Create assistant
    const assistant = await createVisualizationAssistant();
    
    // Create a thread
    const thread = await openaiClient_4o.beta.threads.create();

    // Add the visualization request message
    await openaiClient_4o.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Create a visualization for the following query and data:

Query: ${query}

Data: ${JSON.stringify(extractedData, null, 2)}

Please:
1. Create appropriate matplotlib visualizations
2. Use clear labels, titles, and legends, spacing should be appropriate
3. Show trends and patterns in the data
4. Include growth rates if available
5. Save the visualization with high resolution (dpi=300)`
    });

    // Run the assistant
    const run = await openaiClient_4o.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });

    // Check the run status
    let runStatus = await openaiClient_4o.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status !== "completed") {
      if (runStatus.status === "failed") {
        throw new Error("Assistant run failed");
      }
      
      // Wait for 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openaiClient_4o.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the messages
    const messages = await openaiClient_4o.beta.threads.messages.list(thread.id);
    
    // Find the image file in the message
    const lastMessage = messages.data[0];
    const imageContent = lastMessage.content.find(content => 
      content.type === 'image_file'
    );

    if (imageContent?.type === 'image_file') {
      // Generate a filename based on the query
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `visualization_${timestamp}.png`;
      const filepath = path.join(visualizationsDir, filename);

      // Download the image content
      const response = await openaiClient_4o.files.content(imageContent.image_file.file_id);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));

      console.log(`Visualization saved to: ${filepath}`);

      // Return both the visualization path and the assistant's analysis
      return {
        visualizationPath: filepath,
        analysis: lastMessage.content.find(content => content.type === 'text')?.text || null
      };
    }

    // Clean up
    await openaiClient_4o.beta.assistants.del(assistant.id);
    
    return null;
  } catch (error) {
    console.error('Error in visualization:', error);
    return null;
  }
}

async function searchAllChunks(query: string) {
  try {
    const response = await axios.post('https://chunking-orchestration.bynd.ai/search_chunks_azure_ai_search/', {
      pdf_blob_urls: ["https://byndpdfstorage.blob.core.windows.net/bynd-pdfs/7/182/india_tourism_data_compendium_2024_0_1__1746776510816_7fc8i1/RAW/india_tourism_data_compendium_2024_0_1_.pdf"],
      query: query
    });

    const results = response.data.results.india_tourism_data_compendium_2024_0_1_;
    const markdownSections: string[] = [];
    
    // Process tables, graphs, and texts in parallel
    await Promise.all([
      // Process Tables
      (async () => {
        console.log("\n=== Top 10 Table Nodes ===");
        const top10Tables = results.table_nodes
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10);

        // Process all tables in parallel
        const tableResults = await Promise.all(
          top10Tables.map(async (node, index) => {
            console.log(`\nTable ${index + 1} (Score: ${node.score}):`);
            const base64Image = await imageToBase64(node.table_with_caption);
            const isRelevant = await checkImageRelevance(base64Image, query, "table");
            let imagePath: string | undefined;
            
            if (isRelevant) {
              imagePath = await saveImage(base64Image, 'table', index + 1);
              const markdownSection = await saveKeyDataPoints('table', node.text || '', query, index + 1);
              if (markdownSection) {
                markdownSections.push(markdownSection);
              }
            }
            return { node, isRelevant, index, imagePath };
          })
        );

        // Log results in order
        tableResults.forEach(({ isRelevant, index, imagePath }) => {
          if (isRelevant) {
            console.log(`\nRelevant Table ${index + 1} saved to ${imagePath}`);
          } else {
            console.log(`\nTable ${index + 1} was filtered out as not relevant.`);
          }
        });
      })(),

      // Process Graphs
      (async () => {
        console.log("\n=== Top 10 Graph Nodes ===");
        const top10Graphs = results.graph_nodes
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10);

        // Process all graphs in parallel
        const graphResults = await Promise.all(
          top10Graphs.map(async (node, index) => {
            console.log(`\nGraph ${index + 1} (Score: ${node.score}):`);
            const base64Image = await imageToBase64(node.graph_with_caption);
            const isRelevant = await checkImageRelevance(base64Image, query, "graph");
            let imagePath: string | undefined;

            if (isRelevant) {
              imagePath = await saveImage(base64Image, 'graph', index + 1);
              const markdownSection = await saveKeyDataPoints('graph', node.text || '', query, index + 1);
              if (markdownSection) {
                markdownSections.push(markdownSection);
              }
            }
            return { node, isRelevant, index, imagePath };
          })
        );

        // Log results in order
        graphResults.forEach(({ isRelevant, index, imagePath }) => {
          if (isRelevant) {
            console.log(`\nRelevant Graph ${index + 1} saved to ${imagePath}`);
          } else {
            console.log(`\nGraph ${index + 1} was filtered out as not relevant.`);
          }
        });
      })(),

      // Process Texts
      (async () => {
        console.log("\n=== Top 10 Text Nodes ===");
        const top10Texts = results.text_nodes
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10);

        // Process all texts in parallel
        const textResults = await Promise.all(
          top10Texts.map(async (node, index) => {
            console.log(`\nText ${index + 1} (Score: ${node.score}):`);
            const isRelevant = await checkTextRelevance(node.text, query);
            
            if (isRelevant) {
              const markdownSection = await saveKeyDataPoints('text', node.text, query, index + 1);
              if (markdownSection) {
                markdownSections.push(markdownSection);
              }
            }
            return { node, isRelevant, index };
          })
        );

        // Log results in order
        textResults.forEach(({ isRelevant, index }) => {
          if (isRelevant) {
            console.log(`\nRelevant Text ${index + 1} processed`);
          } else {
            console.log(`\nText ${index + 1} was filtered out as not relevant.`);
          }
        });
      })()
    ]);

    // Combine all markdown sections and extract data
    const combinedMarkdown = markdownSections.join('\n');
    const extractedData = await extractDataFromMarkdown(combinedMarkdown, query);

    if (extractedData) {
      console.log("extractedData", extractedData)
      // Use the OpenAI Assistant to create visualization
      const visualization = await visualizeData(query, extractedData);
      return {
        searchResults: response.data,
        extractedData,
        visualization
      };
    }

    return {
      searchResults: response.data,
      extractedData
    };
  } catch (error) {
    console.error('Error calling search API:', error);
    throw error;
  }
}

async function toolCalling(query: string) {
  try {
    const response = await openaiClient_4o.responses.create({
      model: "gpt-4o",
      input: "you are provided with a function to search the chunks from the annual report of indian tourism ministry, your task is to search the chunks based on the user query , user query is : " + query,
      tools: tools,
      tool_choice: {
        type: "function",
        name: "search_chunks"
      }
    });

    const toolCall = response.output?.[0];
    if (toolCall?.type === 'function_call') {
      const args = JSON.parse(toolCall.arguments);
      console.log("Querry", args.query)
      const searchResults = await searchAllChunks(args.query);
      console.log("Search Results:", searchResults);
    }
  } catch (err: any) {
    console.error("Error:", err);
  }
}

toolCalling("market share of different states" );