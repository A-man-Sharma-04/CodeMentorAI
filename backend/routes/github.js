const express = require('express');
const crypto = require('crypto');
const { reviewCode, analyseCode } = require('../services/aiService');
const {
  exchangeCodeForToken,
  getAuthenticatedUser,
  getUserRepos,
  getRepository,
  getRepoFiles,
  getFileContent,
  getPullRequests,
  getUserToken,
  setUserToken,
  userTokens,
} = require('../services/githubService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/auth/github/callback';

const router = express.Router();

// Input validation functions
function validateRepoName(repo) {
  const repoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
  if (!repoRegex.test(repo)) {
    throw new Error('Invalid repository name format');
  }
}

function validateFilePath(filePath) {
  // Prevent directory traversal attacks
  if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\\')) {
    throw new Error('Invalid file path');
  }
  // Basic length check
  if (filePath.length > 500) {
    throw new Error('File path too long');
  }
}

function validateOwnerAndRepo(owner, repo) {
  const segmentRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!segmentRegex.test(owner) || !segmentRegex.test(repo)) {
    throw new Error('Invalid owner or repo');
  }
}

function normalizeBearerToken(rawToken) {
  if (!rawToken) return null;

  let token = String(rawToken).trim();
  if (!token) return null;

  // Guard common bad values from legacy/localStorage-based token flows.
  if (token === 'null' || token === 'undefined' || token === '[object Object]') {
    return null;
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.startsWith('{') && token.endsWith('}')) {
    try {
      const parsed = JSON.parse(token);
      token = String(
        parsed?.access_token || parsed?.token || parsed?.github_token || ''
      ).trim();
    } catch {
      return null;
    }
  }

  return token || null;
}

function looksLikeGitHubToken(token) {
  return /^(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|[a-f0-9]{40})$/.test(token);
}

function ensureGitHubSession(req, res) {
  const existingSessionToken = getUserToken(req.sessionID)?.access_token;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.slice('Bearer '.length).trim();
    const token = normalizeBearerToken(rawToken);

    if (token && looksLikeGitHubToken(token)) {
      if (token !== existingSessionToken) {
        setUserToken(req.sessionID, token);
      }
      req.session.githubConnected = true;
      return true;
    }

    if (!existingSessionToken) {
      req.session.githubConnected = false;
      res.status(401).json({ error: 'Invalid GitHub token. Reconnect GitHub.' });
      return false;
    }
  }

  const userData = getUserToken(req.sessionID);
  if (!userData?.access_token) {
    req.session.githubConnected = false;
    res.status(401).json({ error: 'Session expired, reconnect GitHub' });
    return false;
  }
  return true;
}

function getFrontendBaseUrl() {
  const raw = String(FRONTEND_URL || '').trim() || 'http://localhost:5500';

  try {
    const parsed = new URL(raw);
    const isLocal5500 =
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.port === '5500';
    const isRootPath = !parsed.pathname || parsed.pathname === '/';

    // In this project, Live Server often serves from workspace root, so app pages live under /frontend.
    if (isLocal5500 && isRootPath) {
      parsed.pathname = '/frontend';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

// GET /api/github/oauth - Start OAuth
router.get('/oauth', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: 'repo',
    state,
    redirect_uri: GITHUB_CALLBACK_URL,
  });
  const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session error' });
    }
    res.redirect(githubUrl);
  });
});

