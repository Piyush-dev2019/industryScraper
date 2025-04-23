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

  interface Document {
    year: number;
    name: string;
    type: string;
    description: string;
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
        "url": "${link}",
        "reason": "reason for the response",
        "isRelevant": true/false
      }`;
    const result = await gptCall('gpt-4.1', prompt, 'system');
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
- Budget Plans
- Industry Strategy Documents

Ignore any links that do not end in .pdf.
Ignore any links that appear to be from before 2021 based on dates in the filename, URL, or surrounding context

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

Your task is to extract **only the links** (URLs) that are **Highly Likely to lead to pages containing important documents** for industry research and analysis, such as:
- Sector/Industry Reports
- Annual Reports
- Publications
- Financial Reports
- Mission Plans
- Strategy Documents
- Budget Plans
etc.

Instructions:
1. **Ignore** any links that point directly to .pdf files (those are handled in a separate step).
2. **Only return** links that likely **lead to** document repositories or report listing pages (e.g., pages with headings like "Reports", "Publications", "Documents", "Resources", "Archives", "Downloads", etc.).
3. Return a JSON array under the key possibleUrls containing only the actual URLs found in the provided markdown content.
4. Do not include any example URLs or placeholder URLs.
5. Only include URLs that are actually present in the markdown content.
6. **Ignore** any links that redirect to content older than 2021 or archive pages before 2021.
7. For paginated URLs, if a URL contains "page" or page numbers (e.g. "page=2", "page/3"), only include URLs up to page 2 and ignore any URLs with higher page numbers.
8. Ignore any links that are not in English for example url containing (/hi/) are in hindi.
Return the response in this exact format:
{
  "possibleUrls": [
    // List of actual URLs found in the markdown content otherwise return an empty array
  ]
}`;

    const result = await gptCall('gpt-4.1', nonPdfUrlPrompt + '\n\nwebsite - markdown data: ' + markdown, 'system');
    
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
      const visitedUrls = new Set(links); // Track all visited URLs, starting with initial links
      
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

            // Filter out non-relevant URLs and already visited URLs
            const relevantNonPdfUrls = relevancyChecks
              .filter(check => check.isRelevant && !visitedUrls.has(check.url))
              .map(check => check.url);

            // Add the relevant URLs to visited set
            relevantNonPdfUrls.forEach(url => visitedUrls.add(url));

            console.log(`Found ${relevantNonPdfUrls.length} relevant non-PDF URLs (excluding already visited)`);

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

  async function filterDocuments(document: DocumentSet[]) {
    const filterPrompt = `
You are assisting in curating a high-quality dataset of documents useful for industry analysis by a senior financial analyst.

You are given a document with the following fields:
- year: publication year
- name: document title
- type: document type
- description: document description
- documentUrl: URL to access the document

Your task is to determine if this document meets all of the following conditions:

1. Is highly relevant for industry analysis, such as:
   - Sectoral and industry-specific reports
   - Annual or financial reports of ministries or industry bodies
   - Mission plans and strategic roadmaps
   - Budget Plans and publications with analytical or statistical insights

2. Is recent, i.e., published in the year 2021 or later. If the year is missing, assess the relevance based on the content description and type. Only reject documents for missing year if there is no strong indication of recency or analytical value.

3. Is not:
   - General notices, circulars, tenders, guidelines, or operational memos
   - Administrative documents not useful for industry analysis
   - Monthly or weekly summary reports


4. Is in English (not Hindi, bilingual, or any other language)

Return the response in the JSON structure provided below:

  {
    "reason": "reason for the response",
    "isRelevant": true/false
  }

Do not include any explanation or commentary — just return the JSON object.`;

    try {
      // Process each document set asynchronously
      const filteredResults = await Promise.all(
        document.map(async (docSet) => {
          const sourceUrl = docSet.sourceUrl;
          
          // Process all documents in the set asynchronously
          const filteredDocs = await Promise.all(
            docSet.documents.map(async (doc) => {
              const docPrompt = filterPrompt + '\n\n' + JSON.stringify(doc, null, 2);
              const result = await gptCall('gpt-4.1-mini', docPrompt, 'system');
              const jsonResult = await extractJsonFromResponse(result);
              
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

  async function deduplicateResults(
    results: DocumentSet[],
  ): Promise<DocumentSet[] | null> {
    const prompt = `You are a smart deduplication engine designed to clean and organize document listings as a senior financial analyst. You are provided with a list of sources, where each source has the following structure:

[
    {
        "sourceUrl": "string",
        "documents": [
            {
                "year": number | null,
                "name": string,
                "type": string,
                "description": string,
                "documentUrl": string
            }
        ]
    }
]

Some documents (identified by the same 'documentUrl') may appear under multiple sources. Your task is to remove any duplicate documentUrl. If the same documentUrl appears under multiple sourceUrls, retain the one with the most semantically appropriate 'sourceUrl' which makes the most sense based on the document's type and description. 
For example, if a document is annual report and it appear under both a general bulletin page and a dedicated annual report page, retain it only under the annual report page and remove it from the bulletin source.

return the response in the JSON structure provided below no other text or explanation:

[
{
  "sourceUrl": "string",
  "documents": [
    {
      "year": number | null,
      "name": string,
      "type": string,
      "description": string,
      "documentUrl": string
    }
  ]
}
]
`;

    const result = await gptCall('gpt-4.1', prompt + '\n\n' + JSON.stringify(results, null, 2), 'system');
    const jsonResult = await extractJsonFromResponse(result);
    return jsonResult as DocumentSet[];
  }
  
  async function rankLinks(
    links: string[],
  ): Promise<string[] | null> {
    const rankPrompt = `
      Analyze these URLs and rank the most relevant ones for finding information about: 
  - Annual Reports
  - Industry Strategy Documents
  - Financial Reports
  - Budget Plans
  - Mission Plans
  - Sectoral Publications

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
      maxRetries = 5,
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
      return null;
    }
  
    console.log('All URL variations failed, skipping...');
    return null;
  }
  
  async function findRelevantPageViaMap(
    url: string,
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
  
      const relevantLinks = await rankLinks(filteredPages);
  
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
    Document,
    DocumentSet,
    deduplicateResults
  };
  