document.addEventListener('DOMContentLoaded', async function () {
  const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : '';

  function buildGitHubRequestOptions(overrides = {}) {
    const headers = {
      ...(overrides.headers || {}),
    };

    return {
      credentials: 'include',
      ...overrides,
      headers,
    };
  }

  async function getSessionConnected() {
    try {
      const statusRes = await fetch(`${apiUrl}/api/github/status`, { credentials: 'include' });
      if (!statusRes.ok) return false;
      const status = await statusRes.json();
      return !!status.connected;
    } catch {
      return false;
    }
  }

  const receivedToken = github?.handleOAuthCallback();
  console.log('token received:', !!receivedToken);
  const sessionConnected = await getSessionConnected();
  const connected = sessionConnected;

  const connectionStatus = document.getElementById('connection-status');
  let githubUserLogin = '';

  if (connected) {
    try {
      const userRes = await fetch(`${apiUrl}/api/github/user`, buildGitHubRequestOptions());
      if (userRes.ok) {
        const userData = await userRes.json();
        githubUserLogin = userData.login || '';
      }
    } catch (error) {
      console.warn('Failed to fetch connected user profile:', error);
    }
  }

  if (connectionStatus) {
    if (connected && githubUserLogin) {
      connectionStatus.textContent = `✅ Connected as ${githubUserLogin}`;
      connectionStatus.style.color = 'green';
    } else if (connected) {
      connectionStatus.textContent = '✅ GitHub Connected';
      connectionStatus.style.color = 'green';
    } else {
      connectionStatus.textContent = '❌ Not Connected';
      connectionStatus.style.color = 'red';
    }
  }

  if (!connected) {
    window.location.href = 'index.html';
    return;
  }

  const repoNameEl = document.getElementById('repo-name');
  const fileSearch = document.getElementById('file-search');
  const filesTree = document.getElementById('files-tree');
  const currentFilePathEl = document.getElementById('current-file-path');
  const codeViewer = document.getElementById('code-viewer');
  const analyzeBtn = document.getElementById('analyze-current');
  const aiContent = document.getElementById('ai-content');
  const chatInput = document.getElementById('chat-input');
  const sendChatBtn = document.getElementById('send-chat');
  const refreshBtn = document.getElementById('refresh-files');
  const backBtn = document.getElementById('back-to-repos');

  let currentRepo = new URLSearchParams(window.location.search).get('repo');
  let currentFile = null;
  let files = [];
  let fileSearchTerm = '';

  analyzeBtn.disabled = true;

  refreshBtn?.addEventListener('click', loadFiles);
  backBtn?.addEventListener('click', async () => {
    localStorage.removeItem('selectedRepo');
    currentRepo = null;
    currentFile = null;
    files = [];
    currentFilePathEl.textContent = 'Select a file to view...';
    analyzeBtn.disabled = true;
    aiContent.innerHTML = `
      <div class="ai-placeholder">
        <h4>✨ AI Analysis</h4>
        <p>Click "Analyze with AI" to review this file</p>
      </div>
    `;
    codeViewer.innerHTML = `
      <div class="empty-state">
        <h4>👈 Select a file from the left panel</h4>
        <p>Browse your GitHub repository structure and click files to analyze them with AI</p>
      </div>
    `;
    repoNameEl.textContent = 'Select one of your repositories';
    window.history.replaceState({}, document.title, 'repo-review.html');
    await loadReposFromBackend();
  });

  fileSearch?.addEventListener('input', (e) => {
    fileSearchTerm = e.target.value.toLowerCase();
    renderFiles(files);
  });

  analyzeBtn?.addEventListener('click', analyzeCurrentFile);
  sendChatBtn?.addEventListener('click', sendChat);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  if (!currentRepo) {
    repoNameEl.textContent = 'Select one of your repositories';
    await loadReposFromBackend();
    return;
  }

  repoNameEl.textContent = currentRepo;
  await loadFiles();

  async function loadReposFromBackend() {
    try {
      showLoading(filesTree, 'Loading your repositories...');
      const res = await fetch(`${apiUrl}/api/github/repos`, buildGitHubRequestOptions());

      if (!res.ok) {
        throw new Error(`Failed to load repositories (${res.status})`);
      }

      const data = await res.json();
      console.log('repo API response:', data);
      const repos = Array.isArray(data) ? data : (data.repos || []);

      if (!repos.length) {
        filesTree.innerHTML = '<div class="empty">No repositories found.</div>';
        return;
      }

      filesTree.innerHTML = repos.map((repo) => `
        <div class="repo-card">
          <div class="repo-card-title">${escapeHtml(repo.full_name)}</div>
          <p class="repo-card-description">${escapeHtml(repo.description || 'No description provided')}</p>
          <button class="select-repo-btn" data-repo="${escapeHtml(repo.full_name)}">Select Repository</button>
        </div>
      `).join('');

      filesTree.querySelectorAll('.select-repo-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const repoName = e.target.getAttribute('data-repo');
          localStorage.setItem('selectedRepo', repoName);
          window.location.href = `repo-review.html?repo=${encodeURIComponent(repoName)}`;
        });
      });
    } catch (err) {
      filesTree.innerHTML = `<div class="error">Unable to load repositories: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadFiles() {
    if (!currentRepo) return;

    try {
      showLoading(filesTree, 'Loading files...');
      const res = await fetch(
        `${apiUrl}/api/github/repo-files?repo=${encodeURIComponent(currentRepo)}`,
        buildGitHubRequestOptions()
      );

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      console.log('repo files API response:', data);
      files = data.files || [];
      renderFiles(files);
    } catch (err) {
      filesTree.innerHTML = `<div class="error">Failed to load files: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderFiles(filesList) {
    const filteredFiles = filesList.filter((f) =>
      f.path.toLowerCase().includes(fileSearchTerm)
    );

    if (!filteredFiles.length) {
      filesTree.innerHTML = '<div class="empty">No files match search</div>';
      return;
    }

    const tree = buildFileTree(filteredFiles);
    filesTree.innerHTML = renderFileTree(tree);

    filesTree.querySelectorAll('.file-item').forEach((item) => {
      item.addEventListener('click', () => {
        const path = item.dataset.path;
        if (path) loadFileContent(path);
      });
    });

    filesTree.querySelectorAll('.folder-toggle').forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const folder = toggle.closest('.folder-item');
        folder.classList.toggle('expanded');
        const next = folder.nextElementSibling;
        if (next) {
          next.classList.toggle('expanded');
        }
      });
    });
  }

  function buildFileTree(filesList) {
    const tree = {};
    filesList.forEach((file) => {
      const parts = file.path.split('/');
      let current = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = { type: 'folder', name: part, children: {}, path: parts.slice(0, i + 1).join('/') };
        }
        current = current[part].children;
      }
      const filename = parts[parts.length - 1];
      current[filename] = { type: 'file', name: filename, path: file.path };
    });
    return tree;
  }

  function renderFileTree(node) {
    let html = '';
    Object.keys(node).forEach((key) => {
      const item = node[key];
      if (item.type === 'folder') {
        html += `
          <div class="folder-item" data-path="${item.path}">
            <span class="folder-toggle">▸</span>
            <span class="folder-icon">📁</span>
            <span class="file-name">${escapeHtml(item.name)}</span>
          </div>
          <div class="folder-children">
            ${renderFileTree(item.children)}
          </div>
        `;
      } else {
        html += `
          <div class="file-item ${currentFile === item.path ? 'selected' : ''}" data-path="${item.path}">
            <span class="file-icon">${getFileIcon(item.path)}</span>
            <span class="file-name">${escapeHtml(item.name)}</span>
          </div>
        `;
      }
    });
    return html;
  }

  async function loadFileContent(path) {
    try {
      currentFile = path;
      currentFilePathEl.textContent = path;
      analyzeBtn.disabled = false;
      showLoading(codeViewer, 'Loading content...');

      const res = await fetch(`${apiUrl}/api/github/file?repo=${encodeURIComponent(currentRepo)}&path=${encodeURIComponent(path)}`, {
        ...buildGitHubRequestOptions(),
      });

      if (!res.ok) {
        throw new Error(`Failed to load: ${res.status}`);
      }

      const data = await res.json();
      const content = data.content || 'Empty file';
      const escaped = escapeHtml(content);
      codeViewer.innerHTML = `<div class="code-highlight"><pre><code>${highlightCode(escaped)}</code></pre></div>`;
    } catch (err) {
      codeViewer.innerHTML = `<div class="error">Failed to load file: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function analyzeCurrentFile() {
    if (!currentFile) return;

    try {
      analyzeBtn.textContent = 'Analyzing...';
      analyzeBtn.disabled = true;
      showLoading(aiContent, 'AI analyzing...');

      const res = await fetch(`${apiUrl}/api/github/analyze-file`, {
        method: 'POST',
        ...buildGitHubRequestOptions({ headers: { 'Content-Type': 'application/json' } }),
        body: JSON.stringify({ repo: currentRepo, filePath: currentFile, type: 'review' }),
      });

      if (!res.ok) {
        throw new Error(`Analysis failed: ${res.status}`);
      }

      const data = await res.json();
      displayAnalysis(data);

      // Keep code viewer synced with latest source content even when analyze response omits content.
      await loadFileContent(currentFile);
    } catch (err) {
      aiContent.innerHTML = `<div class="error">Analysis failed: ${escapeHtml(err.message)}</div>`;
    } finally {
      analyzeBtn.textContent = '🤖 Analyze with AI';
      analyzeBtn.disabled = false;
    }
  }

  async function sendChat() {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      showLoading(aiContent, 'AI responding...');
      const code = codeViewer.textContent || '';
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, code, language: inferLanguage(currentFile) }),
      });

      if (!res.ok) {
        throw new Error('Chat failed');
      }

      const data = await res.json();
      appendChat(message, data.reply || 'No response');
      chatInput.value = '';
    } catch (err) {
      appendChat(message, `Error: ${err.message}`);
    }
  }

  function highlightCode(escapedCode) {
    return escapedCode
      .replace(/(\/\/.*)$/gm, '<span class="comment">$1</span>')
      .replace(/\b(function|const|let|var|if|else|for|while|return|class|async|await|import|export|try|catch|new)\b/g, '<span class="keyword">$1</span>')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="string">$1</span>');
  }

  function displayAnalysis(data) {
    const summary = escapeHtml(data.summary || data.analysis || 'Analysis complete');
    const issues = Array.isArray(data.issues) ? data.issues : [];

    aiContent.innerHTML = `
      <div class="analysis-summary">${summary}</div>
      ${issues.length ? `
        <div class="analysis-issues">
          <h4>Issues (${issues.length})</h4>
          ${issues.map((issue) => `
            <div class="issue-item ${escapeHtml(issue.severity || 'info')}">
              <strong>${escapeHtml((issue.type || 'issue').toUpperCase())} (${escapeHtml((issue.severity || 'info').toUpperCase())})</strong>
              <p>${escapeHtml(issue.description || '')}</p>
              ${issue.fix ? `<code>${escapeHtml(issue.fix)}</code>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '<p class="no-issues">No issues found.</p>'}
      ${data.refactored_code ? `<div class="refactored-code"><h4>Improved Code</h4><pre><code>${escapeHtml(data.refactored_code)}</code></pre></div>` : ''}
    `;
  }

  function appendChat(userMsg, aiReply) {
    aiContent.innerHTML += `
      <div class="chat-message user">You: ${escapeHtml(userMsg)}</div>
      <div class="chat-message ai">${escapeHtml(aiReply)}</div>
    `;
    aiContent.scrollTop = aiContent.scrollHeight;
  }

  function showLoading(el, text) {
    el.innerHTML = `<div class="loading">${escapeHtml(text)}</div>`;
  }

  function getFileIcon(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    const icons = {
      js: '📄', ts: '📄', py: '🐍', java: '☕', cpp: '⚙️', go: '🐹', md: '📝', json: '🔧', html: '🌐', css: '🎨'
    };
    return icons[ext] || '📄';
  }

  function inferLanguage(path) {
    if (!path) return 'javascript';
    const ext = path.split('.').pop()?.toLowerCase();
    const mapping = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      html: 'html',
      css: 'css',
      json: 'json'
    };
    return mapping[ext] || 'javascript';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }
});
