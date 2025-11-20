# Project Coding Conventions

This document defines the coding standards and conventions for this project.

## Language & Style

- **JavaScript ONLY** - NO TypeScript
- **Always use semicolons** - End every statement with a semicolon
- **Modern JavaScript** - Use ES6+ features (arrow functions, destructuring, async/await, etc.)
- **File extensions** - `.js` for all JavaScript files (not `.jsx`, `.ts`, or `.tsx`)

## Code Formatting

```javascript
// ✅ GOOD - Uses semicolons
const foo = 'bar';
export default function Component() {
  return <div>Hello</div>;
}

// ❌ BAD - Missing semicolons
const foo = 'bar'
export default function Component() {
  return <div>Hello</div>
}
```

## Next.js Conventions

- **App Router** - Use `/app` directory structure (not pages directory)
- **File-based routing** - `page.js` for routes, `route.js` for API endpoints
- **Server Components by default** - Only use `'use client'` when necessary (forms, hooks, browser APIs)
- **API routes** - Place in `/app/api/` directory

## Server Management

**⚠️ IMPORTANT: DO NOT START SERVERS AUTOMATICALLY**

- **NEVER run `npm run dev`, `npm start`, or any server commands**
- The developer will start/stop servers manually
- Focus on code writing and file operations only

## Comments

- Add educational comments explaining:
  - What the code does
  - Why certain patterns are used
  - Next.js-specific concepts
  - Differences from traditional React or Rails patterns

## Dependencies

- **Tailwind CSS** - For styling
- **No additional CSS frameworks** - Keep it simple
- **Minimal dependencies** - Only add when absolutely necessary

## Environment Variables

- Store in `.env.local`
- Never commit to git (included in `.gitignore`)
- Document all required variables

## Component Structure

```javascript
/**
 * Component description
 *
 * Key concepts explained here
 */

// Server Component (default)
export default function ServerComponent({ props }) {
  return <div>Content</div>;
}

// Client Component (when needed)
'use client';

import { useState } from 'react';

export default function ClientComponent() {
  const [state, setState] = useState(null);
  return <div>Interactive content</div>;
}
```

## API Route Structure

```javascript
import { NextResponse } from 'next/server';

/**
 * API Route description
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    // Implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    );
  }
}
```

## Summary

- JavaScript only, no TypeScript
- Always use semicolons
- Modern ES6+ syntax
- Educational comments
- Server Components by default
- **NEVER start servers - developer handles this manually**
