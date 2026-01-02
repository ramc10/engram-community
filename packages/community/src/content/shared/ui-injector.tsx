/**
 * UI Injector
 * Injects the Memory Panel into platform pages
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryPanel } from './memory-panel';
import { Memory } from 'engram-shared/types/memory';

/**
 * UI Injector Class
 * Manages injection and lifecycle of UI components
 */
export class UIInjector {
  private root: Root | null = null;
  private container: HTMLElement | null = null;
  private conversationId: string | null = null;
  private currentContext: string = '';

  /**
   * Inject memory panel into the page
   */
  inject(injectionPoint: HTMLElement, conversationId?: string): void {
    // Remove existing injection if any
    this.remove();

    console.log('[UI Injector] Injecting memory panel...');

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'engram-memory-panel';
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    `;

    // Add to page
    document.body.appendChild(this.container);

    // Store conversation ID
    this.conversationId = conversationId || null;

    // Create React root and render
    this.root = createRoot(this.container);
    this.render();

    console.log('[UI Injector] Memory panel injected successfully');
  }

  /**
   * Inject inline into a specific element (e.g., sidebar)
   */
  injectInline(parent: HTMLElement, conversationId?: string): void {
    // Remove existing injection if any
    this.remove();

    console.log('[UI Injector] Injecting inline memory panel...');

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'engram-memory-panel-inline';
    this.container.style.cssText = `
      width: 100%;
      margin-bottom: 16px;
    `;

    // Add to parent
    parent.insertBefore(this.container, parent.firstChild);

    // Store conversation ID
    this.conversationId = conversationId || null;

    // Create React root and render
    this.root = createRoot(this.container);
    this.render();

    console.log('[UI Injector] Inline memory panel injected successfully');
  }

  /**
   * Update the current context
   */
  updateContext(context: string): void {
    if (this.currentContext === context) return;

    this.currentContext = context;
    this.render();
  }

  /**
   * Update conversation ID
   */
  updateConversation(conversationId: string): void {
    if (this.conversationId === conversationId) return;

    this.conversationId = conversationId;
    this.render();
  }

  /**
   * Render the component
   */
  private render(): void {
    if (!this.root) return;

    this.root.render(
      <MemoryPanel
        conversationId={this.conversationId || undefined}
        currentContext={this.currentContext}
        onMemoryClick={this.handleMemoryClick}
      />
    );
  }

  /**
   * Handle memory click
   */
  private handleMemoryClick = (memory: Memory): void => {
    console.log('[UI Injector] Memory clicked:', memory.id);
    
    // TODO: Could implement features like:
    // - Copy memory content to clipboard
    // - Insert memory into chat input
    // - Show detailed memory view
    // - Navigate to original conversation
  };

  /**
   * Remove the injected UI
   */
  remove(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }

    this.conversationId = null;
    this.currentContext = '';

    console.log('[UI Injector] Memory panel removed');
  }

  /**
   * Check if UI is currently injected
   */
  isInjected(): boolean {
    return this.root !== null && this.container !== null;
  }

  /**
   * Get container element
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }
}

/**
 * Singleton instance
 */
export const uiInjector = new UIInjector();
