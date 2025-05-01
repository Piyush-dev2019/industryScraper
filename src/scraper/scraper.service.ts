import { Injectable } from '@nestjs/common';
import {  bothUrl, findRelevantPageViaMap, filterDocuments, Document } from 'src/utils/relevantPagesMapScrap';

interface Source {
  sourceUrl: string;
  documents: Document[];
}

interface TransformedDocument {
  documentUrl: string;
  characteristics: {
    year: number;
    name: string;
    type: string;
    description: string;
    sources: string[];
  };
}

@Injectable()
export class ScraperService {
  private transformData(sources: Source[]): TransformedDocument[] {
    const documentMap: { [key: string]: TransformedDocument } = {};

    sources.forEach((source) => {
      source.documents.forEach((doc) => {
        if (!documentMap[doc.documentUrl]) {
          documentMap[doc.documentUrl] = {
            documentUrl: doc.documentUrl,
            characteristics: {
              year: doc.year,
              name: doc.name,
              type: doc.type,
              description: doc.description,
              sources: [source.sourceUrl],
            },
          };
        } else {
          documentMap[doc.documentUrl].characteristics.sources.push(source.sourceUrl);
        }
      });
    });

    return Object.values(documentMap);
  }

  async map_scrap(prompt: Record<string, string>): Promise<TransformedDocument[] | null> {
    // const objective =
    // 'Sector/Industry Reports, Annual Reports, Publications, Financial Reports, Mission Plans, Strategy Documents';
    const url = 'https://www.niti.gov.in/';
    // const url = 'https://pharma-dept.gov.in/';

    const relevantPages = await findRelevantPageViaMap(url, prompt);
    // console.log('relevantPages', relevantPages);

    // Get all documents
    const rawResult = await bothUrl(relevantPages, prompt);
    
    // Filter documents based on criteria
    const filteredDocuments = await filterDocuments(rawResult);

    // Transform the filtered documents
    return this.transformData(filteredDocuments);
  }

  async main(prompt: Record<string, string>){
    const result = await this.map_scrap(prompt);
    console.log('Final URLs:', result);
    const fs = require('fs');

    // Ensure the file exists
    if (!fs.existsSync('urls.json')) {
      fs.writeFileSync('urls.json', '[]');
    }
    
    fs.writeFileSync('urls.json', JSON.stringify(result, null, 2));
  }
}
