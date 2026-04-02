/**
 * GitHub Connection Management
 * Handles connection state, token storage, and smart redirects
 */

class GitHubConnectionManager {
  constructor() {
    this.CONNECTION_CACHE_KEY = 'github_connected_cache';
    this.TOKEN_KEY = 'github_token';
    this.API_URL = this.getApiUrl();
    this.clearLegacyTokenStorage();
  }

  clearLegacyTokenStorage() {
    const legacyToken = localStorage.getItem(this.TOKEN_KEY);
    if (legacyToken) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  /**
   * Get backend API URL based on environment
   */
  getApiUrl() {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || isIpv4;

    if (window.location.port === '5000') {
      return `${protocol}//${host}:5000`;
    }

    if (isLocalHost) {
      return `${protocol}//${host}:5000`;
    }

    return '';
  }

  /**
   * Check cached connection state
   */
  isConnected() {
    return localStorage.getItem(this.CONNECTION_CACHE_KEY) === '1';
  }

  /**
   * Persist connection state cache
   */
  setConnected(connected) {
    localStorage.setItem(this.CONNECTION_CACHE_KEY, connected ? '1' : '0');
  }

  /**
   * Query backend session status
   */
  async refreshStatus() {
    try {
      const res = await fetch(`${this.API_URL}/api/github/status`, {
        credentials: 'include',
      });
      if (!res.ok) {
        this.setConnected(false);
        return false;
      }

      const status = await res.json();
      const connected = !!status.connected;
      this.setConnected(connected);
      return connected;
    } catch (err) {
      console.error('Failed to fetch GitHub status:', err);
      this.setConnected(false);
      return false;
    }
  }

  /**
   * Clear connection cache
   */
  clearToken() {
    localStorage.removeItem(this.CONNECTION_CACHE_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    console.log('🔄 GitHub connection cache cleared');
  }

  setToken(token) {
    // Tokens are intentionally not persisted in browser storage.
    if (!token) return;
  }

  getToken() {
    return null;
  }

  /**
   * Clean callback params and legacy token values from URL
   */
  extractTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const connected = urlParams.get('connected');

    if (token) {
      this.setToken(token);
      this.setConnected(true);
      console.log('OAuth token received and cached');
    }

    if (connected === '1') {
      this.setConnected(true);
    }

    if (token || connected === '1') {
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    return false;
  }

  /**
   * Smart connection check with redirect logic
   * Use on page load to determine where user should be
   */
  smartRedirect(currentPage = 'review') {
    const isConnected = this.isConnected();
    const urlToken = new URLSearchParams(window.location.search).get('token');
    
    console.log(`📍 Current page: ${currentPage}, Connected: ${isConnected}, URL token: ${!!urlToken}`);

    // If token is in URL, allow callback logic to proceed (so token gets saved)
    if (urlToken) {
      console.log('⏳ Token present in URL, waiting for backend callback handling before redirect decision');
      return true;
    }

    // If user is on review.html but NOT connected → redirect to index
    if (currentPage === 'review' && !isConnected) {
      console.log('⚠️ On review.html but not connected → redirecting to index');
      window.location.href = 'index.html';
      return false;
    }

    // If user is on repo-review.html but NOT connected → redirect to index
    if (currentPage === 'repo-review' && !isConnected) {
      console.log('⚠️ On repo-review.html but not connected → redirecting to index');
      window.location.href = 'index.html';
      return false;
    }

    // If connected, mark as good
    if (isConnected) {
      console.log('✅ GitHub connected, page load OK');
      return true;
    }

    // Default page (index.html) → no redirect needed
    console.log('📄 On index.html, allowing normal flow');
    return false;
  }

  /**
   * Initiate GitHub OAuth flow
   */
  async connectGitHub() {
    console.log('🔗 Starting GitHub OAuth flow');
    const existingToken = this.getToken();
    if (existingToken) {
      console.log('✅ Existing token found, redirecting to repo-review.html');
      window.location.href = 'repo-review.html';
      return;
    }

    const sessionConnected = await this.refreshStatus();
    if (sessionConnected) {
      console.log('✅ Active GitHub session found, redirecting to repo-review.html');
      window.location.href = 'repo-review.html';
      return;
    }

    window.location.href = `${this.API_URL}/auth/github`;
  }

  /**
   * Redirect to repo review after connection
   */
  goToRepoReview() {
    if (this.isConnected()) {
      console.log('🚀 Navigating to repo-review.html');
      window.location.href = 'repo-review.html';
    } else {
      console.warn('⚠️ Not connected, cannot navigate to repo review');
    }
  }

  /**
   * Redirect to home page
   */
  goToHome() {
    console.log('🏠 Navigating to index.html');
    window.location.href = 'index.html';
  }

  /**
   * Handle OAuth callback - called from repo-review.html or review.html
   */
  handleOAuthCallback() {
    console.log('🔄 Handling OAuth callback...');
    return this.extractTokenFromUrl();
  }

  /**
   * Log current connection state
   */
  logStatus() {
    const connected = this.isConnected();
    console.log('🔐 GitHub Connection Status:', {
      connected,
      apiUrl: this.API_URL,
    });
  }
}

// Create global instance
const github = new GitHubConnectionManager();

// Auto-handle OAuth callback on page load
document.addEventListener('DOMContentLoaded', function() {
  github.handleOAuthCallback();
  github.refreshStatus();
});
