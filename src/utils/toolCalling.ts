// import { openaiClient } from "./llmModels";

import dotenv from "dotenv";
import axios from "axios";
import { gptCall, gptCallImage, openaiClient_4o } from "./llmModels";
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

export async function getMostRelevantItem(query: string, items: string[], type: 'graph' | 'table' | 'text'){
  console.log("inside getMostRelevantItem", items)
  const prompt = `Analyze the following markdown content of ${type} and rank the most relevant ones for finding information about the query : ${query}

Return ONLY a JSON array in this exact format — no explanation or extra output:

[
  {
    "reason": "reason for the response",
    "relevance_score": 95,
    "index": 0
  }
]

The index should correspond to the position of the item in the input array.`;

  const response = await gptCall("gpt-4.1-mini", prompt, "user");
  return response;
}

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

async function checkTableRelevance(base64Image: string, query: string): Promise<{relevanceLevel: 'exact' | 'relevant' | 'notRelevant', markdown: string}> {
  try {
    const prompt = `Given the following table image from a tourism report and a search query, determine the relevance level and provide a markdown representation of the table data. Respond with a JSON object containing:
1. "relevanceLevel" - must be exactly one of: "exact", "relevant", or "notRelevant"
2. "markdown" - a markdown formatted representation of the table data

Relevance levels:
"exact" - The table directly and specifically answers the query with precise data
"relevant" - The table contains data related to the query but doesn't directly answer it
"notRelevant" - The table is not related to the query

For the markdown:
- Create a well-formatted markdown table
- Include all headers and data
- Add any relevant notes or context
- Format numbers appropriately
- Include units where applicable

Query: "${query}"

Respond only with a JSON object : {
      "reason": "reason for the response", 
  "relevanceLevel": "exact" | "relevant" | "notRelevant",
  "markdown": "markdown formatted table content"
}`;

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
      return { relevanceLevel: 'notRelevant', markdown: '' };
    }

    console.log('Table Image format:', imageUrl.split(';')[0]);
    console.log('Total table image URL length:', imageUrl.length);

    const answer = await gptCallImage(
      "gpt-4.1",
      prompt,
      "user",
      imageUrl
    );

    if (!answer) {
      console.log("No response from vision model for table");
      return { relevanceLevel: 'notRelevant', markdown: '' };
    }

    const jsonResult = await extractJsonFromResponse(answer);
    if (jsonResult && jsonResult.relevanceLevel) {
      console.log("jsonResult Table", jsonResult);
      return {
        relevanceLevel: jsonResult.relevanceLevel as 'exact' | 'relevant' | 'notRelevant',
        markdown: jsonResult.markdown || ''
      };
    }
    return { relevanceLevel: 'notRelevant', markdown: '' };
  } catch (error) {
    console.error('Error checking table relevance:', error);
    return { relevanceLevel: 'notRelevant', markdown: '' };
  }
}

async function checkGraphRelevance(base64Image: string, query: string): Promise<{relevanceLevel: 'exact' | 'relevant' | 'notRelevant', markdown: string}> {
  try {
    const prompt = `Given the following graph image from a tourism report and a search query, determine the relevance level and provide a markdown description of the graph data. Respond with a JSON object containing:
1. "relevanceLevel" - must be exactly one of: "exact", "relevant", or "notRelevant"
2. "markdown" - a markdown formatted description of the graph data

Relevance levels:
"exact" - The graph directly and specifically answers the query with clear visual data
"relevant" - The graph shows trends or patterns related to the query but doesn't directly answer it
"notRelevant" - The graph is not related to the query

For the markdown:
- Describe the graph type and its purpose
- List key data points and trends
- Include any significant patterns or insights
- Add relevant context and interpretation
- Format numbers and percentages appropriately

    Query: "${query}"

Respond only with a JSON object : {
  "reason": "reason for the response",
  "relevanceLevel": "exact" | "relevant" | "notRelevant",
  "markdown": "markdown formatted graph description"
}`;

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
      return { relevanceLevel: 'notRelevant', markdown: '' };
    }

    console.log('Graph Image format:', imageUrl.split(';')[0]);
    console.log('Total graph image URL length:', imageUrl.length);

    const answer = await gptCallImage(
      "gpt-4.1",
      prompt,
      "user",
      imageUrl
    );

    if (!answer) {
      console.log("No response from vision model for graph");
      return { relevanceLevel: 'notRelevant', markdown: '' };
    }

    const jsonResult = await extractJsonFromResponse(answer);
    if (jsonResult && jsonResult.relevanceLevel) {
      console.log("jsonResult Graph", jsonResult);
      return {
        relevanceLevel: jsonResult.relevanceLevel as 'exact' | 'relevant' | 'notRelevant',
        markdown: jsonResult.markdown || ''
      };
    }
    return { relevanceLevel: 'notRelevant', markdown: '' };
  } catch (error) {
    console.error('Error checking graph relevance:', error);
    return { relevanceLevel: 'notRelevant', markdown: '' };
  }
}

