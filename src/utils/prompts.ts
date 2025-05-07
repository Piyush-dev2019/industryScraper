export const governmentWebsitePrompt = {

    "rankLinksPrompt": `Analyze the following URLs and rank the most relevant ones for finding information about:
  - Annual Reports
  - Industry Strategy Documents
  - Financial Reports
  - Budget Plans
  - Mission Plans
  - Sectoral Publications

Strict Filtering Rules:
1. Ignore any links to content older than 2021 or archive pages before 2021.
2. Ignore any paginated URLs beyond page 2 (e.g., URLs with "page=3" or "page/4").
3. Ignore links that are not in English (e.g., URLs containing "/hi/").
4. Ignore links to general notices, circulars, tenders, guidelines, operational memos, or purely administrative content.
5. Ignore links to monthly or weekly summary reports.
6. **Base path filtering logic**:
   - If both a parent URL and a sub-URL are present (e.g., https://site.com/policy and https://site.com/policy/document-2023), **only keep the parent URL**.
   - A "parent URL" is any URL that is a prefix of another.
   - If a parent URL exists, **exclude all deeper sub-URLs that start with the same base path**.
   - Only include the sub-URL if its parent is not in the list.

Return ONLY a JSON array in this exact format — no explanation or extra output:

[
  {
    "url": "http://example.com",
    "relevance_score": 95,
    "reason": "High-level document hub covering annual reports and strategies"
  }
]

`,


    "getPdfUrlsPrompt": `You are a data extraction assistant helping to analyze a government or institutional webpage provided in Markdown format.

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
  "sourceUrl": "the url from which the pdf is found",
  "documents": [
    {
      "year": 2022,                      // Extract from the filename or context. Leave null if not found.
      "name": "Annual Report 2021-22",   // Use link text or infer from filename
      "documentUrl": "https://actual-domain.com/report2022.pdf"  // The actual PDF URL from the markdown
    }
  ]
}

Important Instructions:
- Only include documents that help in industry or market analysis.
- Ensure documentUrl always ends in .pdf.
- Only include actual PDF URLs found in the markdown content.
- Do not include any example URLs or placeholder URLs.
- Use the logically correct year. For example for annual report 2021-22, use the year 2022 in the year field.

Use this format exactly. Do not add extra commentary or explanation.`,


    "getNonPdfUrlsPrompt": `
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
}`

}


export const brokerageWebsitePrompt = {
    "rankLinksPrompt": `
    Analyze the following URLs and rank the most relevant ones for finding information about any type of industry or sector.

Return ONLY a JSON array in this exact format — no explanation or extra output:

[
  {
    "url": "http://example.com",
    "relevance_score": 95,
    "reason": "High-level industry information hub"
  }
]

`,
    "getPdfUrlsPrompt": `You are a data extraction assistant helping to analyze a government or institutional webpage provided in Markdown format.

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
  "sourceUrl": "the url from which the pdf is found",
  "documents": [
    {
      "year": 2022,                      // Extract from the filename or context. Leave null if not found.
      "name": "Annual Report 2021-22",   // Use link text or infer from filename
      "documentUrl": "https://actual-domain.com/report2022.pdf"  // The actual PDF URL from the markdown
    }
  ]
}

Important Instructions:
- Only include documents that help in industry or market analysis.
- Ensure documentUrl always ends in .pdf.
- Only include actual PDF URLs found in the markdown content.
- Do not include any example URLs or placeholder URLs.
- Use the logically correct year. For example for annual report 2021-22, use the year 2022 in the year field.

Use this format exactly. Do not add extra commentary or explanation.`,


    "getNonPdfUrlsPrompt": `
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
}`
}
