require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const userTokens = new Map(); // In-memory store: sessionId -> {access_token, user}

// Config from env
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('⚠️ GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set in .env');
}

// GitHub OAuth token exchange (server-side)
async function exchangeCodeForToken(code, state) {
  const sessionId = state; // Use state as simple sessionId
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub app credentials not configured');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      state,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(`OAuth error: ${tokenData.error_description || tokenData.error}`);
  }

  userTokens.set(sessionId, { access_token: tokenData.access_token });
  return { success: true, sessionId };
}

// Get Octokit with user token
function getOctokit(sessionId) {
  const userData = userTokens.get(sessionId);
  if (!userData?.access_token) {
    throw new Error('No GitHub token found for session. Connect GitHub first.');
  }
  return new Octokit({ auth: userData.access_token });
}

// GET user repos
async function getUserRepos(sessionId) {
  const octokit = getOctokit(sessionId);
  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 20,
  });
  return repos.map(repo => ({
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    private: repo.private,
    html_url: repo.html_url,
  }));
}

// GET repo files/tree (top-level + recursive simple)
async function getRepoFiles(sessionId, repo) {
  const octokit = getOctokit(sessionId);
  const { data: tree } = await octokit.rest.git.getTree({ owner: repo.split('/')[0], repo: repo.split('/')[1], recursive: true });
  return tree.tree
    .filter(node => node.type === 'blob') // files only
    .map(file => ({ path: file.path, type: file.mode === '100644' ? 'file' : 'exec', sha: file.sha }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// GET file content
async function getFileContent(sessionId, repo, path) {
  const octokit = getOctokit(sessionId);
  const { data } = await octokit.rest.repos.getContent({
    owner: repo.split('/')[0],
    repo: repo.split('/')[1],
    path,
  });
  if (data.type !== 'file') {
    throw new Error('Not a file');
  }
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

// GET PRs (bonus)
async function getPullRequests(sessionId, repo, state = 'open') {
  const octokit = getOctokit(sessionId);
  const { data: prs } = await octokit.rest.pulls.list({
    owner: repo.split('/')[0],
    repo: repo.split('/')[1],
    state,
    sort: 'created',
    direction: 'desc',
    per_page: 10,
  });
  return prs.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    html_url: pr.html_url,
    additions: pr.additions,
    deletions: pr.deletions,
  }));
}

module.exports = {
  exchangeCodeForToken,
  getUserRepos,
  getRepoFiles,
  getFileContent,
  getPullRequests,
  userTokens, // exposed for routes
};