async function checkTextRelevance(text: string, query: string): Promise<{relevanceLevel: 'exact' | 'relevant' | 'notRelevant', markdown: string}> {
  try {
    const prompt = `Given the following text from a tourism report and a search query, determine the relevance level and provide a markdown formatted summary. Respond with a JSON object containing:
1. "relevanceLevel" - must be exactly one of: "exact", "relevant", or "notRelevant"
2. "markdown" - a markdown formatted summary of the text

Relevance levels:
"exact" - The text directly and specifically answers the query
"relevant" - The text is related to the query but doesn't directly answer it
"notRelevant" - The text is not related to the query

For the markdown:
- Create a clear, structured summary
- Highlight key points and data
- Use appropriate markdown formatting (headers, lists, emphasis)
- Include any relevant statistics or metrics
- Add context where necessary

Query: "${query}"

Text: "${text}"

Respond only with a JSON object : {
  "reason": "reason for the response",
  "relevanceLevel": "exact" | "relevant" | "notRelevant",
  "markdown": "markdown formatted summary"
}`;

    const response = await gptCall(
      "gpt-4.1-mini",  // modelName
      prompt,     // prompt
      "user"      // specifyRole
    );

    if (!response) {
      console.log("No response from GPT");
      return { relevanceLevel: 'notRelevant', markdown: '' };
    }

    const jsonResult = await extractJsonFromResponse(response);
    if (jsonResult && jsonResult.relevanceLevel) {
      console.log("jsonResult Text", jsonResult);
      return {
        relevanceLevel: jsonResult.relevanceLevel as 'exact' | 'relevant' | 'notRelevant',
        markdown: jsonResult.markdown || ''
      };
    }
    return { relevanceLevel: 'notRelevant', markdown: '' };
  } catch (error) {
    console.error('Error checking text relevance:', error);
    return { relevanceLevel: 'notRelevant', markdown: '' };
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

// async function saveKeyDataPoints(type: 'table' | 'graph' | 'text', content: string, query: string, index: number): Promise<string | null> {
//   try {
//     let prompt = '';
//     if (type === 'text') {
//       prompt = `Analyze the following text input and extract the key data points from the text that are relevant to the query ${query} and prepare a markdown containing table for data pointsand 1-2 line summary. Include:
// 1. Time period analysis
// 2. Key metrics and their values
// 3. Important trends and patterns
// 4. Regional or segment-specific insights
// 5. Notable growth indicators (CAGR, YOY)

// Input:
// ${content}

// Format the response in markdown with appropriate headers, bullet points, and tables. Include a 1-2 summary.
// Make sure to highlight the most significant data points and trends.`;
//     } else {
//       prompt = `Analyze the following text input and extract the key data points from the text that are relevant to the query ${query} and prepare a markdown containing table for data pointsand 1-2 line summary. Include:
// 1. Time period analysis
// 2. Key metrics and their values
// 3. Important trends and patterns
// 4. Regional or segment-specific insights
// 5. Notable growth indicators (CAGR, YOY)

// Input:
// ${content}

// Format the response in markdown with appropriate headers, bullet points, and tables. Include a summary section at the top.
// Make sure to highlight the most significant data points and trends.`;
//     }

//     const markdownResponse = await gptCall("gpt-4.1-mini", prompt, "user");
//     if (!markdownResponse) return null;

//     // Create section header based on content type and index
//     const sectionHeader = `\n\n## ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis ${index}\n\n`;
    
//     // Return the formatted markdown section
//     return sectionHeader + markdownResponse + '\n\n---\n';
    
//   } catch (error) {
//     console.error(`Error extracting key points from ${type}:`, error);
//     return null;
//   }
// }

// async function extractDataFromMarkdown(combinedMarkdown: string, query: string) {
//   console.log("inside extractDataFromMarkdown")
//   try {
//     const dataExtractionPrompt = `You are a financial analyst.

// Your task is to thoroughly analyze the entire JSON dataset provided, which contains multiple metrics spanning different years and tables.

// Carefully examine and combine data from **all available years and all metrics** in the JSON to derive the best possible metric(s) that answer the user query with a meaningful, comprehensive graph.

// You may logically combine, transform, or derive new metrics as needed using **only the numbers explicitly present** anywhere in the JSON dataset.

// Do NOT fabricate, assume, or invent any numbers that are not contained in the data.

// Return the resulting metric(s) as a JSON object suitable for graphing, including for each metric:

// - "name": a descriptive title relevant to the user query,
// - "unit": the measurement unit,
// - "data": an array of {"timestamp": ..., "value": ...},
// - optionally, "growth" or other derived arrays if relevant.

// Only output the JSON of the best metric(s) to plot the graph for the user query.

// Do not add any explanations, comments, or extra text.

// Given:

// 1. User query describing the desired analysis or graph:  
// "${query}"

// 2. JSON object containing multiple metrics extracted from a detailed markdown report:  
// ${combinedMarkdown}
// `;

//     const extractedData = await openaiClient_O3_MINI.chat.completions.create({
//       model: "o3-mini",
//       messages: [
//         {
//           role: "user",
//           content: dataExtractionPrompt
//         }
//       ],
//       reasoning_effort: "high"
//     });
//     const responseMetric = extractedData.choices[0].message.content;
//     console.log("extractedData", responseMetric)
//     return responseMetric;
//   } catch (error) {
//     console.error('Error in data extraction:', error);
//     return null;
//   }
// }

// async function createVisualizationAssistant() {
//   const assistant = await openaiClient_4o.beta.assistants.create({
//     name: "Data Visualization Assistant",
//     instructions: `You are a data visualization expert. Your role is to:
// 1. Analyze provided data and queries
// 2. Generate appropriate matplotlib visualization in only one graph if multiple metrics are present then use multi line or multi bar graph or any other graph that is appropriate
// 3. Execute the code and show the results
// 4. Explain any insights from the visualizations`,
//     model: "gpt-4o",
//     tools: [{ type: "code_interpreter" }]
//   });
//   return assistant;
// }

// async function visualizeData(query: string, extractedData: any) {
//   try {
//     // Create directory if it doesn't exist
//     const visualizationsDir = path.join(process.cwd(), 'saved_results', 'visualizations');
//     fs.mkdirSync(visualizationsDir, { recursive: true });

//     // Create assistant
//     const assistant = await createVisualizationAssistant();
    
//     // Create a thread
//     const thread = await openaiClient_4o.beta.threads.create();

//     // Add the visualization request message
//     await openaiClient_4o.beta.threads.messages.create(thread.id, {
//       role: "user",
//       content: `Create a visualization for the following query and data:

// Query: ${query}

// Data: ${JSON.stringify(extractedData, null, 2)}

// Please:
// 1. Create appropriate matplotlib visualizations
// 2. Use clear labels, titles, and legends, spacing should be appropriate
// 3. Show trends and patterns in the data
// 4. Include growth rates if available
// 5. Save the visualization with high resolution (dpi=300)`
//     });

//     // Run the assistant
//     const run = await openaiClient_4o.beta.threads.runs.create(thread.id, {
//       assistant_id: assistant.id
//     });

//     // Check the run status
//     let runStatus = await openaiClient_4o.beta.threads.runs.retrieve(thread.id, run.id);
    
//     while (runStatus.status !== "completed") {
//       if (runStatus.status === "failed") {
//         throw new Error("Assistant run failed");
//       }
      
//       // Wait for 1 second before checking again
//       await new Promise(resolve => setTimeout(resolve, 1000));
//       runStatus = await openaiClient_4o.beta.threads.runs.retrieve(thread.id, run.id);
//     }

//     // Get the messages
//     const messages = await openaiClient_4o.beta.threads.messages.list(thread.id);
    
//     // Find the image file in the message
//     const lastMessage = messages.data[0];
//     const imageContent = lastMessage.content.find(content => 
//       content.type === 'image_file'
//     );

//     if (imageContent?.type === 'image_file') {
//       // Generate a filename based on the query
//       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//       const filename = `visualization_${timestamp}.png`;
//       const filepath = path.join(visualizationsDir, filename);

//       // Download the image content
//       const response = await openaiClient_4o.files.content(imageContent.image_file.file_id);
//       const buffer = await response.arrayBuffer();
//       fs.writeFileSync(filepath, Buffer.from(buffer));

//       console.log(`Visualization saved to: ${filepath}`);

//       // Return both the visualization path and the assistant's analysis
//       return {
//         visualizationPath: filepath,
//         analysis: lastMessage.content.find(content => content.type === 'text')?.text || null
//       };
//     }

//     // Clean up
//     await openaiClient_4o.beta.assistants.del(assistant.id);
    
//     return null;
//   } catch (error) {
//     console.error('Error in visualization:', error);
//     return null;
//   }
// }

async function processTables(results: any, query: string): Promise<{exactTables: string[], relevantTables: string[]}> {
  const exactTables: string[] = [];
  const relevantTables: string[] = [];
  let tableToSave: { base64Image: string, index: number } | null = null;

  console.log("\n=== Top 10 Table Nodes ===");
  const top10Tables = results.table_nodes
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 10);

  // Process all tables in parallel
  const tableResults = await Promise.all(
    top10Tables.map(async (node, index) => {
      console.log(`\nTable ${index + 1} (Score: ${node.score}):`);
      const base64Image = await imageToBase64(node.table_with_caption);
      const relevanceResult = await checkTableRelevance(base64Image, query);
      
      if (relevanceResult.relevanceLevel !== 'notRelevant') {
        if (relevanceResult.relevanceLevel === 'exact') {
          exactTables.push(relevanceResult.markdown);
        } else {
          relevantTables.push(relevanceResult.markdown);
        }
      }
      return { node, relevanceResult, index, base64Image };
    })
  );

  // Determine which table to save based on hierarchy
  if (exactTables.length === 1) {
    // If exactly one exact match, save it
    const exactIndex = tableResults.findIndex(result => 
      result.relevanceResult.relevanceLevel === 'exact'
    );
    if (exactIndex !== -1) {
      tableToSave = {
        base64Image: tableResults[exactIndex].base64Image,
        index: exactIndex
      };
    }
  } else if (exactTables.length > 1) {
    try {
      // If multiple exact matches, get most relevant
      const response = await getMostRelevantItem(query, exactTables, 'table');
      const jsonResult = await extractJsonFromResponse(response);
      
      if (jsonResult && Array.isArray(jsonResult) && jsonResult.length > 0) {
        // Find the item with highest relevance score
        const mostRelevant = jsonResult.reduce((prev, current) => 
          (current.relevance_score > prev.relevance_score) ? current : prev,
          jsonResult[0] // Provide initial value
        );
        
        if (mostRelevant && typeof mostRelevant.index === 'number') {
          const exactIndex = tableResults.findIndex(result => 
            result.relevanceResult.relevanceLevel === 'exact'
          );
          if (exactIndex !== -1) {
            tableToSave = {
              base64Image: tableResults[exactIndex].base64Image,
              index: exactIndex
            };
          }
        }
      }
    } catch (error) {
      console.error('Error processing exact tables:', error);
      // Fallback to first exact match if processing fails
      const exactIndex = tableResults.findIndex(result => 
        result.relevanceResult.relevanceLevel === 'exact'
      );
      if (exactIndex !== -1) {
        tableToSave = {
          base64Image: tableResults[exactIndex].base64Image,
          index: exactIndex
        };
      }
    }
  } else if (exactTables.length === 0) {
    // No exact matches, check relevant matches
    if (relevantTables.length === 1) {
      // If exactly one relevant match, save it
      const relevantIndex = tableResults.findIndex(result => 
        result.relevanceResult.relevanceLevel === 'relevant'
      );
      if (relevantIndex !== -1) {
        tableToSave = {
          base64Image: tableResults[relevantIndex].base64Image,
          index: relevantIndex
        };
      }
    } else if (relevantTables.length > 1) {
      try {
        // If multiple relevant matches, get most relevant
        const response = await getMostRelevantItem(query, relevantTables, 'table');
        const jsonResult = await extractJsonFromResponse(response);
        
        if (jsonResult && Array.isArray(jsonResult) && jsonResult.length > 0) {
          // Find the item with highest relevance score
          const mostRelevant = jsonResult.reduce((prev, current) => 
            (current.relevance_score > prev.relevance_score) ? current : prev,
            jsonResult[0] // Provide initial value
          );
          
          if (mostRelevant && typeof mostRelevant.index === 'number') {
            const relevantIndex = tableResults.findIndex(result => 
              result.relevanceResult.relevanceLevel === 'relevant'
            );
            if (relevantIndex !== -1) {
              tableToSave = {
                base64Image: tableResults[relevantIndex].base64Image,
                index: relevantIndex
              };
            }
          }
        }
      } catch (error) {
        console.error('Error processing relevant tables:', error);
        // Fallback to first relevant match if processing fails
        const relevantIndex = tableResults.findIndex(result => 
          result.relevanceResult.relevanceLevel === 'relevant'
        );
        if (relevantIndex !== -1) {
          tableToSave = {
            base64Image: tableResults[relevantIndex].base64Image,
            index: relevantIndex
          };
        }
      }
    }
  }

  // Save the selected table if any
  if (tableToSave) {
    await saveImage(tableToSave.base64Image, 'table', tableToSave.index + 1);
  }

  // Log results in order
  tableResults.forEach(({ relevanceResult, index }) => {
    if (relevanceResult.relevanceLevel !== 'notRelevant') {
      console.log(`\n${relevanceResult.relevanceLevel.toUpperCase()} Table ${index + 1} processed`);
    } else {
      console.log(`\nTable ${index + 1} was filtered out as not relevant.`);
    }
  });

  return { exactTables, relevantTables };
}

async function processGraphs(results: any, query: string): Promise<{exactGraphs: string[], relevantGraphs: string[]}> {
  const exactGraphs: string[] = [];
  const relevantGraphs: string[] = [];
  let graphToSave: { base64Image: string, index: number } | null = null;

  console.log("\n=== Top 10 Graph Nodes ===");
  const top10Graphs = results.graph_nodes
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 10);

  // Process all graphs in parallel
  const graphResults = await Promise.all(
    top10Graphs.map(async (node, index) => {
      console.log(`\nGraph ${index + 1} (Score: ${node.score}):`);
      const base64Image = await imageToBase64(node.graph_with_caption);
      const relevanceResult = await checkGraphRelevance(base64Image, query);

      if (relevanceResult.relevanceLevel !== 'notRelevant') {
        if (relevanceResult.relevanceLevel === 'exact') {
          exactGraphs.push(relevanceResult.markdown);
        } else {
          relevantGraphs.push(relevanceResult.markdown);
        }
      }
      return { node, relevanceResult, index, base64Image };
    })
  );

  // Determine which graph to save based on hierarchy
  if (exactGraphs.length === 1) {
    // If exactly one exact match, save it
    const exactIndex = graphResults.findIndex(result => 
      result.relevanceResult.relevanceLevel === 'exact'
    );
    if (exactIndex !== -1) {
      graphToSave = {
        base64Image: graphResults[exactIndex].base64Image,
        index: exactIndex
      };
    }
  } else if (exactGraphs.length > 1) {
    try {
      // If multiple exact matches, get most relevant
      const response = await getMostRelevantItem(query, exactGraphs, 'graph');
      const jsonResult = await extractJsonFromResponse(response);
      
      if (jsonResult && Array.isArray(jsonResult) && jsonResult.length > 0) {
        // Find the item with highest relevance score
        const mostRelevant = jsonResult.reduce((prev, current) => 
          (current.relevance_score > prev.relevance_score) ? current : prev,
          jsonResult[0] // Provide initial value
        );
        
        if (mostRelevant && typeof mostRelevant.index === 'number') {
          const exactIndex = graphResults.findIndex(result => 
            result.relevanceResult.relevanceLevel === 'exact'
          );
          if (exactIndex !== -1) {
            graphToSave = {
              base64Image: graphResults[exactIndex].base64Image,
              index: exactIndex
            };
          }
        }
      }
    } catch (error) {
      console.error('Error processing exact graphs:', error);
      // Fallback to first exact match if processing fails
      const exactIndex = graphResults.findIndex(result => 
        result.relevanceResult.relevanceLevel === 'exact'
      );
      if (exactIndex !== -1) {
        graphToSave = {
          base64Image: graphResults[exactIndex].base64Image,
          index: exactIndex
        };
      }
    }
  } else if (exactGraphs.length === 0) {
    // No exact matches, check relevant matches
    if (relevantGraphs.length === 1) {
      // If exactly one relevant match, save it
      const relevantIndex = graphResults.findIndex(result => 
        result.relevanceResult.relevanceLevel === 'relevant'
      );
      if (relevantIndex !== -1) {
        graphToSave = {
          base64Image: graphResults[relevantIndex].base64Image,
          index: relevantIndex
        };
      }
    } else if (relevantGraphs.length > 1) {
      try {
        // If multiple relevant matches, get most relevant
        const response = await getMostRelevantItem(query, relevantGraphs, 'graph');
        const jsonResult = await extractJsonFromResponse(response);
        
        if (jsonResult && Array.isArray(jsonResult) && jsonResult.length > 0) {
          // Find the item with highest relevance score
          const mostRelevant = jsonResult.reduce((prev, current) => 
            (current.relevance_score > prev.relevance_score) ? current : prev,
            jsonResult[0] // Provide initial value
          );
          
          if (mostRelevant && typeof mostRelevant.index === 'number') {
            const relevantIndex = graphResults.findIndex(result => 
              result.relevanceResult.relevanceLevel === 'relevant'
            );
            if (relevantIndex !== -1) {
              graphToSave = {
                base64Image: graphResults[relevantIndex].base64Image,
                index: relevantIndex
              };
            }
          }
        }
      } catch (error) {
        console.error('Error processing relevant graphs:', error);
        // Fallback to first relevant match if processing fails
        const relevantIndex = graphResults.findIndex(result => 
          result.relevanceResult.relevanceLevel === 'relevant'
        );
        if (relevantIndex !== -1) {
          graphToSave = {
            base64Image: graphResults[relevantIndex].base64Image,
            index: relevantIndex
          };
        }
      }
    }
  }

  // Save the selected graph if any
  if (graphToSave) {
    await saveImage(graphToSave.base64Image, 'graph', graphToSave.index + 1);
  }

  // Log results in order
  graphResults.forEach(({ relevanceResult, index }) => {
    if (relevanceResult.relevanceLevel !== 'notRelevant') {
      console.log(`\n${relevanceResult.relevanceLevel.toUpperCase()} Graph ${index + 1} processed`);
    } else {
      console.log(`\nGraph ${index + 1} was filtered out as not relevant.`);
    }
  });

  return { exactGraphs, relevantGraphs };
}

