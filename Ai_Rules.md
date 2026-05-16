# 🤖 AI Rules - Source of Truth

This file is the **single source of truth** for all AI rules in this project.

Changes here are automatically synchronized to:
- Cursor (.cursorrules)
- GitHub Copilot (.github/copilot-instructions.md)
- Windsurf (.windsurfrules)
- Cline (.clinerules)
- Aider (.aider.conf.yml)
- Claude (CLAUDE.md)
- Generic agents (agents.md)

## 📋 General Rules

### Code Style
- Use TypeScript for all new code
- Follow camelCase naming conventions
- Document public functions with JSDoc
- Keep functions small and focused

### Architecture
- Separation of concerns
- Reusable components
- Dependency injection where appropriate

### Testing
- Write unit tests for business logic
- Maintain coverage > 80%

### Documentation
- Keep README updated
- Comments in English
- Document important decisions

## 🎯 Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **IDE**: Visual Studio Code
- **Version control**: Git

## 💡 AI Preferences

- Explain the reasoning behind suggestions
- Prioritize clean and maintainable code over premature optimization
- Suggest best practices and design patterns when relevant
- Detect and warn about potential bugs or security issues

---

✨ **Tip**: Sync these changes by running "AI Rules: Sync All Rules" from the command palette.
