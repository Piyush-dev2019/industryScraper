import { Injectable } from '@nestjs/common';
import {  bothUrl, findRelevantPageViaMap, filterDocuments, DocumentSet, deduplicateResults } from 'src/utils/relevantPagesMapScrap';


@Injectable()
export class ScraperService {

  async map_scrap(): Promise<DocumentSet[] | null> {
    // const objective =
    // 'Sector/Industry Reports, Annual Reports, Publications, Financial Reports, Mission Plans, Strategy Documents';
    const url = 'https://tourism.gov.in/';

    const relevantPages = await findRelevantPageViaMap(url);
    // console.log('relevantPages', relevantPages);

    // Get all documents
    const rawResult = await bothUrl(relevantPages);
    
    // Filter documents based on criteria
    const filteredDocuments = await filterDocuments(rawResult);

    // Deduplicate documents
    const deduplicatedDocuments = await deduplicateResults(filteredDocuments);

    return deduplicatedDocuments;
  }

  async main(){
    const result = await this.map_scrap();
    console.log('Final URLs:', result);
    const fs = require('fs');

    // Ensure the file exists
    if (!fs.existsSync('urls.json')) {
      fs.writeFileSync('urls.json', '[]');
    }
    
    fs.writeFileSync('urls.json', JSON.stringify(result, null, 2));
  }
}
