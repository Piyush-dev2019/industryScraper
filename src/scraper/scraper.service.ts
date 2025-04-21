import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { firecrawlApp, gptCall } from 'src/utils/llmModels';
import { findObjectiveInTopPages, findObjectiveInTopPagesForDocuments, scrapeUrlAsync } from 'src/utils/relevantPagesMapScrap';
import { findRelevantPageViaMap } from 'src/utils/relevantPagesMapScrap';
import { extractJsonFromResponse } from 'src/utils/jsonExtractor';

interface DocumentResponse {
  is_documents_available: boolean;
  data: Array<{
    document_url: string;
  }>;
}

@Injectable()
export class ScraperService {


  private async fetchPage(url: string) {

  }

//   async get_url(url: string) {

//   }

  async map_scrap() {
    const objective =
    'any document';
    const url = 'https://morth.nic.in/en';

    // ============ Step 1 ============
    const scrapUrlMarkdown = await scrapeUrlAsync(firecrawlApp, url);
    const promptForHome = `from the given markdown find all the direct links to documents like reports, annual reports, publications, industry reports, mission plan, etc.
    return the result in this exact JSON format — nothing else:
    {{
        "is_documents_available": true,
        "data": [
            {{
                "document_url": "URL of document",
            }}
        ]
    }}
    OR
    {{
        "is_documents_available": false,
    }}
    website - markdown data: ${scrapUrlMarkdown}
    `;
    const gptResponse = await gptCall('gpt-4o', promptForHome, 'system');
    if (!gptResponse) {
      console.log('No response from OpenAI for this page');
      return null;
    }
    const rawFormattedResponse = await extractJsonFromResponse(gptResponse);
    const formattedResponse: DocumentResponse = {
      is_documents_available: rawFormattedResponse.is_documents_available,
      data: Array.isArray(rawFormattedResponse.data) ? rawFormattedResponse.data.map((doc: { document_url: string }) => ({ 
        document_url: doc.document_url 
      })) : []
    };
    // console.log('formattedResponse', formattedResponse);

    
    // ============ Step 2 ============

    const relevantPages = await findRelevantPageViaMap(objective, url);
    console.log('relevantPages', relevantPages);
    const prompt = `
    from the given markdown find all the documents like reports, annual reports, publications, industry reports, mission plan, etc.
    return the result in this exact JSON format — nothing else:
    {{
        "is_documents_available": true,
        "data": [
            {{
                "document_url": "URL of document",
            }}
        ]
    }}
        OR
        {{
        "is_documents_available": false,
        }}
    `;

    const rawResult = await findObjectiveInTopPagesForDocuments(relevantPages, objective, prompt, false);
    const result: DocumentResponse = {
      is_documents_available: Array.isArray(rawResult) && rawResult.length > 0,
      data: Array.isArray(rawResult) ? rawResult.map((url: string) => ({ document_url: url })) : []
    };
    // console.log('result', result);

    // Combine documents from both sources
    // Create a Set to store unique document URLs
    const documentUrlSet = new Set<string>();
    
    // Add documents from home page scraping
    if (formattedResponse?.is_documents_available && formattedResponse.data) {
      formattedResponse.data.forEach(doc => documentUrlSet.add(doc.document_url));
    }
    
    // Add documents from relevant pages scraping 
    if (result?.is_documents_available && result.data) {
      result.data.forEach(doc => documentUrlSet.add(doc.document_url));
    }

    // Convert back to array of objects
    const uniqueDocuments = Array.from(documentUrlSet).map(url => ({ document_url: url }));

    // Extract just the URLs into an array
    const finalUrls = uniqueDocuments.map(doc => doc.document_url);

    // Split URLs into PDF and non-PDF arrays
    const pdfUrls = finalUrls.filter(url => 
      url.toLowerCase().endsWith('.pdf') );
    
    const nonPdfUrls = finalUrls.filter(url => 
      !url.toLowerCase().endsWith('.pdf') 
    );

    console.log(`Found ${nonPdfUrls.length} non-PDF URLs to process:`, nonPdfUrls);
    console.log(`Found ${pdfUrls.length} PDF URLs:`, pdfUrls);

    // Process non-PDF URLs
    console.log('\nProcessing non-PDF URLs for additional documents...');
    const rawResult2 = await findObjectiveInTopPagesForDocuments(nonPdfUrls, objective, prompt, true);
    console.log(`Completed processing ${nonPdfUrls.length} non-PDF URLs`);
    
    const result2: DocumentResponse = {
      is_documents_available: Array.isArray(rawResult2) && rawResult2.length > 0,
      data: Array.isArray(rawResult2) ? rawResult2.map((url: string) => ({ document_url: url })) : []
    };

    // Log the results from processing non-PDF URLs
    if (result2.is_documents_available) {
      console.log(`Found ${result2.data.length} additional documents from non-PDF URLs`);
    } else {
      console.log('No additional documents found from non-PDF URLs');
    }

    // Extract URLs from result2 and add to appropriate arrays
    if (result2.is_documents_available && result2.data) {
      result2.data.forEach(doc => {
        const url = doc.document_url;
        if (url.toLowerCase().endsWith('.pdf')) {
          pdfUrls.push(url);
        } else {
          nonPdfUrls.push(url);
        }
      });
    }

    // Remove duplicates from both arrays
    const uniquePdfUrls = [...new Set(pdfUrls)];
    const uniqueNonPdfUrls = [...new Set(nonPdfUrls)];

    console.log('\nFinal Results:');
    console.log(`Total PDF URLs found: ${uniquePdfUrls.length}`);
    console.log(`Total non-PDF URLs found: ${uniqueNonPdfUrls.length}`);
    console.log('Final PDF URLs:', uniquePdfUrls);
    console.log('Final non-PDF URLs:', uniqueNonPdfUrls);

    return uniquePdfUrls;
  }

  async main(){
    const result = await this.map_scrap();
    console.log('Final URLs:', result);
    const fs = require('fs');
    const path = require('path');

    // Ensure the file exists
    if (!fs.existsSync('urls.json')) {
      fs.writeFileSync('urls.json', '[]');
    }
    
    fs.writeFileSync('urls.json', JSON.stringify(result, null, 2));
  }
}
