/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcut functionality
 */

import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

/**
 * Register global keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifierKey = navigator.platform.includes('Mac') ? 'metaKey' : 'ctrlKey';

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;
        const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;

        // Handle Cmd/Ctrl platform differences
        let modifierMatches = true;
        if (shortcut.ctrlKey || shortcut.metaKey) {
          modifierMatches = event[modifierKey];
        }

        if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches && modifierMatches) {
          event.preventDefault();
          shortcut.handler(event);
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};

/**
 * Common keyboard shortcuts
 */
export const commonShortcuts = {
  /**
   * Cmd/Ctrl + K - Quick search
   */
  search: (handler: () => void): KeyboardShortcut => ({
    key: 'k',
    metaKey: true,
    handler,
    description: 'Open search',
  }),

  /**
   * Escape - Close/cancel
   */
  escape: (handler: () => void): KeyboardShortcut => ({
    key: 'Escape',
    handler,
    description: 'Close',
  }),

  /**
   * Cmd/Ctrl + Enter - Submit/save
   */
  submit: (handler: () => void): KeyboardShortcut => ({
    key: 'Enter',
    metaKey: true,
    handler,
    description: 'Submit',
  }),

  /**
   * Cmd/Ctrl + , - Settings
   */
  settings: (handler: () => void): KeyboardShortcut => ({
    key: ',',
    metaKey: true,
    handler,
    description: 'Open settings',
  }),

  /**
   * Cmd/Ctrl + / - Show keyboard shortcuts help
   */
  help: (handler: () => void): KeyboardShortcut => ({
    key: '/',
    metaKey: true,
    handler,
    description: 'Show shortcuts',
  }),

  /**
   * Arrow navigation
   */
  arrowUp: (handler: () => void): KeyboardShortcut => ({
    key: 'ArrowUp',
    handler,
    description: 'Navigate up',
  }),

  arrowDown: (handler: () => void): KeyboardShortcut => ({
    key: 'ArrowDown',
    handler,
    description: 'Navigate down',
  }),

  /**
   * Cmd/Ctrl + D - Toggle dark mode
   */
  toggleDarkMode: (handler: () => void): KeyboardShortcut => ({
    key: 'd',
    metaKey: true,
    shiftKey: true,
    handler,
    description: 'Toggle dark mode',
  }),
};

/**
 * Get platform-specific key labels
 */
export const getKeyLabel = (shortcut: KeyboardShortcut): string => {
  const isMac = navigator.platform.includes('Mac');
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shiftKey) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.altKey) parts.push(isMac ? '⌥' : 'Alt');

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
};
