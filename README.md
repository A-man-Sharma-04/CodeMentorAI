# CodeMentor AI - AI-Powered Code Review & Mentorship Platform

[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-blue.svg)](https://nodejs.org/)
[![Frontend](https://img.shields.io/badge/Frontend-HTML%20CSS%20JS-green.svg)](https://developer.mozilla.org/en-US/docs/Web)
[![AI](https://img.shields.io/badge/AI-OpenAI-orange.svg)](https://platform.openai.com/)

## 🚀 Overview

**CodeMentor AI** is an AI-powered code mentorship platform that provides instant code reviews, bug detection, refactoring suggestions, and performance analysis. Upload your code or connect your GitHub repo to get feedback like working with a senior developer.

**Key Features:**
- 🔍 **AI Code Review** - Instant bug detection and suggestions
- ⭐ **Code Quality Score** - Detailed ratings with insights
- ⚡ **Multi-Language Support** - JavaScript, Python, Java, TypeScript, C++, Go, and more
- 📤 **Real-time Feedback** - Get suggestions as you code
- 🧠 **Performance Analysis** - Time/space complexity optimization
- 🎯 **GitHub Integration** - Auto-review pull requests

Perfect for students, developers, and startups looking to ship cleaner, faster code!

## 📱 Live Demo

Open `frontend/index.html` in your browser to see the landing page, or `frontend/review.html` for the code review interface.

**Backend APIs:**
```
POST /api/review - Code review
POST /api/chat - AI chat assistance
POST /api/analyse - Code analysis
POST /api/explain - Code explanation
```

## 🏗️ Project Structure

```
e:/CodeMentorAI/
├── backend/                 # Node.js/Express API server
│   ├── index.js            # Main server entry
│   ├── package.json        # Backend dependencies
│   ├── routes/             # API routes (review, chat, analyse, explain)
│   └── services/           # AI service integration
└── frontend/               # Static web app
    ├── index.html          # Landing page
    ├── review.html         # Code review interface
    ├── docs.html           # Documentation
    ├── styles.css          # Global styles
    ├── script.js           # Frontend logic
    ├── review.js           # Review page logic
    └── docs.css            # Docs styles
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- OpenAI API key or Groq API key (set in `.env`)

### Backend Setup
```bash
cd backend
npm install
# Copy .env.example to .env and add your API key
npm run dev
```

Server runs on `http://localhost:5000`

### Frontend
```bash
# Serve frontend (using Live Server or any static server)
# Open frontend/index.html or http://localhost:5500
```

**Test Health Check:**
```bash
curl http://localhost:5000/health
```

### Environment Variables
Create `backend/.env`:
```
GROQ_API_KEY=your_groq_api_key_here
# or
OPENAI_API_KEY=your_openai_api_key_here
PORT=5000
```

## 🌐 API Endpoints

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/review` | POST | AI code review + quality score | `{ code: string, language: string }` |
| `/api/chat` | POST | AI chat for coding questions | `{ message: string }` |
| `/api/analyse` | POST | Deep code analysis | `{ code: string }` |
| `/api/explain` | POST | Explain code functionality | `{ code: string }` |
| `/health` | GET | Health check | - |

**Example Review Request:**
```bash
curl -X POST http://localhost:5000/api/review \
  -H \"Content-Type: application/json\" \
  -d '{\"code\": \"function twoSum(nums, target) { const map = {}; ... }\",\"language\": \"javascript\"}'
```

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js**
- **OpenAI/Groq** AI integration
- **CORS** enabled for frontend
- **dotenv** for environment config

### Frontend
- **Vanilla HTML/CSS/JavaScript**
- **JetBrains Mono** & **Inter** fonts
- **Responsive design**
- **Real-time code editor UI**

### Dependencies
```bash
# Backend
npm i express cors dotenv openai
npm i -D nodemon
```

## 📚 Features Showcase

1. **Landing Page** (`index.html`): Hero, features, testimonials, live demo
2. **Code Review** (`review.html`): Real-time AI code analysis
3. **Documentation** (`docs.html`): Usage guides
4. **Mobile Responsive**: Works on all devices

## 🔍 Usage Examples

### 1. Code Review
```javascript
// Input your code
function findDuplicates(arr) {
  return arr.filter((item, index) => arr.indexOf(item) === index);
}

// AI Feedback:
// ❌ O(n²) complexity - Use hashmap for O(n)
// ✅ Refactored version provided
// ⭐ Score: 72/100
```

### 2. Frontend Integration
The review page includes:
- Syntax-highlighted code editor
- Language detection
- Instant AI feedback
- Copy/export results

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is [ISC](LICENSE) licensed.

## 🙏 Acknowledgments

- [OpenAI/Groq](https://platform.openai.com/) for AI capabilities
- [Shivam Maurya](https://github.com/) - Original creator

## 🚀 Next Steps

- [ ] Add GitHub integration
- [ ] User authentication
- [ ] Code snippet history
- [ ] VS Code extension
- [ ] Docker deployment

---

**⭐ Star this repo if you find it useful!**

---

*Built with ❤️ for developers by developers*
