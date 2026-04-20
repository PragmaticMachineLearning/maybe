# 🎨 Bullet-Proof Theme System

A zero-flash, instant-switching theme system for React + Tailwind with Light/Dark/System support.

## Features

- **Zero Flash**: Pre-paint script prevents white flash on page load
- **Instant Switching**: No lag when toggling themes
- **System Support**: Automatically follows system dark/light preference
- **Persistent**: Remembers user's theme choice across sessions
- **TypeScript**: Fully typed with excellent IDE support
- **Lightweight**: Minimal bundle impact with efficient implementation

## Usage

### Basic Hook Usage

```tsx
import { useTheme } from './hooks/useTheme';

function MyComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Resolved theme: {resolvedTheme}</p>
      
      {/* Theme selection */}
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
      
      {/* Quick toggle */}
      <button onClick={toggleTheme}>
        Toggle to {resolvedTheme === 'dark' ? 'light' : 'dark'}
      </button>
    </div>
  );
}
```

### Theme Toggle Component

```tsx
import { ThemeToggle } from './components/theme/ThemeToggle';

function App() {
  return (
    <div>
      <header>
        <ThemeToggle showLabel={true} />
      </header>
      {/* Your app content */}
    </div>
  );
}
```

## How It Works

### 1. Pre-Paint Script (`index.html`)

The inline script in `index.html` runs before React loads, immediately applying the correct theme class to prevent any flash of wrong theme:

- Reads theme preference from `localStorage`
- Falls back to system preference if no stored preference
- Applies `dark` class to `<html>` element instantly
- Sets `color-scheme` CSS property for optimal rendering
- Listens for system theme changes

### 2. React Hook (`useTheme`)

The `useTheme` hook provides:

- **`theme`**: User's preference (`'light'`, `'dark'`, or `'system'`)
- **`resolvedTheme`**: Actual theme being used (`'light'` or `'dark'`)
- **`setTheme(theme)`**: Change theme preference
- **`toggleTheme()`**: Quick toggle between light/dark

### 3. CSS Custom Properties

The system uses CSS custom properties for theming:

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #213547;
  /* ... other light theme vars */
}

:root.dark {
  --bg-primary: #1f2937;
  --text-primary: #f9fafb;
  /* ... other dark theme vars */
}
```

## API Reference

### `useTheme()` Hook

```tsx
interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}
```

### `ThemeToggle` Component

```tsx
interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}
```

## CSS Custom Properties

Available theme variables:

```css
/* Backgrounds */
--bg-primary    /* Main background */
--bg-secondary  /* Secondary background */
--bg-surface    /* Surface/card background */
--bg-header     /* Header background */
--bg-hover      /* Hover state background */

/* Text */
--text-primary    /* Primary text color */
--text-secondary  /* Secondary text color */
--text-muted      /* Muted text color */

/* Borders */
--border-color   /* Main border color */
--border-header  /* Header border color */

/* Effects */
--shadow         /* Main shadow */
--shadow-hover   /* Hover shadow */
```

## Integration with Tailwind

The system includes utility classes for common Tailwind patterns:

```css
.dark .bg-white { background-color: var(--bg-surface); }
.dark .text-gray-900 { color: var(--text-primary); }
/* ... more utilities */
```

## Browser Support

- ✅ All modern browsers
- ✅ Safari (iOS/macOS)
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Graceful fallback in older browsers

## Performance

- **Zero bundle overhead**: Pre-paint script is inline
- **Instant switching**: No re-renders, just CSS class changes
- **Efficient storage**: Uses localStorage with fallback
- **Optimized transitions**: Smooth 150ms transitions

## Troubleshooting

### Theme not persisting
- Check if localStorage is available
- Verify the pre-paint script is running

### Flash of wrong theme
- Ensure the pre-paint script is in `<head>` before any stylesheets
- Check that CSS custom properties are defined

### System theme not updating
- Verify `matchMedia` support in target browsers
- Check if the system theme change listener is active 
