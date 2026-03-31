// Existing animations + new app logic
document.addEventListener('DOMContentLoaded', function() {
  // Existing smooth scrolling
  document.querySelectorAll('a[href^=\"#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Navbar scroll effects
  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
      navbar.style.background = 'rgba(15, 23, 42, 0.98)';
      navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
    } else {
      navbar.style.background = 'rgba(15, 23, 42, 0.95)';
      navbar.style.boxShadow = 'none';
    }
  });

  // App functionality
  const tabs = document.querySelectorAll('.tab-btn');
  const codeEditor = document.getElementById('code-editor');
  const languageSelect = document.getElementById('language-select');
  const submitBtn = document.getElementById('submit-btn');
  const results = document.getElementById('results');
  const scoreBadge = document.getElementById('score-badge');
  const resultContent = document.getElementById('result-content');

  // Exit early on pages that do not include the review app UI.
  if (!codeEditor || !languageSelect || !submitBtn || !resultContent) {
    return;
  }

  let currentTab = 'review'; // Default to review

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
    });
  });

  // Submit handler
  submitBtn.addEventListener('click', async () => {
    const code = codeEditor.value.trim();
    const language = languageSelect.value;
    
    if (!code) {
      alert('Please enter some code');
      return;
    }

    submitBtn.textContent = 'Analyzing...';
    submitBtn.disabled = true;

    try {
      let endpoint;
      switch (currentTab) {
        case 'chat': endpoint = '/api/chat'; break;
        case 'explain': endpoint = '/api/explain'; break;
        case 'analyse': endpoint = '/api/analyse'; break;
        case 'review': 
        default: endpoint = '/api/review'; break;
      }

      const bodyData = currentTab === 'chat' ? { message: code, code, language } : { code, language };
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://codementorai-vqp8.onrender.com';
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) throw new Error(`Server Error: ${response.status}`);

      const data = await response.json();
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }
      
      displayResults(data, currentTab);
    } catch (error) {
      const errorMsg = error.message || 'Unknown error occurred';
      if (resultContent) {
        resultContent.innerHTML = `<div class="error"><h4>⚠️ Error</h4><p>${escapeHtml(errorMsg)}</p><p>👉 Please:</p><ul><li>Ensure backend is running on port 5000</li><li>Verify GROQ_API_KEY is set in .env</li><li>Check browser console for details</li></ul></div>`;
        results?.classList.remove('hidden');
      }
      console.error('API Error:', error);
    } finally {
      submitBtn.textContent = 'Get AI Feedback';
      submitBtn.disabled = false;
    }
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function displayResults(data, tab) {
    results?.classList.remove('hidden');

    let html = '';
    
    switch (tab) {
      case 'review':
        if (scoreBadge) {
          scoreBadge.innerHTML = `<span class="badge score">Score: ${data?.score || 0}/100</span>`;
        }
        html = `
          <div class="review-summary">${escapeHtml(data.summary || 'No summary')}</div>
          <div class="review-issues">
            <h4>Issues Found (${data.issues?.length || 0}):</h4>
            ${data.issues?.map(issue => `
              <div class="issue-item ${issue.severity}">
                <strong>${(issue.type || 'Issue').toUpperCase()} (${(issue.severity || 'info').toUpperCase()})</strong> - Line ${issue.line || '?'}
                <p>${escapeHtml(issue.description || '')}</p>
                ${issue.fix ? `<code>${escapeHtml(issue.fix)}</code>` : ''}
              </div>
            `).join('') || '<p>No issues found! 🎉</p>'}
          </div>
          ${data.refactored_code ? `<div class="refactored-code"><h4>Refactored Code:</h4><pre><code>${escapeHtml(data.refactored_code)}</code></pre></div>` : ''}
        `;
        break;
      case 'analyse':
        html = `
          <h4>Analysis:</h4>
          <p>${escapeHtml(data.analysis || 'No analysis')}</p>
          ${data.fixed_code ? `<h4>Fixed Code:</h4><pre><code>${escapeHtml(data.fixed_code)}</code></pre>` : ''}
        `;
        break;
      case 'explain':
        html = `
          <h4>Explanation:</h4>
          <p>${escapeHtml(data.explanation || 'No explanation')}</p>
          <h5>Key Concepts:</h5>
          <ul>${data.key_concepts?.map(c => `<li>${escapeHtml(c)}</li>`).join('') || '<li>None</li>'}</ul>
        `;
        break;
      case 'chat':
      default:
        html = `
          <h4>AI Response:</h4>
          <p>${escapeHtml(data.reply || 'No response')}</p>
          ${data.improved_code ? `<h4>Improved Code:</h4><pre><code>${escapeHtml(data.improved_code)}</code></pre>` : ''}
        `;
    }

    if (resultContent) {
      resultContent.innerHTML = html;
    }
  }

  // Copy feedback button
  document.getElementById('copy-feedback')?.addEventListener('click', async () => {
    if (!resultContent) return;
    const text = resultContent.innerText;
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('copy-feedback');
      if (btn) {
        btn.textContent = 'Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.textContent = 'Copy Feedback';
          btn.style.background = '';
        }, 2000);
      }
    } catch (err) {
      alert('Copy failed: ' + err.message);
    }
  });

  document.getElementById('new-review')?.addEventListener('click', () => {
    results?.classList.add('hidden');
    if (codeEditor) {
      codeEditor.value = '';
      codeEditor.style.height = 'auto';
      codeEditor.focus();
    }
  });

  // Auto-resize textarea
  if (codeEditor) {
    codeEditor.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  }
});
