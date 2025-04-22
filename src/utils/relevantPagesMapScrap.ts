import FirecrawlApp, {
    MapResponse,
    ScrapeResponse,
  } from '@mendable/firecrawl-js';
  import dotenv from 'dotenv';
  import { extractJsonFromResponse } from './jsonExtractor';
  import { firecrawlApp, gptCall, model_2_0_flash } from './llmModels';
  
  dotenv.config();
  
  interface RankedResult {
    url: string;
    relevance_score: number;
    reason: string;
  }

  async function checkRelevantLink(
    link: string,
  ): Promise<Record<string, any>> {
    const prompt = `
      Analyze the URL and determine if it is likely to contain the documents that can help in industry analysis such as reports, annual reports, publications, industry reports, mission plan, financial reports, etc.
      URL: ${link}
      RESPOND ONLY WITH JSON format no other text or explanation.
      {
        "url": "${link}",
        "reason": "reason for the response",
        "isRelevant": true/false
      }`;
    const result = await gptCall('gpt-4o', prompt, 'system');
    const jsonResult = await extractJsonFromResponse(result);
    return jsonResult;
  }

  async function getPdfUrls(markdown: string, link: string): Promise<any> {
    const pdfUrlPrompt = ` 
    You are a data extraction assistant helping to analyze a government or institutional webpage provided in Markdown format.

Your task is to extract only the relevant PDF document links that can support industry analysis, such as:
- Annual Reports
- Financial Reports
- Sectoral Publications
- Mission Plans
- Whitepapers
- Industry Strategy Documents

Ignore any links that do not end in .pdf.

For each PDF link found, extract and return the following structured JSON object:

{
  "sourceUrl": "${link}",
  "documents": [
    {
      "year": 2022,                      // Extract from the filename or context. Leave null if not found.
      "name": "Annual Report 2021-22",   // Use link text or infer from filename
      "type": "Annual Report",           // Use keywords to classify (Annual Report, Mission Plan, etc.)
      "description": "Short one-line summary of the document's purpose or content", // Use nearby text
      "documentUrl": "https://actual-domain.com/report2022.pdf"  // The actual PDF URL from the markdown
    }
  ]
}

Important Instructions:
- Only include documents that help in industry or market analysis.
- The type should be inferred if possible using keywords in the document name or nearby text.
- The description should be concise (1 sentence max), extracted from surrounding paragraph/list text if available.
- Ensure documentUrl always ends in .pdf.
- Only include actual PDF URLs found in the markdown content.
- Do not include any example URLs or placeholder URLs.

Use this format exactly. Do not add extra commentary or explanation.`;

    const prompt = pdfUrlPrompt + '\n\nwebsite - markdown data: ' + markdown;
    const result = await gptCall('gpt-4.1', prompt, 'system');
    
    if (!result || result === 'Objective not met') {
      return null;
    }

    try {
      const jsonResult = await extractJsonFromResponse(result);
      console.log('jsonResult from getPdfUrls', jsonResult);
      return jsonResult;
    } catch (error) {
      console.error('Error in parsing PDF response:', error);
      return null;
    }
  }

  async function getNonPdfUrls(markdown: string): Promise<any> {
    const nonPdfUrlPrompt = `
    You are an intelligent web assistant that processes Markdown content from government, institutional, or company websites.

Your task is to extract **only the links** (URLs) that are **likely to lead to pages containing important documents** for industry research and analysis, such as:
- Annual Reports
- Publications
- Financial Reports
- Whitepapers
- Mission Plans
- Strategy Documents
- Sector/Industry Reports
- Archives or Reports Pages

Instructions:
1. **Ignore** any links that point directly to .pdf files (those are handled in a separate step).
2. **Only return** links that likely **lead to** document repositories or report listing pages (e.g., pages with headings like "Reports", "Publications", "Documents", "Resources", "Archives", "Downloads", etc.).
3. Return a JSON array under the key possibleUrls containing only the actual URLs found in the provided markdown content.
4. Do not include any example URLs or placeholder URLs.
5. Only include URLs that are actually present in the markdown content.

Return the response in this exact format:
{
  "possibleUrls": [
    // List of actual URLs found in the markdown content otherwise return an empty array
  ]
}`;

    const result = await gptCall('gpt-4.1', nonPdfUrlPrompt, 'system');
    
    if (!result) {
      return null;
    }

    try {
      const jsonResult = await extractJsonFromResponse(result);
      console.log('jsonResult from getNonPdfUrls', jsonResult);
      return jsonResult;
    } catch (error) {
      console.error('Error in parsing non-PDF response:', error);
      return null;
    }
  }

  async function bothUrl(links: string[]) {
    try {
      if (!links || links.length === 0) {
        console.log('No links found to analyze.');
        return null;
      }
      console.log(`\n=== Starting analysis of ${links.length} initial links ===`);
      console.log('Initial links:', links);

      const foundDocuments = [];
      const allDocumentUrls = new Set(); // Using Set to automatically handle duplicates
      
      // Process all links asynchronously
      const processingPromises = links.map(async (link) => {
        try {
          console.log(`\n=== Processing initial link: ${link} ===`);
          
          // Scrape the current link
          console.log('Scraping content from link...');
          const markdown = await scrapeUrlAsync(firecrawlApp, link);
          
          if (!markdown) {
            console.log(`❌ No content found for link: ${link}`);
            return null;
          }
          console.log('✅ Successfully scraped content from link');

          // Get PDF URLs
          console.log('Extracting PDF documents from content...');
          const pdfResult = await getPdfUrls(markdown, link);
          if (pdfResult && pdfResult.documents && pdfResult.documents.length > 0) {
            console.log(`✅ Found ${pdfResult.documents.length} PDF documents in initial link`);
            foundDocuments.push(pdfResult);
            
            pdfResult.documents.forEach(doc => {
              if (doc.documentUrl) {
                allDocumentUrls.add(doc.documentUrl);
              }
            });
          } else {
            console.log('❌ No PDF documents found in initial link');
          }

          // Get non-PDF URLs
          console.log('Extracting non-PDF URLs from content...');
          const nonPdfResult = await getNonPdfUrls(markdown);
          if (nonPdfResult && nonPdfResult.possibleUrls) {
            console.log(`Found ${nonPdfResult.possibleUrls.length} potential non-PDF URLs`);
            
            // Check relevancy of non-PDF URLs
            console.log('Checking relevancy of non-PDF URLs...');
            const relevancyChecks = await Promise.all(
              nonPdfResult.possibleUrls.map(async (url) => {
                const relevancyResult = await checkRelevantLink(url);
                return {
                  url,
                  isRelevant: relevancyResult.isRelevant,
                  reason: relevancyResult.reason
                };
              })
            );

            // Filter out non-relevant URLs
            const relevantNonPdfUrls = relevancyChecks
              .filter(check => check.isRelevant)
              .map(check => check.url);

            console.log(`Found ${relevantNonPdfUrls.length} relevant non-PDF URLs`);

            if (relevantNonPdfUrls.length > 0) {
              console.log('\n=== Processing relevant non-PDF URLs ===');
              
              // Process each relevant non-PDF URL
              const secondIterationPromises = relevantNonPdfUrls.map(async (url) => {
                try {
                  console.log(`\nProcessing non-PDF URL: ${url}`);
                  console.log('Scraping content from non-PDF URL...');
                  const secondMarkdown = await scrapeUrlAsync(firecrawlApp, url);
                  
                  if (!secondMarkdown) {
                    console.log(`❌ No content found for non-PDF URL: ${url}`);
                    return null;
                  }
                  console.log('✅ Successfully scraped content from non-PDF URL');

                  // Get PDF URLs from the non-PDF URL
                  console.log('Extracting PDF documents from non-PDF URL...');
                  const secondPdfResult = await getPdfUrls(secondMarkdown, url);
                  if (secondPdfResult && secondPdfResult.documents && secondPdfResult.documents.length > 0) {
                    console.log(`✅ Found ${secondPdfResult.documents.length} additional PDF documents`);
                    foundDocuments.push(secondPdfResult);
                    
                    secondPdfResult.documents.forEach(doc => {
                      if (doc.documentUrl) {
                        allDocumentUrls.add(doc.documentUrl);
                      }
                    });
                  } else {
                    console.log('❌ No PDF documents found in non-PDF URL');
                  }
                  return secondPdfResult;
                } catch (error) {
                  console.error(`❌ Error processing non-PDF URL ${url}:`, error);
                  return null;
                }
              });

              // Wait for all second iteration processing to complete
              await Promise.all(secondIterationPromises);
              console.log('=== Completed processing of non-PDF URLs ===\n');
            }
          } else {
            console.log('❌ No non-PDF URLs found in initial link');
          }

          return pdfResult;
        } catch (error) {
          console.error(`❌ Error processing link ${link}:`, error);
          return null;
        }
      });

      // Wait for all processing to complete
      console.log('\n=== Waiting for all processing to complete ===');
      await Promise.all(processingPromises);
      
      // Convert Set to Array and log all unique document URLs
      const uniqueDocumentUrls = Array.from(allDocumentUrls);

      if (foundDocuments.length > 0) {
        console.log('\n=== Final Results ===');
        console.log(`✅ Found ${foundDocuments.length} document sets with ${uniqueDocumentUrls.length} unique PDF documents`);
        console.log('Found documents:', foundDocuments);
        return foundDocuments;
      } else {
        console.log('\n=== Final Results ===');
        console.log('❌ No documents found in any of the processed pages');
        return null;
      }
    } catch (error) {
      console.error('❌ Error encountered during page analysis:', error);
      return null;
    }
  }

  async function filterDocuments(documents: any[]) {
    if (!documents || documents.length === 0) {
      console.log('No documents to filter');
      return null;
    }

    const filterPrompt = `
You are assisting in curating a high-quality dataset of documents useful for industry analysis at the national level.

You are given a JSON object containing:
- sourceUrl: the original page where the documents were found
- documents: a list of documents, each with a year, name, type, description, and documentUrl

Your task is to filter and return only the documents that meet all of the following conditions:

1. Are highly relevant for industry analysis, such as:
   - Sectoral and industry-specific reports
   - Annual or financial reports of ministries or national-level industry bodies
   - Mission plans and strategic roadmaps
   - Whitepapers and publications with analytical or statistical insights

2. Are recent, i.e., published in the year 2021 or later

3. Are national in scope — exclude any documents that are:
   - Published by or for state governments
   - Focused on a specific state or region
   - Contain mentions in the title or description such as names of Indian states, state departments, or state-level programs

4. Exclude any documents that are:
   - General notices, circulars, tenders, guidelines, or operational memos
   - Administrative documents not useful for industry analysis

5. Only include documents that are in English. Exclude documents that are in Hindi, bilingual (e.g., Hindi-English), or any language other than English.

6. Remove any duplicate documentUrls. If the same document appears under multiple sourceUrls, retain it only under the sourceUrl that makes the most sense — for example, if an annual report appears under both a general bulletin page and a dedicated annual reports page, keep it only under the annual reports page and remove it from the bulletin source.

Return only the filtered documents in the same structure, like this:

{
  "sourceUrl": "...",
  "documents": [
    {
      "year": ,
      "name": "",
      "type": "",
      "description": "",
      "documentUrl": ""
    }
  ]
}

Do not include any documents that do not meet all of the above criteria. Do not include any explanation or commentary — just return the filtered JSON object.`;

    try {
      const finalResult = await gptCall('gpt-4.1', filterPrompt + '\n\n' + JSON.stringify(documents, null, 2), 'system');
      const finalJsonResult = await extractJsonFromResponse(finalResult);
      console.log('finalJsonResult from filterDocuments', finalJsonResult);
      if (!finalJsonResult) {
        console.log('No valid documents found in filtered results');
        return null;
      }

      // Handle both single object and array of objects
      const results = Array.isArray(finalJsonResult) ? finalJsonResult : [finalJsonResult];
      
      // Extract all document URLs
      const allDocumentUrls = results.reduce((urls, result) => {
        if (result.documents && Array.isArray(result.documents)) {
          return urls.concat(result.documents.map(doc => doc.documentUrl));
        }
        return urls;
      }, []);

      console.log('All document URLs from final results:', allDocumentUrls);
      return results;
    } catch (error) {
      console.error('Error in filterDocuments:', error);
      return null;
    }
  }
  
  async function rankLinks(
    links: string[],
    objective: string,
  ): Promise<string[] | null> {
    const rankPrompt = `RESPOND ONLY WITH JSON.
      Analyze these URLs and rank the most relevant ones for finding information about: ${objective}
  
      Return ONLY a JSON array in this exact format - no other text or explanation:
      [
          {
              "url": "http://example.com",
              "relevance_score": 95,
              "reason": "Main about page with company information"
          },
  
      ]
  
      URLs to analyze:
      ${JSON.stringify(links, null, 2)}`;
  
    try {
      const response = await model_2_0_flash.generateContent(rankPrompt);
      const responseText = response.response.text().trim();
      console.log('this is responseText', responseText);
      const rankedResults = await extractJsonFromResponse(responseText);
  
      // Sort by relevance score and filter for scores >= 60
      rankedResults.sort(
        (a: RankedResult, b: RankedResult) =>
          b.relevance_score - a.relevance_score,
      );
      const relevantResults = rankedResults.filter(
        (result: RankedResult) => result.relevance_score >= 60,
      );
  
      return relevantResults.map((result: RankedResult) => result.url);
    } catch (error) {
      console.error('Error ranking URLs:', error);
      return null;
    }
  }
  
  async function scrapeUrlAsync(
    app: FirecrawlApp,
    link: string,
  ): Promise<string | null> {
    console.log(`Initiating scrape of page: ${link}`);
  
    // Function to try scraping with a given URL
    async function tryScrape(
      url: string,
      retryCount = 0,
      maxRetries = 2,
    ): Promise<[string | null, boolean]> {
      try {
        const scrapeResult = (await app.scrapeUrl(url, {
          formats: ["markdown"],
          onlyMainContent: false
        })) as ScrapeResponse;
        const pageMarkdown = scrapeResult.markdown || '';
        // console.log('pageMarkdown', pageMarkdown);
        // Check for common error indicators in the markdown content
        const errorIndicators = [
          '404',
          "page can't be found",
          'No webpage was found',
          'HTTP ERROR',
          'Page Not Found',
        ];
  
        if (
          errorIndicators.some((indicator) =>
            pageMarkdown.toLowerCase().includes(indicator.toLowerCase()),
          )
        ) {
          return [null, true]; // Error detected
        }
  
        return [pageMarkdown, false];
      } catch (error: any) {
        const errorMsg = error.toString();
        if (
          (/status code[:\s]*(?:429|408)/.test(errorMsg.toLowerCase()) ||
            errorMsg.toLowerCase().includes('rate limit exceeded')) &&
          retryCount < maxRetries
        ) {
          console.log(
            `Rate limit hit on ${url}. Waiting 40 seconds before retrying... (Attempt ${retryCount + 1} of ${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 40000));
          return await tryScrape(url, retryCount + 1, maxRetries);
        }
  
        // For non-rate limit errors or exceeding max retries
        console.error(`Error scraping ${url}: ${errorMsg}`);
        return [null, true];
      }
    }
  
    // Try original URL
    const [pageMarkdown, errorDetected] = await tryScrape(link);
    if (!errorDetected && pageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${link}:\n${pageMarkdown}\n---\n`;
    }
  
    console.log(`Error detected for ${link}, trying alternative URLs...`);
  
    // Try with modified URL (adding/removing trailing slash)
    const modifiedLink = link.endsWith('/') ? link.slice(0, -1) : link + '/';
    console.log(`Retrying scrape with modified URL: ${modifiedLink}`);
    const [modifiedPageMarkdown, modifiedErrorDetected] =
      await tryScrape(modifiedLink);
    if (!modifiedErrorDetected && modifiedPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${modifiedLink}:\n${modifiedPageMarkdown}\n---\n`;
    }
  
    console.log(
      `Error detected for modified URL, trying HTTP/HTTPS protocol switch...`,
    );
  
    // Try both slash variations with opposite protocol
    const protocolModifiedLink = modifiedLink.startsWith('http://')
      ? modifiedLink.replace('http://', 'https://')
      : modifiedLink.replace('https://', 'http://');
    const protocolModifiedLinkNoSlash = protocolModifiedLink.endsWith('/')
      ? protocolModifiedLink.slice(0, -1)
      : protocolModifiedLink + '/';
  
    // Try with protocol modified URL (with slash)
    console.log(
      `Retrying scrape with protocol modified URL (with slash): ${protocolModifiedLink}`,
    );
    const [protocolPageMarkdown, protocolErrorDetected] =
      await tryScrape(protocolModifiedLink);
    if (!protocolErrorDetected && protocolPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${protocolModifiedLink}:\n${protocolPageMarkdown}\n---\n`;
    }
  
    // Try with protocol modified URL (without slash)
    console.log(
      `Retrying scrape with protocol modified URL (without slash): ${protocolModifiedLinkNoSlash}`,
    );
    const [protocolNoSlashPageMarkdown, protocolNoSlashErrorDetected] =
      await tryScrape(protocolModifiedLinkNoSlash);
    if (!protocolNoSlashErrorDetected && protocolNoSlashPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${protocolModifiedLinkNoSlash}:\n${protocolNoSlashPageMarkdown}\n---\n`;
    }
  
    console.log('All URL variations failed, skipping...');
    return null;
  }
  
  async function findRelevantPageViaMap(
    objective: string,
    url: string,
  ): Promise<string[] | null> {
    try {
  
      console.log('Analyzing objective to determine optimal search parameter...');
  
      const mapWebsite = (await firecrawlApp.mapUrl(url, {
        includeSubdomains: true,
        search: objective
      })) as MapResponse;
      const filteredPages = [...(mapWebsite.links || [])].filter(
        (page) => !String(page).toLowerCase().endsWith('.pdf'),
      );
  
      if (!filteredPages.length) {
        console.log('No links found in map response.');
        return null;
      }
  
      const relevantLinks = await rankLinks(filteredPages, objective);
  
      if (!relevantLinks) {
        console.log('No relevant links found.');
        return null;
      }
  
      console.log(`Found ${relevantLinks.length} relevant links.`);
      return relevantLinks;
    } catch (error) {
      console.error(
        'Error encountered during relevant page identification:',
        error,
      );
      return null;
    }
  }
  export {
    findRelevantPageViaMap,
    scrapeUrlAsync,
    bothUrl,
    filterDocuments,
  };
  