async function processTexts(results: any, query: string): Promise<{exactTexts: string[], relevantTexts: string[]}> {
  const exactTexts: string[] = [];
  const relevantTexts: string[] = [];

        console.log("\n=== Top 10 Text Nodes ===");
        const top10Texts = results.text_nodes
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 10);

        // Process all texts in parallel
        const textResults = await Promise.all(
          top10Texts.map(async (node, index) => {
            console.log(`\nText ${index + 1} (Score: ${node.score}):`);
      const relevanceResult = await checkTextRelevance(node.text, query);
      
      if (relevanceResult.relevanceLevel !== 'notRelevant') {
        if (relevanceResult.relevanceLevel === 'exact') {
          exactTexts.push(relevanceResult.markdown);
        } else {
          relevantTexts.push(relevanceResult.markdown);
        }
      }
      return { node, relevanceResult, index };
          })
        );

        // Log results in order
  textResults.forEach(({ relevanceResult, index }) => {
    if (relevanceResult.relevanceLevel !== 'notRelevant') {
      console.log(`\n${relevanceResult.relevanceLevel.toUpperCase()} Text ${index + 1} processed`);
          } else {
            console.log(`\nText ${index + 1} was filtered out as not relevant.`);
          }
        });

  return { exactTexts, relevantTexts };
}

