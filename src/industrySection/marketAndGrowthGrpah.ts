import { getMostRelevantItem, toolCalling } from "../utils/toolCalling";

export async function marketAndGrowthGraph(query: string) {
    const response = await toolCalling(query, true, true, true);
    console.log("market function response",response);
    if(response.exactGraphs.length === 1){
        return response.exactGraphs[0];
    }
    if(response.exactGraphs.length > 1){
        const mostRelevantItem = await getMostRelevantItem(query, response.exactGraphs, "graph");
        console.log("mostRelevantItem",mostRelevantItem);
        return mostRelevantItem;
    }
    return response;
}

marketAndGrowthGraph("market size and Growth");