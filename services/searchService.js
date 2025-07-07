const axios = require('axios');
const logger = require('../utils/logger');

const isUrlMatchingDomain = (url, domain) => {
    if (!url || !domain) return false;
    
    try {
        // Normalize both URLs for comparison
        const normalizedUrl = url.toLowerCase()
            .replace(/^https?:\/\//, '')  // Remove protocol
            .replace(/^www\./, '')        // Remove www
            .trim();
        
        const normalizedDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')  // Remove protocol
            .replace(/^www\./, '')        // Remove www
            .trim();
        
        // Extract just the domain part (everything before the first /)
        const urlDomain = normalizedUrl.split('/')[0];
        const domainPart = normalizedDomain.split('/')[0];
        
        // Check for exact match first
        if (urlDomain === domainPart) {
            return true;
        }
        
        // Check if domain is a subdomain
        if (urlDomain.endsWith(`.${domainPart}`)) {
            return true;
        }
        
        // Check if url contains the domain
        if (urlDomain.includes(domainPart)) {
            return true;
        }
        
        // More permissive check: check if the full URL contains the domain
        if (normalizedUrl.includes(domainPart)) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error in isUrlMatchingDomain:', error.message);
        // If there's an error in matching, be conservative and return false
        return false;
    }
};

// Function to log search results in detail
const logSearchResults = (keyword, domain, results) => {
    try {
        const timestamp = new Date().toISOString();
        
        // Create a detailed log of the search results with clear separators
        let logMessage = `\n=================================================================\n`;
        logMessage += `[${timestamp}] SEARCH RESULTS for keyword "${keyword}" and domain "${domain}"\n`;
        logMessage += `=================================================================\n\n`;
        
        if (results && results.items) {
            logMessage += `Total items found: ${results.items.length}\n\n`;
            
            results.items.forEach((item, index) => {
                try {
                    // Format the result number with padding for readability
                    const resultNum = String(index + 1).padStart(2, '0');
                    
                    logMessage += `[Result ${resultNum}] ${item.title || 'No title'}\n`;
                    logMessage += `URL: ${item.link || 'No link'}\n`;
                    
                    // Add display link which is often the formatted URL shown in search results
                    if (item.displayLink) {
                        logMessage += `Display URL: ${item.displayLink}\n`;
                    }
                    
                    // Include the snippet
                    logMessage += `Snippet: ${item.snippet || 'No snippet'}\n`;
                    
                    // Include any pagemap data if available
                    if (item.pagemap) {
                        try {
                            if (item.pagemap.metatags && item.pagemap.metatags.length > 0) {
                                const metatags = item.pagemap.metatags[0];
                                logMessage += `Title tag: ${metatags['og:title'] || metatags['twitter:title'] || 'N/A'}\n`;
                                logMessage += `Description: ${metatags['og:description'] || metatags['twitter:description'] || metatags['description'] || 'N/A'}\n`;
                            }
                        } catch (metaErr) {
                            logMessage += `Error parsing metatags: ${metaErr.message}\n`;
                        }
                    }
                    
                    // Check if this result matches the domain
                    let isMatch = false;
                    try {
                        if (item.link) {
                            const itemUrl = item.link.toLowerCase()
                                .replace(/^https?:\/\//, '')
                                .replace(/^www\./, '')
                                .trim();
                            
                            const normalizedDomain = domain.toLowerCase()
                                .replace(/^https?:\/\//, '')
                                .replace(/^www\./, '')
                                .trim();
                            
                            isMatch = isUrlMatchingDomain(item.link, domain);
                            
                            // Make matches very visible in the log
                            if (isMatch) {
                                logMessage += `\n!!! MATCH WITH DOMAIN !!!\n`;
                                logMessage += `Result URL: ${itemUrl}\n`;
                                logMessage += `Domain: ${normalizedDomain}\n\n`;
                            } else {
                                logMessage += `Match with domain? No\n\n`;
                            }
                        } else {
                            logMessage += `Match with domain? No (no link)\n\n`;
                        }
                    } catch (matchErr) {
                        logMessage += `Error checking domain match: ${matchErr.message}\n\n`;
                    }
                    
                    // Add a separator between results
                    logMessage += `------------------------------------------\n\n`;
                } catch (itemErr) {
                    logMessage += `Error processing search result ${index + 1}: ${itemErr.message}\n`;
                    logMessage += `------------------------------------------\n\n`;
                }
            });
        } else {
            logMessage += `No items found in results or invalid results object\n`;
            try {
                logMessage += JSON.stringify(results, null, 2);
            } catch (jsonErr) {
                logMessage += `Error stringifying results: ${jsonErr.message}\n`;
            }
        }
        
        // Log any special search features that Google might return
        if (results && results.searchInformation) {
            logMessage += `\nSearch Information:\n`;
            logMessage += `Total Results: ${results.searchInformation.totalResults || 'Unknown'}\n`;
            logMessage += `Search Time: ${results.searchInformation.searchTime || 'Unknown'} seconds\n`;
        }
        
        logMessage += `\n=================================================================\n`;
        
        // Write to file using the logger
        logger.writeToFile(logMessage);
    } catch (err) {
        console.error('Error in logSearchResults:', err.message);
        // Still try to log something to console in case of error
        try {
            console.log(`Search results for keyword "${keyword}" and domain "${domain}" - logging failed: ${err.message}`);
        } catch (e) {
            // Last resort
            console.error('Failed to log search results');
        }
    }
};

const getGoogleRank = async (domain, keyword) => {
    try {
        logger.info(`Starting Google rank check`, { domain, keyword });
        
        // Check for API key
        const apiKey = process.env.GOOGLE_API_KEY;
        const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        
        logger.debug('API credentials status', {
            apiKey: apiKey ? 'Present' : 'Missing',
            searchEngineId: searchEngineId ? 'Present' : 'Missing'
        });
        
        if (!apiKey) {
            logger.error('GOOGLE_API_KEY is missing from environment variables');
            throw new Error('GOOGLE_API_KEY is not configured');
        }
        
        if (!searchEngineId) {
            logger.error('GOOGLE_SEARCH_ENGINE_ID is missing from environment variables');
            throw new Error('GOOGLE_SEARCH_ENGINE_ID is not configured');
        }

        // Validate domain is provided
        if (!domain) {
            logger.error('Domain is undefined or null');
            throw new Error('Domain is required for rank checking');
        }

        // Normalize the domain by removing protocol and www if present
        const normalizedDomain = domain.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .trim();
        logger.debug('Normalized domain', { original: domain, normalized: normalizedDomain });

        // Create the search parameters
        const searchParams = {
            key: apiKey,
            cx: searchEngineId,
            q: keyword,
            gl: 'IL', 
            num: 10 
        };

        logger.info(`Making Google Custom Search request for: "${keyword}"`);
        
        // Make the initial request for first 10 results
        let allItems = [];
        let position = -1;
        let adPosition = -1;
        
        // Loop through multiple requests to get up to 100 results (10 pages of 10 results)
        for (let startIndex = 1; startIndex <= 91 && position === -1; startIndex += 10) {
            try {
                logger.debug(`Requesting results batch ${Math.ceil(startIndex/10)}`, { startIndex });
                
                const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                    params: {
                        ...searchParams,
                        start: startIndex
                    },
                    headers: {
                        'Accept-Charset': 'UTF-8' // Ensure proper charset handling
                    }
                });
                
                // Log detailed information about the response
                logger.debug(`API Response status: ${response.status}`, {
                    url: response.config.url,
                    headers: response.headers,
                    requestId: response.headers['x-request-id'] || 'N/A',
                    hasItems: !!response.data.items,
                    itemCount: response.data.items ? response.data.items.length : 0
                });
                
                // Log the search results to file for debugging
                try {
                    logSearchResults(keyword, normalizedDomain, response.data);
                } catch (logError) {
                    logger.error(`Failed to log search results: ${logError.message}`);
                }
                
                logger.info(`Received results ${startIndex} to ${startIndex + 9}`);
                
                if (!response.data) {
                    logger.error('Empty response from API');
                    break;
                }
                
                // Check for ads/promotions first if they exist
                if (startIndex === 1 && response.data.promotions && response.data.promotions.length > 0) {
                    logger.info(`Found ${response.data.promotions.length} ad results`);
                    
                    // Only check ads in the first page
                    const adResults = response.data.promotions;
                    
                    // Check if domain is in ad results
                    try {
                        const adMatch = adResults.findIndex(ad => {
                            if (!ad.link) return false;
                            
                            try {
                                const adUrl = ad.link.toLowerCase()
                                    .replace(/^https?:\/\//, '')
                                    .replace(/^www\./, '')
                                    .trim();
                                
                                const isMatch = isUrlMatchingDomain(adUrl, normalizedDomain);
                                logger.debug(`Checking ad URL match`, { 
                                    adUrl, 
                                    normalizedDomain, 
                                    isMatch 
                                });
                                return isMatch;
                            } catch (e) {
                                logger.error(`Error checking ad URL match: ${e.message}`);
                                return false;
                            }
                        });
                        
                        if (adMatch !== -1) {
                            adPosition = adMatch;
                            logger.info(`Domain found in ads at position ${adPosition + 1}`);
                        }
                    } catch (adError) {
                        logger.error(`Error processing ad results: ${adError.message}`);
                    }
                }
                
                if (!response.data.items) {
                    // If no results, break the loop
                    logger.info(`No organic results found after index ${startIndex-1}`);
                    break;
                }
                
                const items = response.data.items;
                allItems = [...allItems, ...items];
                
                // Check if domain is in this batch of organic results
                try {
                    const batchPosition = items.findIndex(item => {
                        if (!item.link) return false;
                        
                        try {
                            const itemUrl = item.link.toLowerCase()
                                .replace(/^https?:\/\//, '')
                                .replace(/^www\./, '')
                                .trim();
                            
                            const isMatch = isUrlMatchingDomain(itemUrl, normalizedDomain);
                            logger.debug(`Checking result URL match`, { 
                                position: startIndex + items.indexOf(item), 
                                itemUrl, 
                                normalizedDomain, 
                                isMatch 
                            });
                            return isMatch;
                        } catch (e) {
                            logger.error(`Error checking URL match: ${e.message}`);
                            return false;
                        }
                    });
                    
                    if (batchPosition !== -1) {
                        position = startIndex - 1 + batchPosition;
                        logger.info(`Domain found in organic results at position ${position + 1}`);
                        
                        // If domain is also found in ads, return the ad position instead if it's better
                        if (adPosition !== -1 && adPosition < position) {
                            logger.info(`Using ad position ${adPosition + 1} instead of organic position ${position + 1}`);
                            return adPosition + 1;
                        }
                        
                        return position + 1;
                    }
                } catch (matchError) {
                    logger.error(`Error processing organic results: ${matchError.message}`);
                }
                
                // Check if we have fewer than 10 results, which means we've reached the end
                if (items.length < 10) {
                    logger.info(`Reached end of results at ${startIndex + items.length - 1}`);
                    break;
                }
                
                // Small delay to avoid overwhelming the API
                if (startIndex < 91) {
                    logger.debug('Adding delay before next batch request');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (batchError) {
                logger.error(`Error processing batch ${Math.ceil(startIndex/10)}`, batchError);
                // Continue with next batch instead of failing completely
            }
        }
        
        logger.info(`Checked ${allItems.length} organic results, domain not found in organic results`);
        
        // If domain was found in ads but not in organic results, return the ad position and the list of URLs
        const urlList = allItems.map((item, idx) => `${idx + 1}. ${item.link || ''}`);
        if (adPosition !== -1) {
            logger.info(`Domain only found in ads at position ${adPosition + 1}`);
            return {
                rank: `Ad: ${adPosition + 1}`,
                urls: urlList
            };
        }
        
        if (allItems.length === 0) {
            logger.error('No organic results returned from API for keyword: ' + keyword);
            return {
                rank: 'No results found',
                urls: []
            };
        }
        
        // If we get here, the domain wasn't found in any of the results
        logger.info('Domain not found in first 100 results or ads');
        return {
            rank: 'Not found in top 100',
            urls: urlList
        };
    } catch (error) {
        logger.error('Detailed error in getGoogleRank', error);
        throw new Error(`Failed to fetch Google rankings: ${error.message}`);
    }
};

module.exports = {
    getGoogleRank
}; 