// GET /api/github/callback - OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const frontendBase = getFrontendBaseUrl();

  if (error) {
    const message = errorDescription || 'GitHub authorization was cancelled.';
    return res.redirect(`${frontendBase}/index.html?oauth_error=${encodeURIComponent(message)}`);
  }

  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${frontendBase}/index.html`);
  }

  if (!code) {
    return res.redirect(`${frontendBase}/index.html`);
  }

  try {
    const tokenResult = await exchangeCodeForToken(code, req.sessionID, state);
    req.session.githubConnected = true;
    delete req.session.oauthState;

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save error:', saveErr);
      }
      const redirectUrl = `${frontendBase}/repo-review.html?connected=1`;
      res.redirect(redirectUrl);
    });
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect(`${frontendBase}/index.html`);
  }
});

// GET /api/github/user - Authenticated user profile
router.get('/user', async (req, res) => {
  try {
    if (!ensureGitHubSession(req, res)) return;

    const user = await getAuthenticatedUser(req.sessionID);
    res.json(user);
  } catch (err) {
    console.error('User error:', err);
    res.status(err.status === 401 ? 401 : 500).json({ error: err.message });
  }
});

// GET /api/github/repos - List user repos (req.sessionID for auth)
router.get('/repos', async (req, res) => {
  try {
    if (!ensureGitHubSession(req, res)) return;

    const repos = await getUserRepos(req.sessionID);
    res.json({ repos });
  } catch (err) {
    console.error('Repos error:', err);
    res.status(err.status === 401 ? 401 : 500).json({ error: err.message });
  }
});

// GET /api/github/repo-files?repo=owner/repo
router.get('/repo-files', async (req, res) => {
  const { repo } = req.query;
  if (!repo) return res.status(400).json({ error: 'repo param required' });

  try {
    validateRepoName(repo);
    if (!ensureGitHubSession(req, res)) return;

    const files = await getRepoFiles(req.sessionID, repo);
    res.json({ files });
  } catch (err) {
    console.error('Repo files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/file?repo=owner/repo&path=...
router.get('/file', async (req, res) => {
  const { repo, path: filePath } = req.query;
  if (!repo || !filePath) return res.status(400).json({ error: 'repo and path required' });

  try {
    validateRepoName(repo);
    validateFilePath(filePath);
    if (!ensureGitHubSession(req, res)) return;

    const content = await getFileContent(req.sessionID, repo, filePath);
    res.json({ content, path: filePath });
  } catch (err) {
    console.error('File error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/analyze-file {repo, filePath, type: 'review|analyse'}
router.post('/analyze-file', async (req, res) => {
  const { repo, filePath, type = 'review', language } = req.body;
  if (!repo || !filePath) return res.status(400).json({ error: 'repo and filePath required' });

  try {
    validateRepoName(repo);
    validateFilePath(filePath);
    if (!ensureGitHubSession(req, res)) return;

    const content = await getFileContent(req.sessionID, repo, filePath);
    let aiResult;
    if (type === 'analyse') {
      aiResult = await analyseCode(content, language);
    } else {
      aiResult = await reviewCode(content, language);
    }
    res.json({
      ...aiResult,
      repo,
      filePath,
      message: `Analysis complete for ${filePath}`,
    });
  } catch (err) {
    console.error('Analyze file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/prs?repo=owner/repo
router.get('/prs', async (req, res) => {
  const { repo, state = 'open' } = req.query;
  if (!repo) return res.status(400).json({ error: 'repo param required' });

  try {
    validateRepoName(repo);
    if (!ensureGitHubSession(req, res)) return;

    const prs = await getPullRequests(req.sessionID, repo, state);
    res.json({ prs });
  } catch (err) {
    console.error('PRs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/status
router.get('/status', (req, res) => {
  const hasToken = !!getUserToken(req.sessionID);
  if (!hasToken && req.session.githubConnected) {
    req.session.githubConnected = false;
  }

  res.json({
    connected: hasToken && !!req.session.githubConnected,
    sessionId: req.sessionID,
    hasToken,
  });
});

// GET /api/github/repos/:owner/:repo - Fetch repository details
router.get('/repos/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;

  try {
    validateOwnerAndRepo(owner, repo);
    if (!ensureGitHubSession(req, res)) return;

    const repository = await getRepository(req.sessionID, owner, repo);
    res.json({ repository });
  } catch (err) {
    console.error('Repo detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/files - Fetch repository file tree
router.get('/repos/:owner/:repo/files', async (req, res) => {
  const { owner, repo } = req.params;

  try {
    validateOwnerAndRepo(owner, repo);
    if (!ensureGitHubSession(req, res)) return;

    const files = await getRepoFiles(req.sessionID, `${owner}/${repo}`);
    res.json({ files });
  } catch (err) {
    console.error('Repo files by params error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/github/repos/:owner/:repo/file/* - Fetch file content by path
router.get('/repos/:owner/:repo/file/*', async (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.params[0];

  if (!filePath) {
    return res.status(400).json({ error: 'file path required' });
  }

  try {
    validateOwnerAndRepo(owner, repo);
    validateFilePath(filePath);
    if (!ensureGitHubSession(req, res)) return;

    const content = await getFileContent(req.sessionID, `${owner}/${repo}`, filePath);
    res.json({ content, path: filePath });
  } catch (err) {
    console.error('Repo file by params error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

