import FirecrawlApp, {
    MapResponse,
    ScrapeResponse,
  } from '@mendable/firecrawl-js';
  import dotenv from 'dotenv';
  import { extractJsonFromResponse } from './jsonExtractor';
  import { firecrawlApp, gptCall } from './llmModels';
  import { saveFailedUrl } from './failedUrls';
  
  dotenv.config();
  
  interface RankedResult {
    url: string;
    relevance_score: number;
    reason: string;
  }

  interface Document {
    year: number;
    name: string;
    documentUrl: string;
  }

  interface DocumentSet {
    sourceUrl: string;
    documents: Document[];
  }

  async function checkRelevantLink(
    link: string,
  ): Promise<Record<string, any>> {
    const prompt = `
      Analyze the URL and determine if it is likely to contain the documents that can help in industry analysis such as reports, annual reports, publications, industry reports, mission plan, financial reports, etc.
      URL: ${link}
      RESPOND ONLY WITH JSON format no other text or explanation.
      {
        "reason": "reason for the response",
        "isRelevant": true/false
      }`;
    const result = await gptCall('gpt-4.1-mini', prompt, 'user');
    const jsonResult = await extractJsonFromResponse(result);
    console.log('jsonResult from checkRelevantLink', link, jsonResult);
    return jsonResult;
  }

  async function getPdfUrls(markdown: string, prompt: string, retryCount = 0): Promise<any> {
    const fullPrompt = `${prompt}\n\nwebsite - markdown data: ${markdown}`;
    const result = await gptCall('gpt-4.1-mini', fullPrompt, 'user');
    
    if (!result || result === 'Objective not met') {
        console.log('No response received from LLM');
        return null;
    }

    try {
        const jsonResult = await extractJsonFromResponse(result);
        if (!jsonResult || !jsonResult.documents || !Array.isArray(jsonResult.documents)) {
            console.log('Invalid JSON structure received from LLM in getPdfUrls', jsonResult);
            if (retryCount < 2) { // Maximum 2 retries
                console.log(`Retrying PDF extraction (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                return getPdfUrls(markdown, prompt, retryCount + 1);
            }
            console.log('Max retries reached for PDF extraction');
            return null;
        }
        // Filter out documents where documentUrl doesn't end with .pdf
        jsonResult.documents = jsonResult.documents.filter(doc => 
          (doc.documentUrl.toLowerCase().endsWith('.pdf')) && 
          (doc.name !== '')
        );
        
        // If no documents remain after filtering, return null
        if (!jsonResult.documents || jsonResult.documents.length === 0) {
            console.log('No PDF documents found after filtering');
            return null;
        }

        // Deduplicate documents based on their URLs
        const uniqueDocuments = Array.from(
            new Map(jsonResult.documents.map(doc => [doc.documentUrl, doc])).values()
        );
        jsonResult.documents = uniqueDocuments;
        
        console.log('Successfully extracted PDF URLs:', jsonResult);
        return jsonResult;
    } catch (error) {
        console.error('Error parsing JSON response:', error);
        if (retryCount < 2) {
            console.log(`Retrying PDF extraction after error (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return getPdfUrls(markdown, prompt, retryCount + 1);
        }
        console.log('Max retries reached for PDF extraction after error');
        return null;
    }
  }

  async function getNonPdfUrls(markdown: string, prompt: string, retryCount = 0): Promise<any> {
    const fullPrompt = `${prompt}\n\nwebsite - markdown data: ${markdown}`;
    const result = await gptCall('gpt-4.1-mini', fullPrompt, 'user');
    
    if (!result) {
        console.log('No response received from LLM');
        if (retryCount < 2) {
            console.log(`Retrying non-PDF URL extraction (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return getNonPdfUrls(markdown, prompt, retryCount + 1);
        }
        console.log('Max retries reached for non-PDF URL extraction');
        return { urls: [] };
    }

    try {
        const jsonResult = await extractJsonFromResponse(result);
        if (!jsonResult || !Array.isArray(jsonResult)) {
            console.log('Invalid JSON structure received from LLM in getNonPdfUrls', jsonResult);
            if (retryCount < 2) {
                console.log(`Retrying non-PDF URL extraction (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return getNonPdfUrls(markdown, prompt, retryCount + 1);
            }
            console.log('Max retries reached for non-PDF URL extraction');
            return { urls: [] };
        }

        // Filter out URLs that end with .pdf and ensure each item has required fields
        const filteredUrls = jsonResult
            .filter(item => 
                item.url && 
                !item.url.toLowerCase().endsWith('.pdf')
            );
        
        // If no URLs remain after filtering, return empty array
        if (filteredUrls.length === 0) {
            console.log('No non-PDF URLs found after filtering');
            return { urls: [] };
        }
        
        console.log('Successfully extracted non-PDF URLs:', filteredUrls);
        return { urls: filteredUrls };
    } catch (error) {
        console.error('Error parsing JSON response:', error);
        if (retryCount < 2) {
            console.log(`Retrying non-PDF URL extraction after error (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return getNonPdfUrls(markdown, prompt, retryCount + 1);
        }
        console.log('Max retries reached for non-PDF URL extraction after error');
        return { urls: [] };
    }
  }

  async function bothUrl(links: string[], prompt: Record<string, string>) {
    try {
      if (!links || links.length === 0) {
        console.log('No links found to analyze.');
        return null;
      }
      console.log(`\n=== Starting analysis of ${links.length} initial links ===`);
      console.log('Initial links:', links);

      const foundDocuments = [];
      const allDocumentUrls = new Set(); // Using Set to automatically handle duplicates
      const visitedUrls = new Set(links); // Track all visited URLs, starting with initial links
      
      // Helper function to normalize URL for comparison
      function normalizeUrl(url: string): string {
        return url.replace(/^https?:\/\/(www\.)?/, '');
      }

      // Map to store unique URLs while preserving original format
      const uniqueUrlMap = new Map<string, string>();
      
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
          const pdfResult = await getPdfUrls(markdown, prompt.getPdfUrlsPrompt);
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
          const nonPdfResult = await getNonPdfUrls(markdown, prompt.getNonPdfUrlsPrompt);
          if (nonPdfResult && nonPdfResult.urls) {
            console.log(`Found ${nonPdfResult.urls.length} potential non-PDF URLs`);
            
            // Check relevancy of non-PDF URLs
            console.log('Checking relevancy of non-PDF URLs...');
            const relevancyChecks = await Promise.all(
              nonPdfResult.urls.map(async (item) => {
                const relevancyResult = await checkRelevantLink(item.url);
                return {
                  url: item.url,
                  isRelevant: relevancyResult.isRelevant,
                  reason: relevancyResult.reason
                };
              })
            );

            // Filter out non-relevant URLs and already visited URLs
            const relevantNonPdfUrls = relevancyChecks
              .filter(check => check.isRelevant && !visitedUrls.has(check.url))
              .map(check => ({
                url: check.url,
                reasoning: check.reasoning // Preserve the reasoning in the filtered results
              }));

            // Add the relevant URLs to visited set
            relevantNonPdfUrls.forEach(item => visitedUrls.add(item.url));

            console.log(`Found ${relevantNonPdfUrls.length} relevant non-PDF URLs (excluding already visited)`);

            if (relevantNonPdfUrls.length > 0) {
              console.log('\n=== Processing relevant non-PDF URLs ===');
              
              // Process each relevant non-PDF URL
              const secondIterationPromises = relevantNonPdfUrls.map(async (item) => {
                try {
                  console.log(`\nProcessing non-PDF URL: ${item.url}`);
                  console.log('Scraping content from non-PDF URL...');
                  const secondMarkdown = await scrapeUrlAsync(firecrawlApp, item.url);
                  
                  if (!secondMarkdown) {
                    console.log(`❌ No content found for non-PDF URL: ${item.url}`);
                    return null;
                  }
                  console.log('✅ Successfully scraped content from non-PDF URL');

                  // Get PDF URLs from the non-PDF URL
                  console.log('Extracting PDF documents from non-PDF URL...');
                  const secondPdfResult = await getPdfUrls(secondMarkdown,  prompt.getPdfUrlsPrompt);
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
                  console.error(`❌ Error processing non-PDF URL ${item.url}:`, error);
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
      
      // Deduplicate URLs while preserving original format
      allDocumentUrls.forEach((url: string) => {
        const normalizedUrl = normalizeUrl(url);
        if (!uniqueUrlMap.has(normalizedUrl)) {
          uniqueUrlMap.set(normalizedUrl, url);
        }
      });

      // Convert Map values to array
      const uniqueDocumentUrls = Array.from(uniqueUrlMap.values());

      if (foundDocuments.length > 0) {
        console.log(`✅ Found ${foundDocuments.length} document sets with ${uniqueDocumentUrls.length} unique PDF documents`);
        return foundDocuments;
      } else {
        console.log('❌ No documents found in any of the processed pages');
        return null;
      }
    } catch (error) {
      console.error('❌ Error encountered during page analysis:', error);
      return null;
    }
  }

  async function filterDocuments(document: DocumentSet[]) {
    // First filter out documents by year criteria
    const yearFilteredDocSets = document.map(docSet => ({
      sourceUrl: docSet.sourceUrl,
      documents: docSet.documents.filter(doc => 
        // Keep document if year is null or >= 2021
        doc.year === null || doc.year >= 2021
      )
    })).filter(docSet => docSet.documents.length > 0);

    const filterPrompt = `
You are assisting in curating a high-quality dataset of documents useful for industry analysis by a senior financial analyst.

Given only the title of a PDF document, decide if it's useful for financial analysts, consultants, or investors studying Indian industries. Do this based on whether it contains sector data, performance reports, market analysis, price/tariff updates, or credible industry insights.

Important Instructions:
1. Only include English documents. If the document name is not in English (Hindi, bilingual or any other regional language), immediately mark it as irrelevant (false).
2. Exclude anything related to administrative, legal, ceremonial, tender-related, training, general notices, policies, circulars, scheme guidelines, reforms.
3. The document should not be focused on a specific month or week; it should be related to the entire year or quarter.
4. The document should not be focused on a specific state; it should be related to the entire country.

Return the response in the JSON structure provided below:

  {
    "reason": "reason for the response",
    "isRelevant": true/false
  }

Do not include any explanation or commentary — just return the JSON object.

name: `;

    try {
      // Process each document set asynchronously
      const filteredResults = await Promise.all(
        yearFilteredDocSets.map(async (docSet) => {
          const sourceUrl = docSet.sourceUrl;
          
          // Process all documents in the set asynchronously
          const filteredDocs = await Promise.all(
            docSet.documents.map(async (doc) => {
              // Only send name to the LLM
              const docPrompt = filterPrompt + doc.name;
              const result = await gptCall('gpt-4.1-mini', docPrompt, 'user');
              const jsonResult = await extractJsonFromResponse(result);
              console.log('jsonResult from filterDocuments for', doc.documentUrl, jsonResult);
              return jsonResult && jsonResult.isRelevant ? doc : null;
            })
          );
          
          // Filter out null values and return only if there are relevant documents
          const validDocs = filteredDocs.filter(doc => doc !== null);
          return validDocs.length > 0 ? { sourceUrl, documents: validDocs } : null;
        })
      );
      
      // Filter out null values from the results
      const finalResults = filteredResults.filter(result => result !== null);
      
      console.log('Filtered results:', finalResults);
      return finalResults;
    } catch (error) {
      console.error('Error in filterDocuments:', error);
      return null;
    }
  }
  
  async function rankLinks(
    links: string[],
    prompt: string
  ): Promise<string[] | null> {
    const batchSize = 25;
    const batches = [];
    
    // Split links into batches of 25
    for (let i = 0; i < links.length; i += batchSize) {
      batches.push(links.slice(i, i + batchSize));
    }

    const rankPrompt = (batchLinks: string[]) => `${prompt}\n\nURLs to analyze:\n${JSON.stringify(batchLinks, null, 2)}`;

    try {
      // Process all batches asynchronously
      const batchPromises = batches.map(async (batch) => {
        const response = await gptCall('gpt-4.1-mini', rankPrompt(batch), 'user');
        const rankedResults = await extractJsonFromResponse(response);
        return rankedResults;
      });

      // Wait for all batches to complete
      const allResults = await Promise.all(batchPromises);
      
      // Flatten and combine all results
      const combinedResults = allResults.flat();
      
      // Sort by relevance score and filter for scores >= 70
      combinedResults.sort(
        (a: RankedResult, b: RankedResult) =>
          b.relevance_score - a.relevance_score,
      );
      const relevantResults = combinedResults.filter(
        (result: RankedResult) => result.relevance_score >= 70,
      );

      return relevantResults.map((result: RankedResult) => result.url);
    } catch (error) {
      console.error('Error ranking URLs:', error);
      return null;
    }
  }
  
  async function filterRelevantLinks(links: string[]): Promise<string[] | null> {
    const prompt = `
    You are given a list of URLs from a website. Your task is to return only the most relevant base URLs which can aid in industry analysis:

Strict Filtering Rule:
1.  **Base path filtering logic**:
   - If both a parent URL and a sub-URL are present (e.g., https://site.com/important-document and https://site.com/important-document/document-2023), only keep the parent **hub** URL that hosts the documents.
   - A parent URL is defined as a prefix of another URL.
   - If a parent URL exists, **exclude all deeper sub-URLs that start with the same base path**.
   - Only include the sub-URL if its parent is not in the list.

   return the response in the JSON structure provided below no other text or explanation:

   [
    {
      "url": "string",
      "reason": "reason for the response",
      "isRelevant": true/false
    }
   ]

   URLs to analyze:
   ${JSON.stringify(links, null, 2)}
   `;

   const result = await gptCall('gpt-4.1-mini', prompt, 'user');
   const jsonResult = await extractJsonFromResponse(result);
   return jsonResult.filter((result: any) => result.isRelevant).map((result: any) => result.url);
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
      maxRetries = 4,
    ): Promise<[string | null, boolean, boolean]> {
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
          return [null, true, false]; // Error detected, not rate limited
        }
  
        return [pageMarkdown, false, false];
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
        const isRateLimited = /status code[:\s]*(?:429|408)/.test(errorMsg.toLowerCase()) || 
                            errorMsg.toLowerCase().includes('rate limit exceeded');
        return [null, true, isRateLimited];
      }
    }
  
    // Try original URL
    const [pageMarkdown, errorDetected, isRateLimited] = await tryScrape(link);
    if (!errorDetected && pageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${link}:\n${pageMarkdown}\n---\n`;
    }
  
    // If error is due to rate limiting and max retries exhausted, skip URL modifications
    if (isRateLimited) {
      console.log('Rate limit retries exhausted, skipping URL modifications...');
      saveFailedUrl(link, 'Rate limit exceeded after max retries');
      return null;
    }
  
    console.log(`Error detected for ${link}, trying alternative URLs...`);
  
    // Try with modified URL (adding/removing trailing slash)
    const modifiedLink = link.endsWith('/') ? link.slice(0, -1) : link + '/';
    console.log(`Retrying scrape with modified URL: ${modifiedLink}`);
    const [modifiedPageMarkdown, modifiedErrorDetected, modifiedIsRateLimited] =
      await tryScrape(modifiedLink);
    if (!modifiedErrorDetected && modifiedPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${modifiedLink}:\n${modifiedPageMarkdown}\n---\n`;
    }
  
    // If error is due to rate limiting and max retries exhausted, skip further URL modifications
    if (modifiedIsRateLimited) {
      console.log('Rate limit retries exhausted, skipping further URL modifications...');
      saveFailedUrl(link, 'Rate limit exceeded after URL modification');
      return null;
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
    const [protocolPageMarkdown, protocolErrorDetected, protocolIsRateLimited] =
      await tryScrape(protocolModifiedLink);
    if (!protocolErrorDetected && protocolPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${protocolModifiedLink}:\n${protocolPageMarkdown}\n---\n`;
    }
  
    // If error is due to rate limiting and max retries exhausted, skip further URL modifications
    if (protocolIsRateLimited) {
      console.log('Rate limit retries exhausted, skipping further URL modifications...');
      saveFailedUrl(link, 'Rate limit exceeded after protocol modification');
      return null;
    }
  
    // Try with protocol modified URL (without slash)
    console.log(
      `Retrying scrape with protocol modified URL (without slash): ${protocolModifiedLinkNoSlash}`,
    );
    const [protocolNoSlashPageMarkdown, protocolNoSlashErrorDetected, protocolNoSlashIsRateLimited] =
      await tryScrape(protocolModifiedLinkNoSlash);
    if (!protocolNoSlashErrorDetected && protocolNoSlashPageMarkdown) {
      console.log('Page scraping completed successfully.');
      return `Content from ${protocolModifiedLinkNoSlash}:\n${protocolNoSlashPageMarkdown}\n---\n`;
    }
  
    // If error is due to rate limiting and max retries exhausted, skip further URL modifications
    if (protocolNoSlashIsRateLimited) {
      console.log('Rate limit retries exhausted, skipping further URL modifications...');
      saveFailedUrl(link, 'Rate limit exceeded after protocol and slash modification');
      return null;
    }
  
    console.log('All URL variations failed, skipping...');
    saveFailedUrl(link, 'All URL variations failed to scrape');
    return null;
  }

  async function findRelevantPageViaMap(
    url: string,
    prompt: Record<string, string>
  ): Promise<string[] | null> {
    try {
      console.log('Getting map of website...');

      const mapWebsite = (await firecrawlApp.mapUrl(url, {
        includeSubdomains: true,
      })) as MapResponse;
      const filteredPages = [...(mapWebsite.links || [])].filter(
        (page) => !String(page).toLowerCase().endsWith('.pdf'),
      );
      if (!filteredPages.length) {
        console.log('No links found in map response.');
        return null;
      }

      const relevantLinks = await rankLinks(filteredPages, prompt.rankLinksPrompt);
      const filteredRelevantLinks = await filterRelevantLinks(relevantLinks);

      if (!filteredRelevantLinks) {
        console.log('No relevant links found.');
        return null;
      }

      console.log(`Found ${filteredRelevantLinks.length} relevant links.`);
      console.log('relevantPages', filteredRelevantLinks);
      
      return filteredRelevantLinks;

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
    Document,
    DocumentSet
  };