import { Injectable } from '@nestjs/common';
import { bothUrl, findRelevantPageViaMap, filterDocuments, Document } from 'src/utils/relevantPagesMapScrap';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { ReportsService } from 'src/reports/reports.service';
import { CreateReportDto } from 'src/reports/dto/create-report.dto';

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

  constructor(
    private readonly reportsService: ReportsService
  ) {
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

  private getBlobUrl(blobPath: string): string {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blobClient = containerClient.getBlockBlobClient(blobPath);
    return blobClient.url;
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

    // Remove duplicates from sources and ensure it's an array
    return Object.values(documentMap).map(doc => ({
      ...doc,
      characteristics: {
        ...doc.characteristics,
        sources: Array.from(new Set(doc.characteristics.sources))
      }
    }));
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

  private async uploadDocumentToBlob(documentUrl: string, blobPath: string): Promise<{ success: boolean; path: string; url: string; error?: any }> {
    try {
      // Download the document from the URL using streams
      const response = await fetch(documentUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      // Create a PassThrough stream to pipe the response to blob storage
      const { PassThrough } = require('stream');
      const passThrough = new PassThrough();
      
      // Create a promise that resolves when the stream ends or rejects on error
      const streamComplete = new Promise((resolve, reject) => {
        passThrough.on('end', resolve);
        passThrough.on('error', reject);
      });

      // Pipe the response body to the PassThrough stream
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              passThrough.end();
              break;
            }
            passThrough.write(Buffer.from(value));
          }
        } catch (error) {
          passThrough.destroy(error);
        }
      };

      // Start pumping the stream
      pump();
      
      // Upload directly to Azure Blob Storage using streams
      const blobClient = this.getBlobClient(blobPath);
      await blobClient.uploadStream(
        passThrough,
        undefined,
        undefined,
        {
          blobHTTPHeaders: {
            blobContentType: 'application/pdf',
          },
        }
      );
      
      // Wait for the stream to complete
      await streamComplete;
      
      // Get the complete URL
      const blobUrl = this.getBlobUrl(blobPath);
      
      console.log(`Successfully uploaded: ${blobPath}`);
      console.log(`Blob URL: ${blobUrl}`);
      return { success: true, path: blobPath, url: blobUrl };
    } catch (error) {
      console.log(`Failed to process document: ${documentUrl}`, error);
      return { success: false, path: blobPath, url: '', error };
    }
  }

  async main(prompt: Record<string, string>, organizationName: string, url: string, folderName: string) {
    const result = await this.map_scrap(prompt, url);
    console.log('Final URLs:', result);

    // Process files in batches of 10
    const BATCH_SIZE = 10;
    const totalFiles = result.length;
    let processedCount = 0;

    while (processedCount < totalFiles) {
      const batch = result.slice(processedCount, processedCount + BATCH_SIZE);
      const batchPromises = batch.map(async (doc) => {
        const { documentUrl, characteristics } = doc;
        const { year, name, sources } = characteristics;
        
        // Clean the document name (remove .pdf and any special characters)
        const cleanName = name.replace(/\.(pdf|PDF)$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
        
        // Construct the blob path with RAW as a folder
        organizationName = organizationName.replaceAll(' ', '_');
        let blobPath = '';
        if(year == null){
          blobPath = `${folderName}/${organizationName}/not_found/${cleanName}/RAW/${cleanName}.pdf`;
        }
        else{
          blobPath = `${folderName}/${organizationName}/${year}/${cleanName}/RAW/${cleanName}.pdf`;
        }
        // Upload to blob storage
        const uploadResult = await this.uploadDocumentToBlob(documentUrl, blobPath);

        if (uploadResult.success) {
          // Create database entry
          const reportDto: CreateReportDto = {
            documentName: name.replaceAll(' ', '_'),
            documentUrl: documentUrl,
            blobUrl: uploadResult.url,
            year: year,
            status: 'idle',
            ministryName: organizationName,
            ministryUrl: url,
            exactSourceUrl: sources
          };

          try {
            await this.reportsService.makeReportEntry(reportDto);
            console.log(`Database entry created for: ${name}`);
          } catch (error) {
            console.error(`Failed to create database entry for ${name}:`, error);
          }
        }

        return uploadResult;
      });

      // Wait for the current batch to complete
      const results = await Promise.all(batchPromises);
      processedCount += batch.length;
      
      // Log batch progress
      console.log(`Processed ${processedCount}/${totalFiles} files`);
      console.log('Batch results:', results);
      
      // Add a small delay between batches to prevent overwhelming the system
      if (processedCount < totalFiles) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
