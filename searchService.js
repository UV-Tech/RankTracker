const axios = require('axios');

const getGoogleRank = async (domain, keyword) => {
    try {
        console.log('Starting Google rank check with:', { domain, keyword });
        
        // Check for API key
        const apiKey = process.env.GOOGLE_API_KEY;
        const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        console.log('API Key status:', apiKey ? 'Present' : 'Missing');
        console.log('Search Engine ID status:', searchEngineId ? 'Present' : 'Missing');
        
        if (!apiKey) {
            console.error('GOOGLE_API_KEY is missing from environment variables');
            throw new Error('GOOGLE_API_KEY is not configured');
        }
        
        if (!searchEngineId) {
            console.error('GOOGLE_SEARCH_ENGINE_ID is missing from environment variables');
            throw new Error('GOOGLE_SEARCH_ENGINE_ID is not configured');
        }

        // Normalize the domain by removing protocol and www if present
        const normalizedDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .trim();
        console.log('Normalized domain:', normalizedDomain);

        // Create the search parameters
        const searchParams = {
            key: apiKey,
            cx: searchEngineId,
            q: keyword,
            num: 10 // Maximum allowed is 10, use pagination for more
        };

        console.log('Making Google Custom Search request for:', keyword);
        
        try {
            // Make the initial request for first 10 results
            let allItems = [];
            let position = -1;
            
            // Loop through multiple requests to get up to 100 results (10 pages of 10 results)
            for (let startIndex = 1; startIndex <= 91 && position === -1; startIndex += 10) {
                const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                    params: {
                        ...searchParams,
                        start: startIndex
                    }
                });
                
                console.log(`Received results ${startIndex} to ${startIndex + 9}`);
                
                if (!response.data || !response.data.items) {
                    // If no more results or error, break the loop
                    console.log(`No more results after index ${startIndex-1}`);
                    break;
                }
                
                const items = response.data.items;
                allItems = [...allItems, ...items];
                
                // Check if domain is in this batch of results
                const batchPosition = items.findIndex(item => {
                    const itemUrl = (item.link || '').toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .replace(/^www\./, '')
                        .trim();
                    
                    const isMatch = itemUrl.includes(normalizedDomain);
                    console.log(`Checking result URL: ${itemUrl} against ${normalizedDomain} - Match: ${isMatch}`);
                    return isMatch;
                });
                
                if (batchPosition !== -1) {
                    position = startIndex - 1 + batchPosition;
                    console.log(`Domain found at position ${position + 1}`);
                    return position + 1;
                }
                
                // Check if we have fewer than 10 results, which means we've reached the end
                if (items.length < 10) {
                    console.log(`Reached end of results at ${startIndex + items.length - 1}`);
                    break;
                }
                
                // Small delay to avoid overwhelming the API
                if (startIndex < 91) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            console.log(`Checked ${allItems.length} results, domain not found`);
            
            if (allItems.length === 0) {
                console.error('No results returned from API');
                throw new Error('No search results found');
            }
            
            // If we get here, the domain wasn't found in any of the results
            console.log('Domain not found in first 100 results');
            return 'Not found in top 100';
        } catch (apiError) {
            console.error('API Request Error:', {
                message: apiError.message,
                code: apiError.response?.data?.error?.code,
                reason: apiError.response?.data?.error?.message,
                status: apiError.response?.status
            });
            
            if (apiError.response?.data?.error?.message) {
                throw new Error(`Google API Error: ${apiError.response.data.error.message}`);
            }
            
            throw apiError;
        }
    } catch (error) {
        console.error('Detailed error in getGoogleRank:', {
            message: error.message,
            type: error.constructor.name
        });
        
        throw new Error(`Failed to fetch Google rankings: ${error.message}`);
    }
};

module.exports = {
    getGoogleRank
}; 