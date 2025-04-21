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
      {{
        "reason": "reason for the response",
        "isRelevant": true/false
      }}`;
    const result = await gptCall('gpt-4o', prompt, 'system');
    const jsonResult = await extractJsonFromResponse(result);
    return jsonResult;
  }
  
  async function findObjectiveInTopPagesForDocuments(
    links: string[],
    objective: string,
    checkPrompt: string,
    checkRelevancy: boolean,
  ) {
    try {
      if (!links || links.length === 0) {
        console.log('No links found to analyze.');
        return null;
      }
  
      console.log(`Proceeding to analyze ${links.length} links:`, links);

      // Check relevancy of each link
      let relevantLinks = links;
      if(checkRelevancy){
        const relevancyChecks = await Promise.all(
          links.map(async (link) => {
            const relevancyResult = await checkRelevantLink(link);
            return {
              link,
              isRelevant: relevancyResult.isRelevant,
              reason: relevancyResult.reason
            };
          })
        );
  
        // Filter out non-relevant links
        relevantLinks = relevancyChecks
          .filter(check => check.isRelevant)
          .map(check => check.link);
  
        if (relevantLinks.length === 0) {
          console.log('No relevant links found after relevancy check.');
          return null;
        }
        console.log(`Found ${relevantLinks.length} relevant links after relevancy check.`);
      }
      
      const foundDocuments = [];
      const allDocumentUrls = new Set(); // Using Set to automatically handle duplicates
      
      // Process all links asynchronously
      const processingPromises = relevantLinks.map(async (link) => {
        try {
          console.log(`\nProcessing link: ${link}`);
          
          // Scrape the current link
          const markdown = await scrapeUrlAsync(firecrawlApp, link);
          
          if (!markdown) {
            console.log(`No content found for link: ${link}`);
            return null;
          }
  
          // Process this link's markdown immediately
          console.log(`Analyzing content from: ${link}`);
          const prompt = checkPrompt + '\n\nwebsite - markdown data: ' + markdown;
          const result = await gptCall('gpt-4o', prompt, 'system');
  
          if (!result) {
            console.log('No response from OpenAI for this page');
            return null;
          }
  
          if (result !== 'Objective not met') {
            console.log('Objective potentially fulfilled. Checking for documents...');
            try {
              if (result.includes('{') && result.includes('}')) {
                console.log('Response contains JSON, attempting to parse...');
                const jsonResult = await extractJsonFromResponse(result);
                console.log('Parsed JSON result:', JSON.stringify(jsonResult, null, 2));
  
                // Check if documents are available
                if(jsonResult.is_documents_available){
                  console.log('Documents found!');
                  // Add to foundDocuments immediately
                  foundDocuments.push(jsonResult);
                  
                  // Extract and add all document URLs to the Set
                  if (jsonResult.data && Array.isArray(jsonResult.data)) {
                    jsonResult.data.forEach(doc => {
                      if (doc.document_url) {
                        allDocumentUrls.add(doc.document_url);
                      }
                    });
                  }
                  
                  return jsonResult;
                } else {
                  console.log('No documents found in this result');
                  return null;
                }
              } else {
                console.log('No JSON object found in response');
                return null;
              }
            } catch (error) {
              console.error('Error in parsing response:', error);
              return null;
            }
          } else {
            console.log('Objective not met in this page.');
            return null;
          }
        } catch (error) {
          console.error(`Error processing link ${link}:`, error);
          return null;
        }
      });
  
      // Wait for all processing to complete
      await Promise.all(processingPromises);
      
      // Convert Set to Array and log all unique document URLs
      const uniqueDocumentUrls = Array.from(allDocumentUrls);
      // console.log('All unique document URLs found:', uniqueDocumentUrls);
      
      if (uniqueDocumentUrls.length > 0) {
        console.log(`Found ${uniqueDocumentUrls.length} document entries with ${uniqueDocumentUrls.length} unique URLs`);
        return uniqueDocumentUrls;
      } else {
        console.log('No documents found in any of the pages.');
        return null;
      }
    } catch (error) {
      console.error('Error encountered during page analysis:', error);
      return null;
    }
  }
  
  async function findObjectiveInTopPages(
    links: string[],
    objective: string,
    checkPrompt: string,
  ) {
    try {
      if (!links || links.length === 0) {
        console.log('No links found to analyze.');
        return null;
      }
      
      console.log(`Proceeding to analyze ${links.length} links:`, links);

      // Check relevancy of each link
      const relevancyChecks = await Promise.all(
        links.map(async (link) => {
          const relevancyResult = await checkRelevantLink(link);
          return {
            link,
            isRelevant: relevancyResult.isRelevant,
            reason: relevancyResult.reason
          };
        })
      );

      // Filter out non-relevant links
      const relevantLinks = relevancyChecks
        .filter(check => check.isRelevant)
        .map(check => check.link);

      if (relevantLinks.length === 0) {
        console.log('No relevant links found after relevancy check.');
        return null;
      }

      console.log(`Found ${relevantLinks.length} relevant links after relevancy check.`);
  
      // Create tasks for all scraping operations
      const scrapingPromises = relevantLinks.map((link) =>
        scrapeUrlAsync(firecrawlApp, link),
      );
  
      // Wait for all scraping tasks to complete
      const allMarkdown = await Promise.all(scrapingPromises);
  
      // Filter out null values and combine markdown
      const validMarkdown = allMarkdown.filter((md) => md !== null) as string[];
  
      if (!validMarkdown.length) {
        console.log('No content found in any of the pages.');
        return null;
      }
  
      const combinedMarkdown = validMarkdown.join('\n');
      const prompt =
        checkPrompt +
        '\n\nwebsite - markdown data from multiple pages: ' +
        combinedMarkdown;
  
      const result = await gptCall('gpt-4o', prompt, 'system');
  
      if (!result) {
        console.log('No response from OpenAI');
        return null;
      }
  
      if (result !== 'Objective not met') {
        console.log(
          'Objective potentially fulfilled. Relevant information identified.',
        );
        try {
          if (result.includes('{') && result.includes('}')) {
            console.log('this is result', result);
            const jsonResult = await extractJsonFromResponse(result);
            return jsonResult;
          } else {
            console.log('No JSON object found in response');
            return null;
          }
        } catch (error) {
          console.error('Error in parsing response:', error);
          return null;
        }
      } else {
        console.log('Objective not met in any of the pages.');
        return null;
      }
    } catch (error) {
      console.error('Error encountered during page analysis:', error);
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
    findObjectiveInTopPages,
    findObjectiveInTopPagesForDocuments,
    findRelevantPageViaMap,
    scrapeUrlAsync
  };
  