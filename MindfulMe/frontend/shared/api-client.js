// Simple shared API client — same-origin since FastAPI serves the frontend.
// No base URL needed: all paths are relative (e.g. /api/journals).

const ApiClient = (() => {
  async function request(path, options = {}) {
    // Allow passing full URLs directly (e.g. for XHR upload fallback)
    const url = path.startsWith('http') ? path : path;

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let body;
    try {
      body = isJson ? await response.json() : await response.text();
    } catch (e) {
      body = null;
    }

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  function get(path) {
    return request(path);
  }

  function postJson(path, data) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });
  }

  function postForm(path, formData) {
    return request(path, {
      method: 'POST',
      body: formData,
    });
  }

  function del(path) {
    return request(path, { method: 'DELETE' });
  }

  return { get, postJson, postForm, delete: del };
})();
