export async function web_search(query, limit = 5) {
  const startTime = Date.now();
  try {
    // DuckDuckGo Instant Answer API (no key required)
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`);
    const data = await response.json();

    const results = [];

    // Add abstract if available
    if (data.AbstractText) {
      results.push({
        title: data.Heading || data.AbstractSource,
        snippet: data.AbstractText,
        url: data.AbstractURL,
        type: 'instant_answer'
      });
    }

    // Add related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, limit).forEach(topic => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0],
            snippet: topic.Text,
            url: topic.FirstURL,
            type: 'related'
          });
        }
      });
    }

    return {
      status: 'success',
      data: results.slice(0, limit),
      duration_ms: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error.message,
      duration_ms: Date.now() - startTime
    };
  }
}
