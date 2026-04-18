const API_BASE = '/api';

export async function parseQuery(query) {
  const response = await fetch(`${API_BASE}/parse-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

export async function getTrending() {
  const response = await fetch(`${API_BASE}/trending`);
  return response.json();
}

export async function research(intent) {
  const response = await fetch(`${API_BASE}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent })
  });
  return response.json();
}

export function subscribeToResearchStream(intent, callbacks) {
  const eventSource = new EventSource(`${API_BASE}/research/stream`, {
    headers: { 'Content-Type': 'application/json' }
  });

  // This won't work with POST, so we'll use a different approach
  // For now, use polling instead of SSE
  return null;
}

// Polling-based progress tracking
export async function researchWithProgress(intent, onProgress) {
  // For initial implementation, we'll use a simple POST
  // and simulate progress on the client side
  const controller = new AbortController();

  const fetchPromise = fetch(`${API_BASE}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
    signal: controller.signal
  });

  // Send fake progress events while waiting
  const progressInterval = setInterval(() => {
    onProgress?.({
      type: 'waiting',
      message: 'Analyzing data...'
    });
  }, 500);

  try {
    const response = await fetchPromise;
    clearInterval(progressInterval);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') return null;
    throw error;
  } finally {
    clearInterval(progressInterval);
  }
}
