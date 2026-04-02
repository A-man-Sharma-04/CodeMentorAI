// ============================================================================
// 🔐 GitHub Connection Check & Token Handler
// ============================================================================
// Extract token from OAuth callback and save to localStorage
github?.handleOAuthCallback();

document.addEventListener('DOMContentLoaded', function () {

  const codeEditor = document.getElementById('code-editor');
  const languageSelect = document.getElementById('language-select');
  const submitBtn = document.getElementById('submit-btn');
  const results = document.getElementById('results');
  const scoreBadge = document.getElementById('score-badge');
  const resultContent = document.getElementById('result-content');
  const copyBtn = document.getElementById('copy-feedback');
  const newReviewBtn = document.getElementById('new-review');
  const clearBtn = document.getElementById('clear-btn');
  
  // GitHub elements
  const githubConnectBtn = document.getElementById('github-connect-btn');
  const githubReposBtn = document.getElementById('github-repos-btn');
  const githubStatus = document.getElementById('github-status');
  const githubReposPanel = document.getElementById('github-repos-panel');
  const githubFilesPanel = document.getElementById('github-files-panel');
  const reposList = document.getElementById('repos-list');
  const filesList = document.getElementById('files-list');
  const closeReposBtn = document.getElementById('close-repos-btn');
  const closeFilesBtn = document.getElementById('close-files-btn');

  let githubConnected = false;
  let currentRepo = null;
  let currentSessionId = localStorage.getItem('githubSessionId') || null;

  
  if (!codeEditor || !submitBtn || !resultContent) {
    console.error("❌ Missing required HTML elements");
    return;
  }

  // GitHub init
  initGitHub();


  codeEditor.addEventListener('input', function () {
    const maxHeight = 460;
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
    this.style.overflowY = this.scrollHeight > maxHeight ? 'auto' : 'hidden';
  });
  submitBtn.addEventListener('click', async () => {
    const code = codeEditor.value.trim();
    const language = languageSelect?.value || "javascript";

    if (!code) {
      alert('Please enter some code');
      codeEditor.focus();
      return;
    }

    // Loading state
    submitBtn.textContent = 'Analyzing...';
    submitBtn.disabled = true;

    resultContent.innerHTML = `
      <div class="loading">
        <p>⚡ Analyzing your code with AI...</p>
      </div>
    `;
    results?.classList.remove('hidden');

    try {
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : '';
      const response = await fetch(`${apiUrl}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.status}`);
      }

      // Safe JSON parsing
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Invalid JSON:", text);
        throw new Error("Invalid response from server");
      }

      displayResults(data);

    } catch (error) {
      console.error(error);

      const errorMsg = error.message || 'Unknown error occurred';
      if (resultContent) {
        resultContent.innerHTML = `
          <div class="error">
            <h4>⚠️ Error</h4>
            <p>${escapeHtml(errorMsg)}</p>
            <p>👉 Make sure backend is running and accessible</p>
          </div>
        `;
      }
      results?.classList.remove('hidden');

    } finally {
      submitBtn.textContent = 'Get AI Review';
      submitBtn.disabled = false;
    }
  });

  function displayResults(data) {
    results?.classList.remove('hidden');

    // Score
    if (scoreBadge) {
      scoreBadge.innerHTML = `
        <span class="badge score">
          Score: ${data.score ?? 'N/A'}/100
        </span>
      `;
    }

    // Issues
    const issuesHtml = data.issues?.length
      ? data.issues.map(issue => `
        <div class="issue-item ${issue.severity || 'info'}">
          <strong>
            ${(issue.type || 'Issue').toUpperCase()} 
            (${(issue.severity || 'info').toUpperCase()})
          </strong>
          ${issue.line ? ` - Line ${issue.line}` : ''}
            <p>${escapeHtml(issue.description || issue)}</p>
          ${issue.fix ? `<code>${escapeHtml(issue.fix)}</code>` : ''}
        </div>
      `).join('')
      : `<p class="no-issues">🎉 No issues found! Great job.</p>`;

    // Summary
    const summaryHtml = data.summary
        ? `<div class="review-summary">${escapeHtml(data.summary)}</div>`
      : '';

    // Refactored Code
const refactoredHtml = data.optimized_code || data.refactored_code
      ? `
        <div class="refactored-code">
          <h4>✨ Optimized Code:</h4>
          <pre><code>${escapeHtml(data.optimized_code || data.refactored_code)}</code></pre>
        </div>
      `
      : '';

    // Final render
    resultContent.innerHTML = `
      ${summaryHtml}
      <div class="review-issues">
        <h4>Issues Found:</h4>
        ${issuesHtml}
      </div>
      ${refactoredHtml}
    `;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = resultContent.innerText;

      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#10b981';

        setTimeout(() => {
          copyBtn.textContent = 'Copy Feedback';
          copyBtn.style.background = '';
        }, 2000);

      } catch {
        alert('Copy failed');
      }
    });
  }

 
  if (newReviewBtn) {
    newReviewBtn.addEventListener('click', () => {
      results?.classList.add('hidden');
      codeEditor.value = '';
      codeEditor.style.height = 'auto';
      codeEditor.style.overflowY = 'auto';
      codeEditor.focus();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      codeEditor.value = '';
      codeEditor.style.height = 'auto';
      codeEditor.style.overflowY = 'auto';
      codeEditor.focus();
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

// GitHub functions
  async function initGitHub() {
    if (!githubConnectBtn) return;

    await github?.refreshStatus();

    // Check if already connected
    const isConnected = github?.isConnected();
    if (isConnected) {
      githubConnected = true;
      githubStatus.textContent = 'Connected ✓';
      githubReposBtn.classList.remove('hidden');
      githubConnectBtn.classList.add('connected');
    }

    // Use new connection manager for button click
    githubConnectBtn.addEventListener('click', () => github?.connectGitHub());
    githubReposBtn.addEventListener('click', loadRepos);
    closeReposBtn?.addEventListener('click', () => githubReposPanel.classList.add('hidden'));
    closeFilesBtn?.addEventListener('click', () => githubFilesPanel.classList.add('hidden'));
  }

  async function checkGitHubStatus(sessionId) {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/github/status`, {
      credentials: 'include'
    });
    return response.ok ? await response.json() : { connected: false };
  }

  function getApiUrl() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:5000' 
      : '';
  }

  async function loadRepos() {
    try {
      const apiUrl = getApiUrl();
      githubReposPanel.classList.remove('hidden');
      reposList.innerHTML = '<div class="loading">Loading repos...</div>';
      const response = await fetch(`${apiUrl}/api/github/repos`, {
        credentials: 'include'
      });
      const data = await response.json();
      displayRepos(data.repos);
    } catch (err) {
      reposList.innerHTML = `<div class="error">Error loading repos: ${err.message}</div>`;
    }
  }

  function displayRepos(repos) {
    reposList.innerHTML = repos.map(repo => `
      <div class="repo-item" data-repo="${escapeHtml(repo.full_name)}">
        <div class="repo-info">
          <h5>${escapeHtml(repo.name)}</h5>
          <p>${escapeHtml(repo.description || 'No description')}</p>
          <span class="repo-lang">${escapeHtml(repo.language || 'Unknown')}</span>
          ${repo.private ? '<span class="private">Private</span>' : ''}
        </div>
        <button class="load-files-btn" data-repo="${escapeHtml(repo.full_name)}">Load Files</button>
      </div>
    `).join('');
    
    // Event listeners for load files
    reposList.querySelectorAll('.load-files-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentRepo = e.target.dataset.repo;
        loadRepoFiles(currentRepo);
        githubReposPanel.classList.add('hidden');
      });
    });
  }

  async function loadRepoFiles(repo) {
    try {
      const apiUrl = getApiUrl();
      githubFilesPanel.classList.remove('hidden');
      filesList.innerHTML = '<div class="loading">Loading files...</div>';
      const response = await fetch(`${apiUrl}/api/github/repo-files?repo=${repo}`, {
        credentials: 'include'
      });
      const data = await response.json();
      displayFiles(data.files, repo);
    } catch (err) {
      filesList.innerHTML = `<div class="error">Error loading files: ${err.message}</div>`;
    }
  }

  function displayFiles(files, repo) {
    filesList.innerHTML = files.map(file => `
      <div class="file-item" data-file="${file.path}" data-repo="${repo}">
        <span class="file-icon">${getFileIcon(file.path)}</span>
        <span class="file-name">${file.path}</span>
        <button class="analyze-file-btn">Analyze with AI</button>
      </div>
    `).join('');

    filesList.querySelectorAll('.analyze-file-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const filePath = e.target.closest('.file-item').dataset.file;
        await analyzeGitHubFile(repo, filePath);
        githubFilesPanel.classList.add('hidden');
      });
    });
  }

  async function analyzeGitHubFile(repo, filePath) {
    try {
      const apiUrl = getApiUrl();
      submitBtn.textContent = 'Analyzing GitHub file...';
      submitBtn.disabled = true;

      const response = await fetch(`${apiUrl}/api/github/analyze-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repo, filePath, type: 'review' })
      });

      const data = await response.json();
      codeEditor.value = data.content || ''; // Load content
      displayResults(data);
    } catch (err) {
      alert(`Error analyzing file: ${err.message}`);
    } finally {
      submitBtn.textContent = 'Get AI Review';
      submitBtn.disabled = false;
    }
  }

  function getFileIcon(path) {
    const ext = path.split('.').pop();
    const icons = {
      js: '📄', ts: '📄', py: '🐍', java: '☕', cpp: '⚙️', go: '🐹', md: '📝'
    };
    return icons[ext] || '📄';
  }

  let statusInterval;
  function checkStatusInterval() {
    statusInterval = setInterval(async () => {
      if (currentSessionId) {
        const status = await checkGitHubStatus(currentSessionId);
        if (status.connected) {
          githubConnected = true;
          githubStatus.textContent = 'Connected ✓';
          githubReposBtn.classList.remove('hidden');
          githubConnectBtn.classList.add('connected');
          clearInterval(statusInterval);
        }
      }
    }, 1000);
  }

  // Focus editor on load
  codeEditor.focus();
});
