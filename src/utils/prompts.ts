export const governmentWebsitePrompt = {

"rankLinksPrompt": `Analyze the following URLs and rank the most relevant ones for finding information about:
  - Annual Reports
  - Industry Strategy Documents
  - Financial Reports
  - Mission Plans
  - Sectoral Publications

Strict Filtering Rules:
1. Ignore any links to content older than 2020 or archive pages before 2020.
2. Ignore any paginated URLs beyond page 2 (e.g., URLs with "page=3" or "page/4").
3. Ignore links that are not in English (e.g., URLs containing "/hi/" or hindi words).
4. Ignore links to general notices, circulars, tenders, guidelines, operational memos, reforms, or purely administrative content.
5. Ignore links to monthly or weekly summary reports.

Return ONLY a JSON array in this exact format — no explanation or extra output:

[
  {
    "reason": "High-level document hub covering annual reports and strategies",
    "url": "http://example.com",
    "relevance_score": 95,
  }
]

`,


    "getPdfUrlsPrompt": `You are a data extraction assistant helping to analyze a government or institutional webpage provided in Markdown format.

Your task is to extract only the relevant PDF document links that can support industry analysis, such as:
- Annual Reports
- Financial Reports
- Sectoral Publications
- Mission Plans
- Industry Strategy Documents

Important Instructions:
- Ignore any links that do not end in .pdf.
- Only include actual PDF URLs found in the markdown content, **Do not** add .pdf on your own to any url.
- Ignore any links that appear to be from before 2020 based on dates in the filename, URL, or surrounding context
- Ignore links that are not in English (e.g. URLs containing "/hi/" or hindi words).
- Ignore links to general notices, circulars, tenders, guidelines, operational memos, reforms, or purely administrative content.
- Ignore links to monthly or weekly summary reports.
- Ignore any state specific links, document should be related to entire country.
- Use the logically correct year. For example for annual report 2021-22, use the year 2022 in the year field. Do not give preferecne to the published year.
- Give name of the document based on the url. if you are not sure about the name, leave it blank.

For each PDF link found, extract and return the following structured JSON object:

{
  "sourceUrl": "the url from which the pdf is found",
  "documents": [
    {
      "reasoning": "short one line reasoning for the name and year of the document", 
      "year": 2021,       
      "name": "Annual Report 2020-21",   
      "documentUrl": "https://actual-domain.com/report2021.pdf"  // Do not add ".pdf" on your own to any url.
    }
  ]
}`,


    "getNonPdfUrlsPrompt": `
    You are an intelligent web assistant that processes Markdown content from government, institutional, or company websites.

Your task is to extract **only the links** (URLs) that are **Highly Likely to lead to pages containing important documents** for industry research and analysis, such as:
- Sector/Industry Reports
- Annual Reports
- Publications
- Financial Reports
- Mission Plans
- Strategy Documents
etc.

Instructions:
1. **Ignore** any links that point directly to .pdf files (those are handled in a separate step).
2. **Only return** links that likely **lead to** document repositories or report listing pages (e.g., pages with headings like "Reports", "Publications", "Documents", "Resources", "Archives", "Downloads", etc.).
3. Return a JSON array under the key possibleUrls containing only the actual URLs found in the provided markdown content.
4. Do not include any example URLs or placeholder URLs.
5. Only include URLs that are actually present in the markdown content.
6. **Ignore** any links that redirect to content older than 2020 or archive pages before 2020.
7. For paginated URLs, if a URL contains "page" or page numbers (e.g. "page=2", "page/3"), only include URLs up to page 2 and ignore any URLs with higher page numbers.
8. Ignore any links that are not in English for example url containing (/hi/) or hindi words.
9. Ignore links to general notices, circulars, tenders, guidelines, operational memos, reforms, or purely administrative content.
10. Ignore links to monthly or weekly summary reports.

Return the response in this exact format:
  [
    {
      "reasoning": "short one line reasoning for the url",
      "url": "https://example.com",
    },
    {
      "reasoning": "short one line reasoning for the url",
      "url": "https://example.com",
    }
    ...
  ]`

}


export const brokerageWebsitePrompt = {
    "rankLinksPrompt": `
    Analyze the following URLs and rank the most relevant ones for finding information about any type of industry or sector.

Return ONLY a JSON array in this exact format — no explanation or extra output:

[
  {
    "reason": "High-level industry information hub",
    "url": "http://example.com",
    "relevance_score": 95
  }
]

`,
    "getPdfUrlsPrompt": `You are a data extraction assistant helping to analyze a government or institutional webpage provided in Markdown format.

Your task is to extract only the relevant PDF document links that can support industry analysis, such as:
- Annual Reports
- Financial Reports
- Sectoral Publications
- Mission Plans
- Industry Strategy Documents

Important Instructions:
- Ignore any links that do not end in .pdf.
- Only include actual PDF URLs found in the markdown content, **Do not** add .pdf on your own to any url.
- Ignore any links that appear to be from before 2020 based on dates in the filename, URL, or surrounding context
- Ignore links that are not in English (e.g. URLs containing "/hi/" or hindi words).
- Ignore links to general notices, circulars, tenders, guidelines, operational memos, reforms, or purely administrative content.
- Ignore links to monthly or weekly summary reports.
- Ignore any state specific links, document should be related to entire country.
- Use the logically correct year. For example for annual report 2021-22, use the year 2022 in the year field. Do not give preferecne to the published year.
- Give name of the document based on the url. if you are not sure about the name, leave it blank.

For each PDF link found, extract and return the following structured JSON object:

{
  "sourceUrl": "the url from which the pdf is found",
  "documents": [
    {
      "reasoning": "short one line reasoning for the name and year of the document", 
      "year": 2021,       
      "name": "Annual Report 2020-21",   
      "documentUrl": "https://actual-domain.com/report2021.pdf"  // Do not add ".pdf" on your own to any url.
    }
  ]
}`,


    "getNonPdfUrlsPrompt": `
    You are an intelligent web assistant that processes Markdown content from government, institutional, or company websites.

Your task is to extract **only the links** (URLs) that are **Highly Likely to lead to pages containing important documents** for industry research and analysis, such as:
- Sector/Industry Reports
- Annual Reports
- Publications
- Financial Reports
- Mission Plans
- Strategy Documents
etc.

Instructions:
1. **Ignore** any links that point directly to .pdf files (those are handled in a separate step).
2. **Only return** links that likely **lead to** document repositories or report listing pages (e.g., pages with headings like "Reports", "Publications", "Documents", "Resources", "Archives", "Downloads", etc.).
3. Return a JSON array under the key possibleUrls containing only the actual URLs found in the provided markdown content.
4. Do not include any example URLs or placeholder URLs.
5. Only include URLs that are actually present in the markdown content.
6. **Ignore** any links that redirect to content older than 2020 or archive pages before 2020.
7. For paginated URLs, if a URL contains "page" or page numbers (e.g. "page=2", "page/3"), only include URLs up to page 2 and ignore any URLs with higher page numbers.
8. Ignore any links that are not in English for example url containing (/hi/) or hindi words.
9. Ignore links to general notices, circulars, tenders, guidelines, operational memos, reforms, or purely administrative content.
10. Ignore links to monthly or weekly summary reports.

Return the response in this exact format:
  [
    {
      "reasoning": "short one line reasoning for the url",
      "url": "https://example.com",
    },
    {
      "reasoning": "short one line reasoning for the url",
      "url": "https://example.com",
    }
    ...
  ]`
}
