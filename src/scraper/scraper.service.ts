import { Injectable } from '@nestjs/common';
import { scrapeUrlAsync, bothUrl, findRelevantPageViaMap, filterDocuments } from 'src/utils/relevantPagesMapScrap';


@Injectable()
export class ScraperService {

  async map_scrap() {
    const objective =
    'reports, annual reports, publications, industry reports, mission plan, etc.';
    const url = 'https://morth.nic.in/en';

    const relevantPages = await findRelevantPageViaMap(objective, url);
    console.log('relevantPages', relevantPages);

    // Get all documents
    const rawResult = await bothUrl(relevantPages);
    
    // Filter documents based on criteria
    const filteredDocuments = await filterDocuments(rawResult);

    return filteredDocuments;
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
