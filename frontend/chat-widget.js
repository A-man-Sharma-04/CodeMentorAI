// Floating AI Chat Widget for Code Mentor
class AIChat {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.isLoading = false;
    this.ids = {
      widget: 'ai-chat-widget',
      toggleBtn: 'ai-widget-toggle-btn',
      panel: 'ai-widget-panel',
      closeBtn: 'ai-widget-close-btn',
      messages: 'ai-widget-messages',
      input: 'ai-widget-input',
      sendBtn: 'ai-widget-send-btn',
      loading: 'ai-widget-loading',
    };
    this.init();
  }

  init() {
    // Create widget HTML
    this.createWidget();
    
    // Event listeners
    this.attachEventListeners();
    
    // Load saved messages from localStorage (optional)
    this.loadChatHistory();
  }

  createWidget() {
    const { widget, toggleBtn, panel, closeBtn, messages, input, sendBtn, loading } = this.ids;

    // Container for widget
    const widgetHTML = `
      <!-- Floating Chat Widget -->
      <div id="${widget}" class="ai-chat-widget">
        <!-- Floating Button -->
        <button id="${toggleBtn}" class="chat-toggle-btn" title="Chat with AI Code Mentor">
          <span class="chat-icon">💬</span>
        </button>

        <!-- Chat Panel -->
        <div id="${panel}" class="chat-panel hidden">
          <!-- Header -->
          <div class="chat-header">
            <div class="chat-title">
              <span class="ai-icon">🤖</span>
              <h3>AI Code Mentor</h3>
            </div>
            <button id="${closeBtn}" class="chat-close-btn">×</button>
          </div>

          <!-- Messages Area -->
          <div id="${messages}" class="chat-messages">
            <div class="message ai-message">
              <div class="message-content">
                <p>Hey! 👋 I'm your AI Code Mentor. Ask me anything about your code:</p>
                <ul>
                  <li>🐛 Debug code issues</li>
                  <li>✨ Improve code quality</li>
                  <li>📚 Explain concepts</li>
                  <li>🔄 Refactor code</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Input Area -->
          <div class="chat-input-area">
            <textarea 
              id="${input}" 
              class="chat-input" 
              placeholder="Ask a question, paste code, or describe a problem... (Shift+Enter for new line)"
              rows="3"
            ></textarea>
            <button id="${sendBtn}" class="chat-send-btn">
              <span>Send</span>
              <span class="send-icon">→</span>
            </button>
          </div>

          <!-- Loading Indicator -->
          <div id="${loading}" class="chat-loading hidden">
            <span class="loading-spinner"></span>
            <span>AI is thinking...</span>
          </div>
        </div>
      </div>
    `;

    // Insert widget into page
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  attachEventListeners() {
    const toggleBtn = document.getElementById(this.ids.toggleBtn);
    const closeBtn = document.getElementById(this.ids.closeBtn);
    const sendBtn = document.getElementById(this.ids.sendBtn);
    const input = document.getElementById(this.ids.input);

    // Toggle chat panel
    toggleBtn.addEventListener('click', () => this.toggleChat());
    closeBtn.addEventListener('click', () => this.closeChat());

    // Send message
    sendBtn.addEventListener('click', () => this.sendMessage());
    
    // Enter to send, Shift+Enter for new line
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }

  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    this.isOpen = true;
    const panel = document.getElementById(this.ids.panel);
    panel.classList.remove('hidden');
    panel.classList.add('open');
    
    document.getElementById(this.ids.input).focus();
  }

  closeChat() {
    this.isOpen = false;
    const panel = document.getElementById(this.ids.panel);
    panel.classList.remove('open');
    panel.classList.add('hidden');
  }

  async sendMessage() {
    const input = document.getElementById(this.ids.input);
    const message = input.value.trim();

    if (!message || this.isLoading) return;

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Add user message to chat
    this.addMessage(message, 'user');

    // Show loading indicator
    this.showLoading(true);

    try {
      // Call backend API
      // Use backend base URL for local dev and direct file:// usage.
      const apiBase =
        window.location.protocol === 'file:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
          ? 'http://localhost:5000'
          : window.location.origin;
      const apiUrl = `${apiBase}/api/chat`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          code: this.extractCode(message),
          language: this.detectLanguage(message)
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Add AI response to chat
      this.addMessage(data.reply || data, 'ai', {
        fix: data.fix,
        improved_code: data.improved_code
      });

      // Save chat history
      this.saveChatHistory();

    } catch (error) {
      console.error('Chat error:', error);
      this.addMessage(
        `❌ Sorry, I couldn't reach the server. Error: ${error.message}`,
        'ai',
        { isError: true }
      );
    } finally {
      this.showLoading(false);
      document.getElementById(this.ids.input).focus();
    }
  }

  addMessage(content, sender, metadata = {}) {
    const messagesContainer = document.getElementById(this.ids.messages);
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}-message`;

    let messageHTML = `<div class="message-content">`;

    if (sender === 'user') {
      messageHTML += `<p>${this.escapeHTML(content)}</p>`;
    } else {
      messageHTML += `${this.formatMarkdown(content)}`;
      
      // Add fix section if available
      if (metadata.fix) {
        messageHTML += `
          <div class="code-section">
            <div class="code-header">Fix:</div>
            <div class="code-block">
              <code>${this.escapeHTML(metadata.fix)}</code>
              <button class="copy-btn" data-code="${this.escapeHTML(metadata.fix)}">📋 Copy</button>
            </div>
          </div>
        `;
      }

      // Add improved code section if available
      if (metadata.improved_code) {
        messageHTML += `
          <div class="code-section">
            <div class="code-header">Improved Code:</div>
            <div class="code-block">
              <code>${this.escapeHTML(metadata.improved_code)}</code>
              <button class="copy-btn" data-code="${this.escapeHTML(metadata.improved_code)}" data-type="improve">📋 Copy</button>
            </div>
          </div>
        `;
      }

      if (metadata.isError) {
        messageEl.classList.add('error-message');
      }
    }

    messageHTML += `</div>`;
    messageEl.innerHTML = messageHTML;

    // Add copy button functionality
    messageEl.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.target.dataset.code || e.target.previousElementSibling.textContent;
        this.copyToClipboard(code, btn);
      });
    });

    messagesContainer.appendChild(messageEl);

    // Auto scroll to latest message
    this.scrollToBottom();

    // Store message
    this.messages.push({ content, sender, metadata, timestamp: Date.now() });
  }

  formatMarkdown(text) {
    // Escape HTML first
    let html = this.escapeHTML(text);

    // Convert markdown-style formatting
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **bold**
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');             // *italic*
    html = html.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>'); // `code`

    // Convert line breaks
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    return `<p>${html}</p>`;
  }

  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  extractCode(message) {
    // Simple code extraction - regex for common patterns
    const codeMatch = message.match(/```[\s\S]*?```|code:|problem:|error:/i);
    return codeMatch ? message.substring(Math.max(0, codeMatch.index - 50)) : '';
  }

  detectLanguage(message) {
    const languages = ['javascript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'sql'];
    
    for (let lang of languages) {
      if (message.toLowerCase().includes(lang)) {
        return lang;
      }
    }

    return 'javascript'; // Default
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById(this.ids.messages);
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  showLoading(show) {
    this.isLoading = show;
    const loading = document.getElementById(this.ids.loading);
    if (show) {
      loading.classList.remove('hidden');
      this.scrollToBottom();
    } else {
      loading.classList.add('hidden');
    }
  }

  copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      const originalText = button.textContent;
      button.textContent = '✅ Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  saveChatHistory() {
    try {
      localStorage.setItem('ai-chat-history', JSON.stringify(this.messages));
    } catch (e) {
      console.warn('Could not save chat history:', e);
    }
  }

  loadChatHistory() {
    try {
      const saved = localStorage.getItem('ai-chat-history');
      if (saved) {
        this.messages = JSON.parse(saved);
        // Optionally restore messages to UI
        // this.messages.forEach(msg => this.addMessage(msg.content, msg.sender, msg.metadata));
      }
    } catch (e) {
      console.warn('Could not load chat history:', e);
    }
  }

  clearChat() {
    document.getElementById(this.ids.messages).innerHTML = '';
    this.messages = [];
    localStorage.removeItem('ai-chat-history');
  }
}

// Initialize chat widget when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.aiChat = new AIChat();
  });
} else {
  window.aiChat = new AIChat();
}
