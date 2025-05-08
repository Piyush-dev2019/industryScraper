import fs from 'fs';
import path from 'path';

interface IgodSources {
    organizationName: string;
    url: string;
    type: string;
}

const igodSources = JSON.parse(fs.readFileSync(path.join(__dirname, '../../igodSources.json'), 'utf8'));
const particularSources = new Set<string>();

const processSources = (sources: IgodSources[]) => {
    sources.forEach(source => {
        if (source.type === 'particular') {
            particularSources.add(JSON.stringify(source));
        }
    });
};

// Process the sources
processSources(igodSources);

// Convert Set back to objects
const particularSourcesObjects = Array.from(particularSources).map(source => JSON.parse(source) as IgodSources);

// Save to JSON file
const outputPath = path.join(__dirname, '../../particularSources.json');
fs.writeFileSync(outputPath, JSON.stringify(particularSourcesObjects, null, 2));


console.log(`Total particular sources found: ${particularSourcesObjects.length}`);
