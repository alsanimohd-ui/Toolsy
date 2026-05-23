# Mi - Development Guidelines

## 📁 Project Structure

/app
  /tools
    /[tool-name]
  /components
  /lib
  /utils

---

## ⚙️ Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS

---

## 🧱 General Rules

- The platform is modular: each tool is independent
- New tools can be added at any time without affecting existing ones
- Keep everything scalable and flexible

---

## 📂 Tool Structure

Each tool must have its own folder:

/app/tools/[tool-name]/

Inside each tool:

- page.tsx (main page)
- components/ (optional)
- logic should be separated into /lib or /utils

---

## 🔧 Naming Conventions

- Tool folders: kebab-case (example: log-analyzer)
- Variables: camelCase
- Components: PascalCase

---

## ⚡ Performance Rules

- Keep pages lightweight
- Avoid unnecessary dependencies
- Process heavy logic efficiently

---

## 🎯 UI/UX Rules

- Clean and minimal design
- Consistent layout across all tools
- Fast and responsive

---

## 🧠 Development Approach

- Build tools independently
- Avoid tight coupling between tools
- Each tool should work as a standalone feature

---

## 🚫 Don't

- Don't hardcode tool-specific logic globally
- Don't mix unrelated features
- Don't overcomplicate structure

---

## ✅ Do

- Keep code reusable
- Maintain consistency
- Write clear and readable logic

---

## 🔥 Goal

Build a flexible platform that allows adding unlimited tools over time with clean structure and consistent experience.