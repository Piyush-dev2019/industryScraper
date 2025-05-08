import fs from 'fs';
import path from 'path';

const FAILED_URLS_FILE = path.join(process.cwd(), 'failed-urls.json');

interface FailedUrl {
  url: string;
  timestamp: string;
  reason: string;
}

export function saveFailedUrl(url: string, reason: string) {
  try {
    let failedUrls: FailedUrl[] = [];
    
    // Read existing failed URLs if file exists
    if (fs.existsSync(FAILED_URLS_FILE)) {
      const fileContent = fs.readFileSync(FAILED_URLS_FILE, 'utf-8');
      failedUrls = JSON.parse(fileContent);
    }

    // Add new failed URL
    failedUrls.push({
      url,
      timestamp: new Date().toISOString(),
      reason
    });

    // Write back to file
    fs.writeFileSync(FAILED_URLS_FILE, JSON.stringify(failedUrls, null, 2));
  } catch (error) {
    console.error('Error saving failed URL:', error);
  }
}

export function getFailedUrls(): FailedUrl[] {
  try {
    if (fs.existsSync(FAILED_URLS_FILE)) {
      const fileContent = fs.readFileSync(FAILED_URLS_FILE, 'utf-8');
      return JSON.parse(fileContent);
    }
    return [];
  } catch (error) {
    console.error('Error reading failed URLs:', error);
    return [];
  }
}