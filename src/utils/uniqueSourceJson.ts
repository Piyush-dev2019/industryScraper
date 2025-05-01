import fs from 'fs';
import path from 'path';

interface Source {
    organization: string;
    sourceUrl: string;
    access: string;
    type: string;
    remarks?: string;
}

const pvtBodies = JSON.parse(fs.readFileSync(path.join(__dirname, '../../pvtBodies2.json'), 'utf8'));
const uniqueSources = new Set<string>();

const processSources = (sources: Source[]) => {
    sources.forEach(source => {
        uniqueSources.add(JSON.stringify(source));
    });
};

pvtBodies.forEach((item: any) => {
    if (item.basicIndustries) {
        // Handle case with basicIndustries array
        item.basicIndustries.forEach((basicIndustry: any) => {
            if (basicIndustry.sources) {
                processSources(basicIndustry.sources);
            }
        });
    } else if (item.sources) {
        // Handle case with single basicIndustry
        processSources(item.sources);
    }
});

// Convert Set back to objects
const uniqueSourceObjects = Array.from(uniqueSources).map(source => JSON.parse(source) as Source);

// Save to JSON file
const outputPath = path.join(__dirname, '../../uniqueSources.json');
fs.writeFileSync(outputPath, JSON.stringify(uniqueSourceObjects, null, 2));

console.log(`Unique sources have been saved to ${outputPath}`);
console.log(`Total unique sources found: ${uniqueSourceObjects.length}`);

