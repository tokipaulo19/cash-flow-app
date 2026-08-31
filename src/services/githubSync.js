const API_ROOT = 'https://api.github.com'

export const DEFAULT_GITHUB_SYNC = {
  owner: 'tokipaulo19',
  repo: 'cash-flow-data',
  path: 'cash-flow-data.json',
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
  }

  return btoa(binary)
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function fileUrl(config) {
  const path = config.path.split('/').map(encodeURIComponent).join('/')
  return `${API_ROOT}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`
}

async function githubRequest(config, options = {}) {
  const response = await fetch(fileUrl(config), {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })

  if (response.status === 404 && options.method !== 'PUT') return null

  if (!response.ok) {
    let message = `GitHub returned ${response.status}`
    try {
      const error = await response.json()
      if (error.message) message = error.message
    } catch {
      // Keep the status-based message when GitHub does not return JSON.
    }
    const syncError = new Error(message)
    syncError.status = response.status
    throw syncError
  }

  return response.json()
}

export async function loadGithubData(config) {
  const file = await githubRequest(config)
  if (!file) return null

  const parsed = JSON.parse(decodeBase64(file.content))
  return {
    data: parsed.data || parsed,
    sha: file.sha,
    updatedAt: parsed.updatedAt || null,
  }
}

export async function saveGithubData(config, data, sha = null) {
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    data,
  }
  const body = {
    message: 'Update cash-flow data',
    content: encodeBase64(JSON.stringify(payload, null, 2)),
  }
  if (sha) body.sha = sha

  const response = await githubRequest(config, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    sha: response.content.sha,
    commitUrl: response.commit.html_url,
  }
}
