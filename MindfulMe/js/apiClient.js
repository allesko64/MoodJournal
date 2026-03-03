// Simple shared API client for talking to the FastAPI backend.
// Exposes a global `ApiClient` object.

const ApiClient = (() => {
  const DEFAULT_BASE_URL = 'http://localhost:8000';

  function resolveUrl(path) {
    if (!path) {
      throw new Error('Path is required for ApiClient');
    }
    // Allow passing full URLs directly
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${DEFAULT_BASE_URL}${path}`;
  }

  async function request(path, options = {}) {
    const url = resolveUrl(path);

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
      headers: {
        'Content-Type': 'application/json',
      },
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
    return request(path, {
      method: 'DELETE',
    });
  }

  return {
    get,
    postJson,
    postForm,
    delete: del,
  };
})();

