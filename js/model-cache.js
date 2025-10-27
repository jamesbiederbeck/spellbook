// model-cache.js
// Simple caching helper for model files

const cache = new Map();

export async function cachedFetch(url) {
  if (cache.has(url)) {
    console.log(`📦 Cache hit for ${url}`);
    return cache.get(url);
  }
  
  console.log(`🌐 Fetching ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  
  // Clone the response for caching
  const clonedResponse = response.clone();
  cache.set(url, clonedResponse);
  
  return response;
}
