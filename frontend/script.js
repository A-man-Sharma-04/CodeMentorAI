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
  const currentTab = 'review'; // Default to review

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

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      displayResults(data, currentTab);
    } catch (error) {
      resultContent.innerHTML = `<div class="error">Error: ${error.message}. Is backend running on port 5000?</div>`;
      results.classList.remove('hidden');
    } finally {
      submitBtn.textContent = 'Get AI Feedback';
      submitBtn.disabled = false;
    }
  });

  function displayResults(data, tab) {
    results.classList.remove('hidden');

    let html = '';
    
    switch (tab) {
      case 'review':
        scoreBadge.innerHTML = `<span class="badge score">Score: ${data.score || 0}/100</span>`;
        html = `
          <div class="review-summary">${data.summary || 'No summary'}</div>
          <div class="review-issues">
            <h4>Issues Found (${data.issues?.length || 0}):</h4>
            ${data.issues?.map(issue => `
              <div class="issue-item ${issue.severity}">
                <strong>${issue.type.toUpperCase()} (${issue.severity.toUpperCase()})</strong> - Line ${issue.line || '?'}
                <p>${issue.description}</p>
                <code>${issue.fix}</code>
              </div>
            `).join('') || '<p>No issues found! 🎉</p>'}
          </div>
          ${data.refactored_code ? `<div class="refactored-code"><h4>Refactored Code:</h4><pre><code>${data.refactored_code}</code></pre></div>` : ''}
        `;
        break;
      case 'analyse':
        html = `
          <h4>Analysis:</h4>
          <p>${data.analysis || 'No analysis'}</p>
          ${data.fixed_code ? `<h4>Fixed Code:</h4><pre><code>${data.fixed_code}</code></pre>` : ''}
        `;
        break;
      case 'explain':
        html = `
          <h4>Explanation:</h4>
          <p>${data.explanation || 'No explanation'}</p>
          <h5>Key Concepts:</h5>
          <ul>${data.key_concepts?.map(c => `<li>${c}</li>`).join('') || '<li>None</li>'}</ul>
        `;
        break;
      case 'chat':
      default:
        html = `
          <h4>AI Response:</h4>
          <p>${data.reply || 'No response'}</p>
          ${data.improved_code ? `<h4>Improved Code:</h4><pre><code>${data.improved_code}</code></pre>` : ''}
        `;
    }

    resultContent.innerHTML = html;
  }

  // Utility functions
  document.getElementById('copy-feedback')?.addEventListener('click', () => {
    const text = resultContent.innerText;
    navigator.clipboard.writeText(text).then(() => {
      const btn = event.target;
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = original, 2000);
    });
  });

  document.getElementById('new-review')?.addEventListener('click', () => {
    results.classList.add('hidden');
    codeEditor.value = '';
    codeEditor.focus();
  });

  // Auto-resize textarea
  codeEditor.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });
});
