import { Injectable } from '@nestjs/common';
import {  bothUrl, findRelevantPageViaMap, filterDocuments, Document } from 'src/utils/relevantPagesMapScrap';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';


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
  private blobServiceClient: BlobServiceClient;
  private containerName = 'industry-reports';

  constructor() {
    // Initialize the BlobServiceClient with your connection string
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
    );
    this.testConnection();
  }

  private async testConnection() {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.getProperties();
      console.log('Successfully connected to Azure Blob Storage');
    } catch (error) {
      console.error('Failed to connect to Azure Blob Storage:', error);
    }
  }

  private getBlobClient(blobName: string): BlockBlobClient {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    return containerClient.getBlockBlobClient(blobName);
  }

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

  async map_scrap(prompt: Record<string, string>, url: string): Promise<TransformedDocument[] | null> {
    // const objective =
    // 'Sector/Industry Reports, Annual Reports, Publications, Financial Reports, Mission Plans, Strategy Documents';

    console.log('url', url);
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

    // const url = 'https://www.niti.gov.in/';
    // const url = 'https://www.i-cema.in/';
    const url = 'https://pharma-dept.gov.in/';
    const organizationName= 'department_of_pharmaceuticals'

    const result = await this.map_scrap(prompt, url);
    console.log('Final URLs:', result);
    const fs = require('fs');
    const path = require('path');

    // Ensure the file exists
    if (!fs.existsSync('urls.json')) {
      fs.writeFileSync('urls.json', '[]');
    }
    
    fs.writeFileSync('urls.json', JSON.stringify(result, null, 2));

    // Read the JSON file
    const urlsData = JSON.parse(fs.readFileSync('urls.json', 'utf8'));

    // Create a temporary directory for downloads if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp_downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Process files in batches of 10
    const BATCH_SIZE = 10;
    const totalFiles = urlsData.length;
    let processedCount = 0;

    while (processedCount < totalFiles) {
      const batch = urlsData.slice(processedCount, processedCount + BATCH_SIZE);
      const batchPromises = batch.map(async (doc) => {
        const { documentUrl, characteristics } = doc;
        const { year, name } = characteristics;
        
        // Clean the document name (remove .pdf and any special characters)
        const cleanName = name.replace(/\.(pdf|PDF)$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
        
        // Construct the blob path with RAW as a folder
        const blobPath = `${organizationName}/${year}/${cleanName}/RAW/${cleanName}.pdf`;
        
        try {
          // Download the document from the URL using streams
          const response = await fetch(documentUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          
          // Ensure temp directory exists
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempFilePath = path.join(tempDir, `${cleanName}.pdf`);
          const fileStream = fs.createWriteStream(tempFilePath);
          
          // Pipe the response body directly to the file
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(Buffer.from(value));
          }
          fileStream.end();
          
          // Wait for the file to be completely written
          await new Promise((resolve) => fileStream.on('finish', resolve));
          
          // Verify file exists before uploading
          if (!fs.existsSync(tempFilePath)) {
            throw new Error('File was not created successfully');
          }
          
          // Upload to Azure Blob Storage using streams
          const blobClient = this.getBlobClient(blobPath);
          const uploadStream = fs.createReadStream(tempFilePath);
          await blobClient.uploadStream(uploadStream, undefined, undefined, {
            blobHTTPHeaders: {
              blobContentType: 'application/pdf',
            },
          });
          
          console.log(`Successfully uploaded: ${blobPath}`);
          
          // Clean up the temporary file
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          return { success: true, path: blobPath };
        } catch (error) {
          console.log(`Failed to process document: ${documentUrl}`, error);
          return { success: false, path: blobPath, error };
        }
      });

      // Wait for the current batch to complete
      await Promise.all(batchPromises);
      processedCount += batch.length;
      
      // Log batch progress
      console.log(`Processed ${processedCount}/${totalFiles} files`);
      
      // Add a small delay between batches to prevent overwhelming the system
      if (processedCount < totalFiles) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Clean up the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir, { recursive: true });
    }
  }

  async uploadFromUrlsJson(organizationName: string) {
    const fs = require('fs');
    const path = require('path');

    // Read the JSON file
    const urlsData = JSON.parse(fs.readFileSync('urls.json', 'utf8'));

    // Create a temporary directory for downloads if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp_downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Process files in batches of 10
    const BATCH_SIZE = 10;
    const totalFiles = urlsData.length;
    let processedCount = 0;

    while (processedCount < totalFiles) {
      const batch = urlsData.slice(processedCount, processedCount + BATCH_SIZE);
      const batchPromises = batch.map(async (doc) => {
        const { documentUrl, characteristics } = doc;
        const { year, name } = characteristics;
        
        // Clean the document name (remove .pdf and any special characters)
        const cleanName = name.replace(/\.(pdf|PDF)$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
        
        // Construct the blob path with RAW as a folder
        const blobPath = `${organizationName}/${year}/${cleanName}/RAW/${cleanName}.pdf`;
        
        try {
          // Download the document from the URL using streams
          const response = await fetch(documentUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          
          const tempFilePath = path.join(tempDir, `${cleanName}.pdf`);
          const fileStream = fs.createWriteStream(tempFilePath);
          
          // Pipe the response body directly to the file
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(Buffer.from(value));
          }
          fileStream.end();
          
          // Wait for the file to be completely written
          await new Promise((resolve) => fileStream.on('finish', resolve));
          
          // Verify file exists before uploading
          if (!fs.existsSync(tempFilePath)) {
            throw new Error('File was not created successfully');
          }
          
          // Upload to Azure Blob Storage using streams
          const blobClient = this.getBlobClient(blobPath);
          const uploadStream = fs.createReadStream(tempFilePath);
          await blobClient.uploadStream(uploadStream, undefined, undefined, {
            blobHTTPHeaders: {
              blobContentType: 'application/pdf',
            },
          });
          
          console.log(`Successfully uploaded: ${blobPath}`);
          
          // Clean up the temporary file
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          return { success: true, path: blobPath };
        } catch (error) {
          console.log(`Failed to process document: ${documentUrl}`, error);
          return { success: false, path: blobPath, error };
        }
      });

      // Wait for the current batch to complete
      await Promise.all(batchPromises);
      processedCount += batch.length;
      
      // Log batch progress
      console.log(`Processed ${processedCount}/${totalFiles} files`);
      
      // Add a small delay between batches to prevent overwhelming the system
      if (processedCount < totalFiles) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Clean up the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir, { recursive: true });
    }
  }
}
