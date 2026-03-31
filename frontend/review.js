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

  
  if (!codeEditor || !submitBtn || !resultContent) {
    console.error("❌ Missing required HTML elements");
    return;
  }


  codeEditor.addEventListener('input', function () {
    const maxHeight = 460;
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, maxHeight) + 'px';
    this.style.overflowY = this.scrollHeight > maxHeight ? 'auto' : 'hidden';
  });

  // ==============================
  // SUBMIT HANDLER
  // ==============================
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
        : 'https://codementorai-vqp8.onrender.com';
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
          <p>${issue.description || issue}</p>
          ${issue.fix ? `<code>${escapeHtml(issue.fix)}</code>` : ''}
        </div>
      `).join('')
      : `<p class="no-issues">🎉 No issues found! Great job.</p>`;

    // Summary
    const summaryHtml = data.summary
      ? `<div class="review-summary">${data.summary}</div>`
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

  // Focus editor on load
  codeEditor.focus();
});