async function searchAllChunks(query: string, searchTables: boolean = true, searchGraphs: boolean = true, searchTexts: boolean = true) {
  try {
    const response = await axios.post('https://chunking-orchestration.bynd.ai/search_chunks_azure_ai_search/', {
      pdf_blob_urls: ["https://byndpdfstorage.blob.core.windows.net/bynd-pdfs/7/182/india_tourism_data_compendium_2024_0_1__1746776510816_7fc8i1/RAW/india_tourism_data_compendium_2024_0_1_.pdf"],
      query: query
    });

    const results = response.data.results.india_tourism_data_compendium_2024_0_1_;
    
    // Initialize arrays for different relevance levels
    const exactTables: string[] = [];
    const relevantTables: string[] = [];
    const exactGraphs: string[] = [];
    const relevantGraphs: string[] = [];
    const exactTexts: string[] = [];
    const relevantTexts: string[] = [];

    // Create an array of promises based on which types to search
    const searchPromises = [];
    
    if (searchTables) {
      searchPromises.push(
        (async () => {
          const tableResults = await processTables(results, query);
          exactTables.push(...tableResults.exactTables);
          relevantTables.push(...tableResults.relevantTables);
        })()
      );
    }

    if (searchGraphs) {
      searchPromises.push(
        (async () => {
          const graphResults = await processGraphs(results, query);
          exactGraphs.push(...graphResults.exactGraphs);
          relevantGraphs.push(...graphResults.relevantGraphs);
        })()
      );
    }

    if (searchTexts) {
      searchPromises.push(
        (async () => {
          const textResults = await processTexts(results, query);
          exactTexts.push(...textResults.exactTexts);
          relevantTexts.push(...textResults.relevantTexts);
        })()
      );
    }

    // Wait for all selected searches to complete
    await Promise.all(searchPromises);

    return {
      searchResults: response.data,
      exactTables,
      relevantTables,
      exactGraphs,
      relevantGraphs,
      exactTexts,
      relevantTexts
    };
  } catch (error) {
    console.error('Error calling search API:', error);
    throw error;
  }
}

export async function toolCalling(query: string, searchTables: boolean = true, searchGraphs: boolean = true, searchTexts: boolean = true) {
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
      console.log("Query:", args.query);
      console.log("Search Configuration:", {
        tables: searchTables,
        graphs: searchGraphs,
        texts: searchTexts
      });
      
      const searchResults = await searchAllChunks(
        args.query,
        searchTables,
        searchGraphs,
        searchTexts
      );
      
      console.log("Search Results:", searchResults);
      return searchResults;
    }
  } catch (err: any) {
    console.error("Error:", err);
    throw err;
  }
}

