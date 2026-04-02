require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const userTokens = new Map(); // In-memory store: sessionId -> {access_token, user}
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Config from env
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('⚠️ GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set in .env');
}

function setUserToken(sessionId, accessToken) {
  userTokens.set(sessionId, {
    access_token: accessToken,
    createdAt: Date.now(),
  });
}

function getUserToken(sessionId) {
  const userData = userTokens.get(sessionId);
  if (!userData?.access_token) {
    return null;
  }

  const age = Date.now() - (userData.createdAt || 0);
  if (age > TOKEN_TTL_MS) {
    userTokens.delete(sessionId);
    return null;
  }

  return userData;
}

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [sessionId, userData] of userTokens.entries()) {
    const age = now - (userData.createdAt || 0);
    if (age > TOKEN_TTL_MS) {
      userTokens.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredTokens, 60 * 60 * 1000).unref();

// GitHub OAuth token exchange (server-side)
async function exchangeCodeForToken(code, sessionId, state) {
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

  if (!tokenData.access_token) {
    throw new Error('No access token returned by GitHub');
  }

  setUserToken(sessionId, tokenData.access_token);
  return { success: true, sessionId, access_token: tokenData.access_token };
}

// Get Octokit with user token
function getOctokit(sessionId) {
  const userData = getUserToken(sessionId);
  if (!userData?.access_token) {
    throw new Error('No GitHub token found for session. Connect GitHub first.');
  }
  return new Octokit({ auth: userData.access_token });
}

function parseRepoFullName(repoFullName) {
  const [owner, repo] = String(repoFullName).split('/');
  if (!owner || !repo) {
    throw new Error('Invalid repository name format. Expected owner/repo');
  }
  return { owner, repo };
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

// GET authenticated user profile
async function getAuthenticatedUser(sessionId) {
  const octokit = getOctokit(sessionId);
  const { data: user } = await octokit.rest.users.getAuthenticated();
  return {
    login: user.login,
    avatar_url: user.avatar_url,
    bio: user.bio,
    html_url: user.html_url,
  };
}

// GET a single repository details
async function getRepository(sessionId, owner, repo) {
  const octokit = getOctokit(sessionId);
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    name: data.name,
    full_name: data.full_name,
    description: data.description,
    language: data.language,
    private: data.private,
    default_branch: data.default_branch,
    stargazers_count: data.stargazers_count,
    forks_count: data.forks_count,
    open_issues_count: data.open_issues_count,
    html_url: data.html_url,
  };
}

// GET repo files/tree (top-level + recursive simple)
async function getRepoFiles(sessionId, repo) {
  const octokit = getOctokit(sessionId);
  const { owner, repo: repoName } = parseRepoFullName(repo);

  // Resolve the default branch commit, then fetch its tree recursively.
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo: repoName });
  const defaultBranch = repoData.default_branch || 'main';

  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner,
    repo: repoName,
    branch: defaultBranch,
  });

  const commitSha = branchData.commit?.sha;
  if (!commitSha) {
    throw new Error('Unable to resolve repository branch commit SHA');
  }

  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo: repoName,
    commit_sha: commitSha,
  });

  const treeSha = commitData.tree?.sha;
  if (!treeSha) {
    throw new Error('Unable to resolve repository tree SHA');
  }

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo: repoName,
    tree_sha: treeSha,
    recursive: 'true',
  });

  return tree.tree
    .filter(node => node.type === 'blob') // files only
    .map(file => ({ path: file.path, type: file.mode === '100644' ? 'file' : 'exec', sha: file.sha }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// GET file content
async function getFileContent(sessionId, repo, path) {
  const octokit = getOctokit(sessionId);
  const { owner, repo: repoName } = parseRepoFullName(repo);
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: repoName,
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
  const { owner, repo: repoName } = parseRepoFullName(repo);
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo: repoName,
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
  getAuthenticatedUser,
  getRepository,
  getRepoFiles,
  getFileContent,
  getPullRequests,
  getUserToken,
  setUserToken,
  userTokens, // exposed for routes
};

