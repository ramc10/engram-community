(function(define){var __define; typeof define === "function" && (__define=define,define=null);
// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"dJfO9":[function(require,module,exports) {
var d = globalThis.process?.argv || [];
var y = ()=>globalThis.process?.env || {};
var H = new Set(d), _ = (e)=>H.has(e), G = d.filter((e)=>e.startsWith("--") && e.includes("=")).map((e)=>e.split("=")).reduce((e, [t, o])=>(e[t] = o, e), {});
var Z = _("--dry-run"), p = ()=>_("--verbose") || y().VERBOSE === "true", q = p();
var u = (e = "", ...t)=>console.log(e.padEnd(9), "|", ...t);
var x = (...e)=>console.error("\uD83D\uDD34 ERROR".padEnd(9), "|", ...e), v = (...e)=>u("\uD83D\uDD35 INFO", ...e), m = (...e)=>u("\uD83D\uDFE0 WARN", ...e), S = 0, c = (...e)=>p() && u(`\u{1F7E1} ${S++}`, ...e);
var n = {
    "isContentScript": true,
    "isBackground": false,
    "isReact": false,
    "runtimes": [
        "script-runtime"
    ],
    "host": "localhost",
    "port": 1815,
    "entryFilePath": "/Users/rc/Projects/engram/extension/src/contents/index.ts",
    "bundleId": "d9c4e7319b79463d",
    "envHash": "e792fbbdaa78ee84",
    "verbose": "false",
    "secure": false,
    "serverPort": 60820
};
module.bundle.HMR_BUNDLE_ID = n.bundleId;
globalThis.process = {
    argv: [],
    env: {
        VERBOSE: n.verbose
    }
};
var D = module.bundle.Module;
function I(e) {
    D.call(this, e), this.hot = {
        data: module.bundle.hotData[e],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(t) {
            this._acceptCallbacks.push(t || function() {});
        },
        dispose: function(t) {
            this._disposeCallbacks.push(t);
        }
    }, module.bundle.hotData[e] = void 0;
}
module.bundle.Module = I;
module.bundle.hotData = {};
var l = globalThis.browser || globalThis.chrome || null;
function b() {
    return !n.host || n.host === "0.0.0.0" ? "localhost" : n.host;
}
function C() {
    return n.port || location.port;
}
var E = "__plasmo_runtime_script_";
function L(e, t) {
    let { modules: o } = e;
    return o ? !!o[t] : !1;
}
function O(e = C()) {
    let t = b();
    return `${n.secure || location.protocol === "https:" && !/localhost|127.0.0.1|0.0.0.0/.test(t) ? "wss" : "ws"}://${t}:${e}/`;
}
function B(e) {
    typeof e.message == "string" && x("[plasmo/parcel-runtime]: " + e.message);
}
function P(e) {
    if (typeof globalThis.WebSocket > "u") return;
    let t = new WebSocket(O());
    return t.addEventListener("message", async function(o) {
        let r = JSON.parse(o.data);
        if (r.type === "update" && await e(r.assets), r.type === "error") for (let a of r.diagnostics.ansi){
            let w = a.codeframe || a.stack;
            m("[plasmo/parcel-runtime]: " + a.message + `
` + w + `

` + a.hints.join(`
`));
        }
    }), t.addEventListener("error", B), t.addEventListener("open", ()=>{
        v(`[plasmo/parcel-runtime]: Connected to HMR server for ${n.entryFilePath}`);
    }), t.addEventListener("close", ()=>{
        m(`[plasmo/parcel-runtime]: Connection to the HMR server is closed for ${n.entryFilePath}`);
    }), t;
}
var s = "__plasmo-loading__";
function $() {
    let e = globalThis.window?.trustedTypes;
    if (typeof e > "u") return;
    let t = document.querySelector('meta[name="trusted-types"]')?.content?.split(" "), o = t ? t[t?.length - 1].replace(/;/g, "") : void 0;
    return typeof e < "u" ? e.createPolicy(o || `trusted-html-${s}`, {
        createHTML: (a)=>a
    }) : void 0;
}
var T = $();
function g() {
    return document.getElementById(s);
}
function f() {
    return !g();
}
function F() {
    let e = document.createElement("div");
    e.id = s;
    let t = `
  <style>
    #${s} {
      background: #f3f3f3;
      color: #333;
      border: 1px solid #333;
      box-shadow: #333 4.7px 4.7px;
    }

    #${s}:hover {
      background: #e3e3e3;
      color: #444;
    }

    @keyframes plasmo-loading-animate-svg-fill {
      0% {
        fill: transparent;
      }
    
      100% {
        fill: #333;
      }
    }

    #${s} .svg-elem-1 {
      animation: plasmo-loading-animate-svg-fill 1.47s cubic-bezier(0.47, 0, 0.745, 0.715) 0.8s both infinite;
    }

    #${s} .svg-elem-2 {
      animation: plasmo-loading-animate-svg-fill 1.47s cubic-bezier(0.47, 0, 0.745, 0.715) 0.9s both infinite;
    }
    
    #${s} .svg-elem-3 {
      animation: plasmo-loading-animate-svg-fill 1.47s cubic-bezier(0.47, 0, 0.745, 0.715) 1s both infinite;
    }

    #${s} .hidden {
      display: none;
    }

  </style>
  
  <svg height="32" width="32" viewBox="0 0 264 354" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M139.221 282.243C154.252 282.243 166.903 294.849 161.338 308.812C159.489 313.454 157.15 317.913 154.347 322.109C146.464 333.909 135.26 343.107 122.151 348.538C109.043 353.969 94.6182 355.39 80.7022 352.621C66.7861 349.852 54.0034 343.018 43.9705 332.983C33.9375 322.947 27.105 310.162 24.3369 296.242C21.5689 282.323 22.9895 267.895 28.4193 254.783C33.8491 241.671 43.0441 230.464 54.8416 222.579C59.0353 219.777 63.4908 217.438 68.1295 215.588C82.0915 210.021 94.6978 222.671 94.6978 237.703L94.6978 255.027C94.6978 270.058 106.883 282.243 121.914 282.243H139.221Z" fill="#333" class="svg-elem-1" ></path>
    <path d="M192.261 142.028C192.261 126.996 204.867 114.346 218.829 119.913C223.468 121.763 227.923 124.102 232.117 126.904C243.915 134.789 253.11 145.996 258.539 159.108C263.969 172.22 265.39 186.648 262.622 200.567C259.854 214.487 253.021 227.272 242.988 237.308C232.955 247.343 220.173 254.177 206.256 256.946C192.34 259.715 177.916 258.294 164.807 252.863C151.699 247.432 140.495 238.234 132.612 226.434C129.808 222.238 127.47 217.779 125.62 213.137C120.056 199.174 132.707 186.568 147.738 186.568L165.044 186.568C180.076 186.568 192.261 174.383 192.261 159.352L192.261 142.028Z" fill="#333" class="svg-elem-2" ></path>
    <path d="M95.6522 164.135C95.6522 179.167 83.2279 191.725 68.8013 187.505C59.5145 184.788 50.6432 180.663 42.5106 175.227C26.7806 164.714 14.5206 149.772 7.28089 132.289C0.041183 114.807 -1.85305 95.5697 1.83772 77.0104C5.52849 58.4511 14.6385 41.4033 28.0157 28.0228C41.393 14.6423 58.4366 5.53006 76.9914 1.83839C95.5461 -1.85329 114.779 0.0414162 132.257 7.2829C149.735 14.5244 164.674 26.7874 175.184 42.5212C180.62 50.6576 184.744 59.5332 187.46 68.8245C191.678 83.2519 179.119 95.6759 164.088 95.6759L122.869 95.6759C107.837 95.6759 95.6522 107.861 95.6522 122.892L95.6522 164.135Z" fill="#333" class="svg-elem-3"></path>
  </svg>
  <span class="hidden">Context Invalidated, Press to Reload</span>
  `;
    return e.innerHTML = T ? T.createHTML(t) : t, e.style.pointerEvents = "none", e.style.position = "fixed", e.style.bottom = "14.7px", e.style.right = "14.7px", e.style.fontFamily = "sans-serif", e.style.display = "flex", e.style.justifyContent = "center", e.style.alignItems = "center", e.style.padding = "14.7px", e.style.gap = "14.7px", e.style.borderRadius = "4.7px", e.style.zIndex = "2147483647", e.style.opacity = "0", e.style.transition = "all 0.47s ease-in-out", e;
}
function N(e) {
    return new Promise((t)=>{
        document.documentElement ? (f() && (document.documentElement.appendChild(e), t()), t()) : globalThis.addEventListener("DOMContentLoaded", ()=>{
            f() && document.documentElement.appendChild(e), t();
        });
    });
}
var k = ()=>{
    let e;
    if (f()) {
        let t = F();
        e = N(t);
    }
    return {
        show: async ({ reloadButton: t = !1 } = {})=>{
            await e;
            let o = g();
            o.style.opacity = "1", t && (o.onclick = (r)=>{
                r.stopPropagation(), globalThis.location.reload();
            }, o.querySelector("span").classList.remove("hidden"), o.style.cursor = "pointer", o.style.pointerEvents = "all");
        },
        hide: async ()=>{
            await e;
            let t = g();
            t.style.opacity = "0";
        }
    };
};
var W = `${E}${module.id}__`, i, A = !1, M = k();
async function h() {
    c("Script Runtime - reloading"), A ? globalThis.location?.reload?.() : M.show({
        reloadButton: !0
    });
}
function R() {
    i?.disconnect(), i = l?.runtime.connect({
        name: W
    }), i.onDisconnect.addListener(()=>{
        h();
    }), i.onMessage.addListener((e)=>{
        e.__plasmo_cs_reload__ && h(), e.__plasmo_cs_active_tab__ && (A = !0);
    });
}
function j() {
    if (l?.runtime) try {
        R(), setInterval(R, 24e3);
    } catch  {
        return;
    }
}
j();
P(async (e)=>{
    c("Script runtime - on updated assets"), e.filter((o)=>o.envHash === n.envHash).some((o)=>L(module.bundle, o.id)) && (M.show(), l?.runtime ? i.postMessage({
        __plasmo_cs_changed__: !0
    }) : setTimeout(()=>{
        h();
    }, 4700));
});

},{}],"eViry":[function(require,module,exports) {
/**
 * Plasmo Content Script Entry Point
 * This file is automatically detected by Plasmo and injected into matching pages
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "config", ()=>config);
// Direct implementation using platform adapters
var _chatgptAdapter = require("../content/platforms/chatgpt-adapter");
var _claudeAdapter = require("../content/platforms/claude-adapter");
var _messages = require("../lib/messages");
const config = {
    matches: [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://www.perplexity.ai/*"
    ],
    all_frames: false,
    run_at: "document_end"
};
/**
 * Simple initialization
 */ (async ()=>{
    try {
        console.log("[Engram] Plasmo content script starting...");
        // Wait for DOM
        if (document.readyState === "loading") await new Promise((resolve)=>{
            document.addEventListener("DOMContentLoaded", resolve, {
                once: true
            });
        });
        // Detect platform
        const url = window.location.href;
        console.log("[Engram] URL:", url);
        if (url.includes("chat.openai.com") || url.includes("chatgpt.com")) {
            console.log("[Engram] ChatGPT detected, initializing adapter...");
            // Initialize background connection
            const initResponse = await (0, _messages.sendInitRequest)();
            if (!initResponse.success) {
                console.error("[Engram] Background init failed:", initResponse.error);
                return;
            }
            console.log("[Engram] Background connected, device ID:", initResponse.deviceId);
            // Initialize adapter
            await (0, _chatgptAdapter.chatGPTAdapter).initialize();
            console.log("[Engram] Adapter initialized");
            // Start observing messages (now async with retries)
            await (0, _chatgptAdapter.chatGPTAdapter).observeMessages(async (extractedMessage)=>{
                console.log("[Engram] Message extracted:", {
                    role: extractedMessage.role,
                    contentLength: extractedMessage.content.length,
                    conversationId: extractedMessage.conversationId
                });
                try {
                    const saveResponse = await (0, _messages.sendSaveMessage)(extractedMessage);
                    if (saveResponse.success) console.log("[Engram] Message saved successfully");
                    else console.error("[Engram] Failed to save message:", saveResponse.error);
                } catch (error) {
                    console.error("[Engram] Error saving message:", error);
                }
            });
            console.log("[Engram] Ready - monitoring ChatGPT messages");
        } else if (url.includes("claude.ai")) {
            console.log("[Engram] Claude detected, initializing adapter...");
            // Initialize background connection
            const initResponse = await (0, _messages.sendInitRequest)();
            if (!initResponse.success) {
                console.error("[Engram] Background init failed:", initResponse.error);
                return;
            }
            console.log("[Engram] Background connected, device ID:", initResponse.deviceId);
            // Initialize adapter
            await (0, _claudeAdapter.claudeAdapter).initialize();
            console.log("[Engram] Adapter initialized");
            // Start observing messages
            await (0, _claudeAdapter.claudeAdapter).observeMessages(async (extractedMessage)=>{
                console.log("[Engram] Message extracted:", {
                    role: extractedMessage.role,
                    contentLength: extractedMessage.content.length,
                    conversationId: extractedMessage.conversationId
                });
                try {
                    const saveResponse = await (0, _messages.sendSaveMessage)(extractedMessage);
                    if (saveResponse.success) console.log("[Engram] Message saved successfully");
                    else console.error("[Engram] Failed to save message:", saveResponse.error);
                } catch (error) {
                    console.error("[Engram] Error saving message:", error);
                }
            });
            console.log("[Engram] Ready - monitoring Claude messages");
        } else console.log("[Engram] Platform not yet supported:", url);
    } catch (error) {
        console.error("[Engram] Content script error:", error);
    }
})();

},{"../content/platforms/chatgpt-adapter":"hes0b","../content/platforms/claude-adapter":"kWY9N","../lib/messages":"6nUXI","@parcel/transformer-js/src/esmodule-helpers.js":"boKlo"}],"hes0b":[function(require,module,exports) {
/**
 * ChatGPT Platform Adapter
 * Implements IPlatformAdapter for ChatGPT (chat.openai.com)
 * 
 * DOM Structure (as of Dec 2024):
 * - Messages: article[data-testid^="conversation-turn"]
 * - User messages: .text-message (with data-message-author-role="user")
 * - Assistant messages: .text-message (with data-message-author-role="assistant")
 * - Code blocks: pre > code with .language-* classes
 * - Conversation ID: URL pattern /c/{conversation-id}
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * ChatGPT Platform Adapter Implementation
 */ parcelHelpers.export(exports, "ChatGPTAdapter", ()=>ChatGPTAdapter);
parcelHelpers.export(exports, "chatGPTAdapter", ()=>chatGPTAdapter);
/**
 * ChatGPT DOM selectors
 * Updated for current ChatGPT UI (Dec 2024)
 */ const SELECTORS = {
    containerSelector: "#thread, main > div",
    messageSelector: 'article[data-testid^="conversation-turn"]',
    contentSelector: "[data-message-author-role] .markdown",
    codeBlockSelector: "pre code",
    injectionPointSelector: "main aside, main > div:last-child"
};
/**
 * ChatGPT feature support
 */ const FEATURES = {
    supportsStreaming: true,
    supportsCodeBlocks: true,
    supportsAttachments: true,
    supportsRegeneration: true
};
class ChatGPTAdapter {
    /**
   * Get platform configuration
   */ getConfig() {
        return {
            platformId: "chatgpt",
            selectors: SELECTORS,
            urlPattern: /^https:\/\/chat(?:gpt)?\.openai\.com/,
            conversationIdExtractor: this.extractConversationIdFromUrl,
            features: FEATURES
        };
    }
    /**
   * Initialize the adapter
   */ async initialize() {
        // Clear any previous state
        this.lastProcessedMessages.clear();
        // Wait for page to be ready
        if (document.readyState === "loading") await new Promise((resolve)=>{
            document.addEventListener("DOMContentLoaded", resolve, {
                once: true
            });
        });
    }
    /**
   * Clean up resources
   */ destroy() {
        this.stopObserving();
        this.lastProcessedMessages.clear();
        this.observerCallback = null;
    }
    /**
   * Check if current URL is ChatGPT
   */ isCurrentPlatform(url) {
        return this.getConfig().urlPattern.test(url);
    }
    /**
   * Extract conversation ID from URL
   */ extractConversationIdFromUrl(url) {
        // URL pattern: https://chat.openai.com/c/{conversation-id}
        const match = url.match(/\/c\/([\w-]+)/);
        return match ? match[1] : null;
    }
    /**
   * Extract conversation ID from current page
   */ extractConversationId() {
        return this.extractConversationIdFromUrl(window.location.href);
    }
    /**
   * Extract a single message from DOM element
   */ extractMessage(element) {
        try {
            // Get role from data attribute
            const roleAttr = element.querySelector("[data-message-author-role]");
            if (!roleAttr) return null;
            const roleValue = roleAttr.getAttribute("data-message-author-role");
            if (!roleValue || roleValue !== "user" && roleValue !== "assistant") return null;
            const role = roleValue;
            // Extract content
            const contentElement = element.querySelector(SELECTORS.contentSelector);
            if (!contentElement) return null;
            let content = this.extractTextContent(contentElement);
            // Extract code blocks
            const codeBlocks = this.extractCodeBlocks(element);
            // Get conversation ID
            const conversationId = this.extractConversationId();
            if (!conversationId) return null;
            // Check if message is still streaming
            const isStreaming = this.isMessageStreaming(element);
            // Get message timestamp (use current time as ChatGPT doesn't expose timestamps)
            const timestamp = Date.now();
            // Get message index from DOM position
            const container = document.querySelector(SELECTORS.containerSelector);
            const messages = container?.querySelectorAll(SELECTORS.messageSelector);
            const messageIndex = messages ? Array.from(messages).indexOf(element) : undefined;
            return {
                role,
                content,
                timestamp,
                conversationId,
                metadata: {
                    codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
                    isStreaming,
                    messageIndex
                }
            };
        } catch (error) {
            console.error("ChatGPT adapter: Error extracting message:", error);
            return null;
        }
    }
    /**
   * Extract text content from element, handling markdown
   */ extractTextContent(element) {
        // Clone to avoid modifying DOM
        const clone = element.cloneNode(true);
        // Remove code blocks (we handle them separately)
        clone.querySelectorAll("pre").forEach((pre)=>pre.remove());
        // Get text content
        let text = clone.textContent || "";
        // Clean up whitespace
        text = text.split("\n") // Split into lines
        .map((line)=>line.trim()) // Trim each line
        .join("\n") // Rejoin
        .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
        .trim();
        return text;
    }
    /**
   * Extract code blocks from message
   */ extractCodeBlocks(element) {
        const blocks = [];
        const codeElements = element.querySelectorAll(SELECTORS.codeBlockSelector);
        codeElements.forEach((codeEl)=>{
            const code = codeEl.textContent || "";
            // Extract language from class (e.g., "language-python")
            let language = "plaintext";
            const classes = codeEl.className;
            const langMatch = classes.match(/language-(\w+)/);
            if (langMatch) language = langMatch[1];
            blocks.push({
                language,
                code: code.trim()
            });
        });
        return blocks;
    }
    /**
   * Check if message is currently streaming (being written)
   */ isMessageStreaming(element) {
        // ChatGPT shows a blinking cursor or "stop generating" button during streaming
        const parent = element.closest('[data-testid^="conversation-turn"]');
        if (!parent) return false;
        // Look for streaming indicators
        const hasStopButton = !!document.querySelector('button[aria-label*="Stop"]');
        const hasCursor = !!parent.querySelector('.cursor-blink, [class*="cursor"]');
        return hasStopButton || hasCursor;
    }
    /**
   * Wait for container to appear in DOM
   */ async waitForContainer(maxAttempts = 10, delayMs = 500) {
        for(let i = 0; i < maxAttempts; i++){
            const container = document.querySelector(SELECTORS.containerSelector);
            if (container) {
                console.log(`ChatGPT adapter: Container found on attempt ${i + 1}`);
                return container;
            }
            console.log(`ChatGPT adapter: Waiting for container (attempt ${i + 1}/${maxAttempts})...`);
            await new Promise((resolve)=>setTimeout(resolve, delayMs));
        }
        return null;
    }
    /**
   * Start observing messages
   */ async observeMessages(callback) {
        this.observerCallback = callback;
        // Wait for container with retries
        const container = await this.waitForContainer();
        if (!container) {
            console.error("ChatGPT adapter: Message container not found after retries");
            console.error("ChatGPT adapter: Looking for selector:", SELECTORS.containerSelector);
            console.error("ChatGPT adapter: Available main elements:", document.querySelectorAll("main > *"));
            return;
        }
        console.log("ChatGPT adapter: Starting to observe messages");
        // Process existing messages
        this.processExistingMessages();
        // Set up mutation observer for new messages
        this.observer = new MutationObserver((mutations)=>{
            this.handleMutations(mutations);
        });
        this.observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    /**
   * Stop observing messages
   */ stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
    /**
   * Process existing messages on page
   */ processExistingMessages() {
        const container = document.querySelector(SELECTORS.containerSelector);
        if (!container) return;
        const messages = container.querySelectorAll(SELECTORS.messageSelector);
        messages.forEach((msg)=>{
            this.processMessage(msg);
        });
    }
    /**
   * Handle DOM mutations
   */ handleMutations(mutations) {
        for (const mutation of mutations){
            // Check for new message elements
            if (mutation.type === "childList") mutation.addedNodes.forEach((node)=>{
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node;
                    // Check if it's a message or contains messages
                    if (element.matches(SELECTORS.messageSelector)) this.processMessage(element);
                    else {
                        const messages = element.querySelectorAll(SELECTORS.messageSelector);
                        messages.forEach((msg)=>this.processMessage(msg));
                    }
                }
            });
            // Handle streaming updates (characterData changes)
            if (mutation.type === "characterData") {
                const element = mutation.target.parentElement;
                if (element) {
                    const message = element.closest(SELECTORS.messageSelector);
                    if (message) this.processMessage(message);
                }
            }
        }
    }
    /**
   * Process a single message element
   */ processMessage(element) {
        if (!this.observerCallback) return;
        // Create unique ID for message (use DOM position as ChatGPT doesn't have IDs)
        const messageId = this.getMessageId(element);
        // Skip if already processed and not streaming
        if (this.lastProcessedMessages.has(messageId) && !this.isMessageStreaming(element)) return;
        const extracted = this.extractMessage(element);
        if (extracted) {
            this.lastProcessedMessages.add(messageId);
            this.observerCallback(extracted);
        }
    }
    /**
   * Generate unique ID for message element
   */ getMessageId(element) {
        const container = document.querySelector(SELECTORS.containerSelector);
        const messages = container?.querySelectorAll(SELECTORS.messageSelector);
        const index = messages ? Array.from(messages).indexOf(element) : -1;
        const conversationId = this.extractConversationId() || "unknown";
        return `${conversationId}-${index}`;
    }
    /**
   * Get injection point for memory UI
   */ getInjectionPoint() {
        // Try sidebar first
        let injectionPoint = document.querySelector("main aside");
        // Fallback to main container
        if (!injectionPoint) injectionPoint = document.querySelector("main > div:last-child");
        return injectionPoint;
    }
    /**
   * Check if memory UI should be shown
   */ shouldShowMemoryUI() {
        // Show UI if we have a valid conversation
        const conversationId = this.extractConversationId();
        // Only show in conversation view, not on home page
        return conversationId !== null;
    }
    constructor(){
        this.observer = null;
        this.observerCallback = null;
        this.lastProcessedMessages = new Set();
    }
}
const chatGPTAdapter = new ChatGPTAdapter();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"boKlo"}],"boKlo":[function(require,module,exports) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, "__esModule", {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === "default" || key === "__esModule" || dest.hasOwnProperty(key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"kWY9N":[function(require,module,exports) {
/**
 * Claude Platform Adapter
 * Handles message extraction and observation for Claude AI (claude.ai)
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "claudeAdapter", ()=>claudeAdapter);
/**
 * Claude DOM selectors (verified Dec 2024)
 */ const SELECTORS = {
    containerSelector: "body",
    messageSelector: "[data-test-render-count]",
    contentSelector: ".font-user-message, .font-claude-response",
    codeBlockSelector: "pre code",
    injectionPointSelector: "aside"
};
/**
 * Claude feature support
 */ const FEATURES = {
    supportsStreaming: true,
    supportsCodeBlocks: true,
    supportsAttachments: true,
    supportsRegeneration: true
};
/**
 * Claude Platform Adapter Implementation
 */ class ClaudeAdapter {
    /**
   * Get platform configuration
   */ getConfig() {
        return {
            platformId: "claude",
            selectors: SELECTORS,
            urlPattern: /^https:\/\/claude\.ai/,
            conversationIdExtractor: (url)=>{
                const match = url.match(/\/chat\/([a-f0-9-]+)/);
                return match ? match[1] : null;
            },
            features: FEATURES
        };
    }
    /**
   * Check if current URL is Claude
   */ isCurrentPlatform(url) {
        return this.getConfig().urlPattern.test(url);
    }
    /**
   * Initialize the adapter
   */ async initialize() {
        console.log("[Claude Adapter] Initializing...");
        this.processedMessages.clear();
        console.log("[Claude Adapter] Ready");
    }
    /**
   * Extract conversation ID from URL
   * Claude format: https://claude.ai/chat/{conversation-id}
   */ extractConversationId() {
        const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
        return match ? match[1] : null;
    }
    /**
   * Get injection point for UI
   * Claude has a sidebar that could be used
   */ getInjectionPoint() {
        // Try to find sidebar or suitable container
        // This is a placeholder - actual selector depends on Claude's DOM structure
        return document.querySelector("aside") || null;
    }
    /**
   * Start observing messages
   */ observeMessages(callback) {
        this.messageCallback = callback;
        console.log("[Claude Adapter] Starting message observation...");
        // Process existing messages first
        this.processExistingMessages();
        // Watch for new messages
        this.startMutationObserver();
    }
    /**
   * Process existing messages on page
   */ processExistingMessages() {
        const messageElements = document.querySelectorAll("[data-test-render-count]");
        console.log(`[Claude Adapter] Found ${messageElements.length} existing messages`);
        messageElements.forEach((element)=>{
            this.processMessage(element);
        });
    }
    /**
   * Start mutation observer for new messages
   */ startMutationObserver() {
        this.observer = new MutationObserver((mutations)=>{
            for (const mutation of mutations){
                if (mutation.type === "childList") mutation.addedNodes.forEach((node)=>{
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node;
                        // Check if this is a message element
                        if (element.hasAttribute && element.hasAttribute("data-test-render-count")) this.processMessage(element);
                        else if (element.querySelectorAll) {
                            // Check if element contains messages
                            const messages = element.querySelectorAll("[data-test-render-count]");
                            messages.forEach((msg)=>this.processMessage(msg));
                        }
                    }
                });
                // Handle streaming updates (text changes)
                if (mutation.type === "characterData") {
                    const element = mutation.target.parentElement;
                    if (element) {
                        const message = element.closest("[data-test-render-count]");
                        if (message) this.processMessage(message);
                    }
                }
            }
        });
        // Observe the body for new messages
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        console.log("[Claude Adapter] Mutation observer started");
    }
    /**
   * Process a single message element
   */ processMessage(element) {
        if (!this.messageCallback) return;
        try {
            const message = this.extractMessageFromElement(element);
            if (message && message.content) // Use content-based deduplication (similar to ChatGPT adapter)
            // This accepts streaming spam for MVP
            {
                if (!this.processedMessages.has(message.content)) {
                    this.processedMessages.add(message.content);
                    this.messageCallback(message);
                }
            }
        } catch (error) {
            console.error("[Claude Adapter] Error processing message:", error);
        }
    }
    /**
   * Extract message data from DOM element
   */ extractMessageFromElement(element, index) {
        try {
            // Determine role using Claude's actual classes
            const userMessage = element.querySelector(".font-user-message");
            const assistantMessage = element.querySelector(".font-claude-response");
            if (!userMessage && !assistantMessage) return null; // Not a message element
            const role = userMessage ? "user" : "assistant";
            const contentElement = userMessage || assistantMessage;
            // Extract text content
            const rawText = contentElement.textContent || "";
            // Extract code blocks
            const codeBlocks = this.extractCodeBlocks(element);
            // Clean text (remove code blocks that will be in metadata)
            let cleanText = rawText;
            codeBlocks.forEach((block)=>{
                cleanText = cleanText.replace(block.code, "");
            });
            cleanText = cleanText.trim();
            if (!cleanText && codeBlocks.length === 0) return null;
            const conversationId = this.extractConversationId();
            if (!conversationId) return null;
            return {
                role,
                content: cleanText,
                timestamp: Date.now(),
                conversationId,
                metadata: {
                    codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined,
                    messageIndex: index
                }
            };
        } catch (error) {
            console.error("[Claude Adapter] Error extracting message:", error);
            return null;
        }
    }
    /**
   * Extract message from DOM element
   */ extractMessage(element) {
        return this.extractMessageFromElement(element);
    }
    /**
   * Check if memory UI should be shown
   */ shouldShowMemoryUI() {
        const conversationId = this.extractConversationId();
        return conversationId !== null;
    }
    /**
   * Extract code blocks from message
   */ extractCodeBlocks(element) {
        const blocks = [];
        // Claude uses pre > code structure
        const codeElements = element.querySelectorAll("pre code, pre");
        codeElements.forEach((codeElement)=>{
            const code = codeElement.textContent?.trim();
            if (!code) return;
            // Try to detect language from class or data attribute
            let language;
            // Check for language class (e.g., "language-python")
            const classes = codeElement.className.split(" ");
            const langClass = classes.find((c)=>c.startsWith("language-"));
            if (langClass) language = langClass.replace("language-", "");
            // Check for data-language attribute
            const dataLang = codeElement.getAttribute("data-language");
            if (dataLang) language = dataLang;
            // ExtractedCodeBlock requires language to be non-optional, default to plaintext
            blocks.push({
                language: language || "plaintext",
                code
            });
        });
        return blocks;
    }
    /**
   * Stop observing messages
   */ stopObserving() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.messageCallback = null;
        console.log("[Claude Adapter] Stopped observing");
    }
    /**
   * Cleanup
   */ destroy() {
        this.stopObserving();
        this.processedMessages.clear();
        console.log("[Claude Adapter] Destroyed");
    }
    constructor(){
        this.observer = null;
        this.messageCallback = null;
        this.processedMessages = new Set();
    }
}
const claudeAdapter = new ClaudeAdapter();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"boKlo"}],"6nUXI":[function(require,module,exports) {
/**
 * Message Protocol
 * Type-safe message passing between content scripts and background service worker
 * 
 * Message Flow:
 * Content Script \u2192 Background Worker \u2192 Storage/Crypto
 * Background Worker \u2192 Content Script (responses)
 */ var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "MessageType", ()=>MessageType);
/**
 * Type guard for message validation
 */ parcelHelpers.export(exports, "isValidMessage", ()=>isValidMessage);
/**
 * Generate unique request ID
 */ parcelHelpers.export(exports, "generateRequestId", ()=>generateRequestId);
/**
 * Send message to background worker
 */ parcelHelpers.export(exports, "sendMessage", ()=>sendMessage);
/**
 * Helper: Send init request
 */ parcelHelpers.export(exports, "sendInitRequest", ()=>sendInitRequest);
/**
 * Helper: Save extracted message
 */ parcelHelpers.export(exports, "sendSaveMessage", ()=>sendSaveMessage);
/**
 * Helper: Get memories
 */ parcelHelpers.export(exports, "sendGetMemories", ()=>sendGetMemories);
/**
 * Helper: Search memories
 */ parcelHelpers.export(exports, "sendSearchMemories", ()=>sendSearchMemories);
/**
 * Helper: Get sync status
 */ parcelHelpers.export(exports, "sendGetSyncStatus", ()=>sendGetSyncStatus);
/**
 * Create error response
 */ parcelHelpers.export(exports, "createErrorResponse", ()=>createErrorResponse);
/**
 * Validate message structure
 */ parcelHelpers.export(exports, "validateMessage", ()=>validateMessage);
var MessageType;
(function(MessageType) {
    MessageType[// Initialization
    "INIT_REQUEST"] = "INIT_REQUEST";
    MessageType["INIT_RESPONSE"] = "INIT_RESPONSE";
    MessageType[// Message Extraction
    "SAVE_MESSAGE"] = "SAVE_MESSAGE";
    MessageType["SAVE_MESSAGE_RESPONSE"] = "SAVE_MESSAGE_RESPONSE";
    MessageType[// Memory Queries
    "GET_MEMORIES"] = "GET_MEMORIES";
    MessageType["GET_MEMORIES_RESPONSE"] = "GET_MEMORIES_RESPONSE";
    MessageType["SEARCH_MEMORIES"] = "SEARCH_MEMORIES";
    MessageType["SEARCH_MEMORIES_RESPONSE"] = "SEARCH_MEMORIES_RESPONSE";
    MessageType[// Sync Status
    "GET_SYNC_STATUS"] = "GET_SYNC_STATUS";
    MessageType["GET_SYNC_STATUS_RESPONSE"] = "GET_SYNC_STATUS_RESPONSE";
    MessageType[// Authentication
    "AUTH_REGISTER"] = "AUTH_REGISTER";
    MessageType["AUTH_REGISTER_RESPONSE"] = "AUTH_REGISTER_RESPONSE";
    MessageType["AUTH_LOGIN"] = "AUTH_LOGIN";
    MessageType["AUTH_LOGIN_RESPONSE"] = "AUTH_LOGIN_RESPONSE";
    MessageType["AUTH_LOGOUT"] = "AUTH_LOGOUT";
    MessageType["AUTH_LOGOUT_RESPONSE"] = "AUTH_LOGOUT_RESPONSE";
    MessageType["GET_AUTH_STATE"] = "GET_AUTH_STATE";
    MessageType["GET_AUTH_STATE_RESPONSE"] = "GET_AUTH_STATE_RESPONSE";
    MessageType[// Errors
    "ERROR"] = "ERROR";
})(MessageType || (MessageType = {}));
function isValidMessage(obj) {
    return obj && typeof obj === "object" && "type" in obj && typeof obj.type === "string";
}
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function sendMessage(message) {
    const requestId = generateRequestId();
    const messageWithId = {
        ...message,
        requestId
    };
    return new Promise((resolve, reject)=>{
        chrome.runtime.sendMessage(messageWithId, (response)=>{
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (response && response.type === MessageType.ERROR) {
                reject(new Error(response.error));
                return;
            }
            resolve(response);
        });
    });
}
async function sendInitRequest() {
    return sendMessage({
        type: MessageType.INIT_REQUEST
    });
}
async function sendSaveMessage(message) {
    return sendMessage({
        type: MessageType.SAVE_MESSAGE,
        message
    });
}
async function sendGetMemories(filter) {
    return sendMessage({
        type: MessageType.GET_MEMORIES,
        filter
    });
}
async function sendSearchMemories(query, limit) {
    return sendMessage({
        type: MessageType.SEARCH_MEMORIES,
        query,
        limit
    });
}
async function sendGetSyncStatus() {
    return sendMessage({
        type: MessageType.GET_SYNC_STATUS
    });
}
function createErrorResponse(error, originalType) {
    return {
        type: MessageType.ERROR,
        error: error instanceof Error ? error.message : error,
        originalType
    };
}
function validateMessage(message) {
    if (!message || typeof message !== "object") return {
        valid: false,
        error: "Message must be an object"
    };
    if (!message.type || typeof message.type !== "string") return {
        valid: false,
        error: "Message must have a type string"
    };
    if (!Object.values(MessageType).includes(message.type)) return {
        valid: false,
        error: `Invalid message type: ${message.type}`
    };
    return {
        valid: true
    };
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"boKlo"}]},["dJfO9","eViry"], "eViry", "parcelRequire4feb")

//# sourceMappingURL=data:application/json;charset=utf-8;base64,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TztRQUFFLE9BQU87UUFBTyxPQUFPLENBQUMsc0JBQXNCLEVBQUUsUUFBUSxLQUFLLENBQUM7SUFBQztJQUd4RSxPQUFPO1FBQUUsT0FBTztJQUFLO0FBQ3ZCIiwic291cmNlcyI6WyJub2RlX21vZHVsZXMvQHBsYXNtb2hxL3BhcmNlbC1ydW50aW1lL2Rpc3QvcnVudGltZS1lMDE3YjU4OTgyMzU1NmZiLmpzIiwiZXh0ZW5zaW9uL3NyYy9jb250ZW50cy9pbmRleC50cyIsImV4dGVuc2lvbi9zcmMvY29udGVudC9wbGF0Zm9ybXMvY2hhdGdwdC1hZGFwdGVyLnRzIiwibm9kZV9tb2R1bGVzL0BwYXJjZWwvdHJhbnNmb3JtZXItanMvc3JjL2VzbW9kdWxlLWhlbHBlcnMuanMiLCJleHRlbnNpb24vc3JjL2NvbnRlbnQvcGxhdGZvcm1zL2NsYXVkZS1hZGFwdGVyLnRzIiwiZXh0ZW5zaW9uL3NyYy9saWIvbWVzc2FnZXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsidmFyIGQ9Z2xvYmFsVGhpcy5wcm9jZXNzPy5hcmd2fHxbXTt2YXIgeT0oKT0+Z2xvYmFsVGhpcy5wcm9jZXNzPy5lbnZ8fHt9O3ZhciBIPW5ldyBTZXQoZCksXz1lPT5ILmhhcyhlKSxHPWQuZmlsdGVyKGU9PmUuc3RhcnRzV2l0aChcIi0tXCIpJiZlLmluY2x1ZGVzKFwiPVwiKSkubWFwKGU9PmUuc3BsaXQoXCI9XCIpKS5yZWR1Y2UoKGUsW3Qsb10pPT4oZVt0XT1vLGUpLHt9KTt2YXIgWj1fKFwiLS1kcnktcnVuXCIpLHA9KCk9Pl8oXCItLXZlcmJvc2VcIil8fHkoKS5WRVJCT1NFPT09XCJ0cnVlXCIscT1wKCk7dmFyIHU9KGU9XCJcIiwuLi50KT0+Y29uc29sZS5sb2coZS5wYWRFbmQoOSksXCJ8XCIsLi4udCk7dmFyIHg9KC4uLmUpPT5jb25zb2xlLmVycm9yKFwiXFx1ezFGNTM0fSBFUlJPUlwiLnBhZEVuZCg5KSxcInxcIiwuLi5lKSx2PSguLi5lKT0+dShcIlxcdXsxRjUzNX0gSU5GT1wiLC4uLmUpLG09KC4uLmUpPT51KFwiXFx1ezFGN0UwfSBXQVJOXCIsLi4uZSksUz0wLGM9KC4uLmUpPT5wKCkmJnUoYFxcdXsxRjdFMX0gJHtTKyt9YCwuLi5lKTt2YXIgbj17XCJpc0NvbnRlbnRTY3JpcHRcIjp0cnVlLFwiaXNCYWNrZ3JvdW5kXCI6ZmFsc2UsXCJpc1JlYWN0XCI6ZmFsc2UsXCJydW50aW1lc1wiOltcInNjcmlwdC1ydW50aW1lXCJdLFwiaG9zdFwiOlwibG9jYWxob3N0XCIsXCJwb3J0XCI6MTgxNSxcImVudHJ5RmlsZVBhdGhcIjpcIi9Vc2Vycy9yYy9Qcm9qZWN0cy9lbmdyYW0vZXh0ZW5zaW9uL3NyYy9jb250ZW50cy9pbmRleC50c1wiLFwiYnVuZGxlSWRcIjpcImQ5YzRlNzMxOWI3OTQ2M2RcIixcImVudkhhc2hcIjpcImU3OTJmYmJkYWE3OGVlODRcIixcInZlcmJvc2VcIjpcImZhbHNlXCIsXCJzZWN1cmVcIjpmYWxzZSxcInNlcnZlclBvcnRcIjo2MDgyMH07bW9kdWxlLmJ1bmRsZS5ITVJfQlVORExFX0lEPW4uYnVuZGxlSWQ7Z2xvYmFsVGhpcy5wcm9jZXNzPXthcmd2OltdLGVudjp7VkVSQk9TRTpuLnZlcmJvc2V9fTt2YXIgRD1tb2R1bGUuYnVuZGxlLk1vZHVsZTtmdW5jdGlvbiBJKGUpe0QuY2FsbCh0aGlzLGUpLHRoaXMuaG90PXtkYXRhOm1vZHVsZS5idW5kbGUuaG90RGF0YVtlXSxfYWNjZXB0Q2FsbGJhY2tzOltdLF9kaXNwb3NlQ2FsbGJhY2tzOltdLGFjY2VwdDpmdW5jdGlvbih0KXt0aGlzLl9hY2NlcHRDYWxsYmFja3MucHVzaCh0fHxmdW5jdGlvbigpe30pfSxkaXNwb3NlOmZ1bmN0aW9uKHQpe3RoaXMuX2Rpc3Bvc2VDYWxsYmFja3MucHVzaCh0KX19LG1vZHVsZS5idW5kbGUuaG90RGF0YVtlXT12b2lkIDB9bW9kdWxlLmJ1bmRsZS5Nb2R1bGU9STttb2R1bGUuYnVuZGxlLmhvdERhdGE9e307dmFyIGw9Z2xvYmFsVGhpcy5icm93c2VyfHxnbG9iYWxUaGlzLmNocm9tZXx8bnVsbDtmdW5jdGlvbiBiKCl7cmV0dXJuIW4uaG9zdHx8bi5ob3N0PT09XCIwLjAuMC4wXCI/XCJsb2NhbGhvc3RcIjpuLmhvc3R9ZnVuY3Rpb24gQygpe3JldHVybiBuLnBvcnR8fGxvY2F0aW9uLnBvcnR9dmFyIEU9XCJfX3BsYXNtb19ydW50aW1lX3NjcmlwdF9cIjtmdW5jdGlvbiBMKGUsdCl7bGV0e21vZHVsZXM6b309ZTtyZXR1cm4gbz8hIW9bdF06ITF9ZnVuY3Rpb24gTyhlPUMoKSl7bGV0IHQ9YigpO3JldHVybmAke24uc2VjdXJlfHxsb2NhdGlvbi5wcm90b2NvbD09PVwiaHR0cHM6XCImJiEvbG9jYWxob3N0fDEyNy4wLjAuMXwwLjAuMC4wLy50ZXN0KHQpP1wid3NzXCI6XCJ3c1wifTovLyR7dH06JHtlfS9gfWZ1bmN0aW9uIEIoZSl7dHlwZW9mIGUubWVzc2FnZT09XCJzdHJpbmdcIiYmeChcIltwbGFzbW8vcGFyY2VsLXJ1bnRpbWVdOiBcIitlLm1lc3NhZ2UpfWZ1bmN0aW9uIFAoZSl7aWYodHlwZW9mIGdsb2JhbFRoaXMuV2ViU29ja2V0PlwidVwiKXJldHVybjtsZXQgdD1uZXcgV2ViU29ja2V0KE8oKSk7cmV0dXJuIHQuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIixhc3luYyBmdW5jdGlvbihvKXtsZXQgcj1KU09OLnBhcnNlKG8uZGF0YSk7aWYoci50eXBlPT09XCJ1cGRhdGVcIiYmYXdhaXQgZShyLmFzc2V0cyksci50eXBlPT09XCJlcnJvclwiKWZvcihsZXQgYSBvZiByLmRpYWdub3N0aWNzLmFuc2kpe2xldCB3PWEuY29kZWZyYW1lfHxhLnN0YWNrO20oXCJbcGxhc21vL3BhcmNlbC1ydW50aW1lXTogXCIrYS5tZXNzYWdlK2BcbmArdytgXG5cbmArYS5oaW50cy5qb2luKGBcbmApKX19KSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLEIpLHQuYWRkRXZlbnRMaXN0ZW5lcihcIm9wZW5cIiwoKT0+e3YoYFtwbGFzbW8vcGFyY2VsLXJ1bnRpbWVdOiBDb25uZWN0ZWQgdG8gSE1SIHNlcnZlciBmb3IgJHtuLmVudHJ5RmlsZVBhdGh9YCl9KSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJjbG9zZVwiLCgpPT57bShgW3BsYXNtby9wYXJjZWwtcnVudGltZV06IENvbm5lY3Rpb24gdG8gdGhlIEhNUiBzZXJ2ZXIgaXMgY2xvc2VkIGZvciAke24uZW50cnlGaWxlUGF0aH1gKX0pLHR9dmFyIHM9XCJfX3BsYXNtby1sb2FkaW5nX19cIjtmdW5jdGlvbiAkKCl7bGV0IGU9Z2xvYmFsVGhpcy53aW5kb3c/LnRydXN0ZWRUeXBlcztpZih0eXBlb2YgZT5cInVcIilyZXR1cm47bGV0IHQ9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwidHJ1c3RlZC10eXBlc1wiXScpPy5jb250ZW50Py5zcGxpdChcIiBcIiksbz10P3RbdD8ubGVuZ3RoLTFdLnJlcGxhY2UoLzsvZyxcIlwiKTp2b2lkIDA7cmV0dXJuIHR5cGVvZiBlPFwidVwiP2UuY3JlYXRlUG9saWN5KG98fGB0cnVzdGVkLWh0bWwtJHtzfWAse2NyZWF0ZUhUTUw6YT0+YX0pOnZvaWQgMH12YXIgVD0kKCk7ZnVuY3Rpb24gZygpe3JldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzKX1mdW5jdGlvbiBmKCl7cmV0dXJuIWcoKX1mdW5jdGlvbiBGKCl7bGV0IGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtlLmlkPXM7bGV0IHQ9YFxuICA8c3R5bGU+XG4gICAgIyR7c30ge1xuICAgICAgYmFja2dyb3VuZDogI2YzZjNmMztcbiAgICAgIGNvbG9yOiAjMzMzO1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgIzMzMztcbiAgICAgIGJveC1zaGFkb3c6ICMzMzMgNC43cHggNC43cHg7XG4gICAgfVxuXG4gICAgIyR7c306aG92ZXIge1xuICAgICAgYmFja2dyb3VuZDogI2UzZTNlMztcbiAgICAgIGNvbG9yOiAjNDQ0O1xuICAgIH1cblxuICAgIEBrZXlmcmFtZXMgcGxhc21vLWxvYWRpbmctYW5pbWF0ZS1zdmctZmlsbCB7XG4gICAgICAwJSB7XG4gICAgICAgIGZpbGw6IHRyYW5zcGFyZW50O1xuICAgICAgfVxuICAgIFxuICAgICAgMTAwJSB7XG4gICAgICAgIGZpbGw6ICMzMzM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgIyR7c30gLnN2Zy1lbGVtLTEge1xuICAgICAgYW5pbWF0aW9uOiBwbGFzbW8tbG9hZGluZy1hbmltYXRlLXN2Zy1maWxsIDEuNDdzIGN1YmljLWJlemllcigwLjQ3LCAwLCAwLjc0NSwgMC43MTUpIDAuOHMgYm90aCBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICAjJHtzfSAuc3ZnLWVsZW0tMiB7XG4gICAgICBhbmltYXRpb246IHBsYXNtby1sb2FkaW5nLWFuaW1hdGUtc3ZnLWZpbGwgMS40N3MgY3ViaWMtYmV6aWVyKDAuNDcsIDAsIDAuNzQ1LCAwLjcxNSkgMC45cyBib3RoIGluZmluaXRlO1xuICAgIH1cbiAgICBcbiAgICAjJHtzfSAuc3ZnLWVsZW0tMyB7XG4gICAgICBhbmltYXRpb246IHBsYXNtby1sb2FkaW5nLWFuaW1hdGUtc3ZnLWZpbGwgMS40N3MgY3ViaWMtYmV6aWVyKDAuNDcsIDAsIDAuNzQ1LCAwLjcxNSkgMXMgYm90aCBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICAjJHtzfSAuaGlkZGVuIHtcbiAgICAgIGRpc3BsYXk6IG5vbmU7XG4gICAgfVxuXG4gIDwvc3R5bGU+XG4gIFxuICA8c3ZnIGhlaWdodD1cIjMyXCIgd2lkdGg9XCIzMlwiIHZpZXdCb3g9XCIwIDAgMjY0IDM1NFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgIDxwYXRoIGQ9XCJNMTM5LjIyMSAyODIuMjQzQzE1NC4yNTIgMjgyLjI0MyAxNjYuOTAzIDI5NC44NDkgMTYxLjMzOCAzMDguODEyQzE1OS40ODkgMzEzLjQ1NCAxNTcuMTUgMzE3LjkxMyAxNTQuMzQ3IDMyMi4xMDlDMTQ2LjQ2NCAzMzMuOTA5IDEzNS4yNiAzNDMuMTA3IDEyMi4xNTEgMzQ4LjUzOEMxMDkuMDQzIDM1My45NjkgOTQuNjE4MiAzNTUuMzkgODAuNzAyMiAzNTIuNjIxQzY2Ljc4NjEgMzQ5Ljg1MiA1NC4wMDM0IDM0My4wMTggNDMuOTcwNSAzMzIuOTgzQzMzLjkzNzUgMzIyLjk0NyAyNy4xMDUgMzEwLjE2MiAyNC4zMzY5IDI5Ni4yNDJDMjEuNTY4OSAyODIuMzIzIDIyLjk4OTUgMjY3Ljg5NSAyOC40MTkzIDI1NC43ODNDMzMuODQ5MSAyNDEuNjcxIDQzLjA0NDEgMjMwLjQ2NCA1NC44NDE2IDIyMi41NzlDNTkuMDM1MyAyMTkuNzc3IDYzLjQ5MDggMjE3LjQzOCA2OC4xMjk1IDIxNS41ODhDODIuMDkxNSAyMTAuMDIxIDk0LjY5NzggMjIyLjY3MSA5NC42OTc4IDIzNy43MDNMOTQuNjk3OCAyNTUuMDI3Qzk0LjY5NzggMjcwLjA1OCAxMDYuODgzIDI4Mi4yNDMgMTIxLjkxNCAyODIuMjQzSDEzOS4yMjFaXCIgZmlsbD1cIiMzMzNcIiBjbGFzcz1cInN2Zy1lbGVtLTFcIiA+PC9wYXRoPlxuICAgIDxwYXRoIGQ9XCJNMTkyLjI2MSAxNDIuMDI4QzE5Mi4yNjEgMTI2Ljk5NiAyMDQuODY3IDExNC4zNDYgMjE4LjgyOSAxMTkuOTEzQzIyMy40NjggMTIxLjc2MyAyMjcuOTIzIDEyNC4xMDIgMjMyLjExNyAxMjYuOTA0QzI0My45MTUgMTM0Ljc4OSAyNTMuMTEgMTQ1Ljk5NiAyNTguNTM5IDE1OS4xMDhDMjYzLjk2OSAxNzIuMjIgMjY1LjM5IDE4Ni42NDggMjYyLjYyMiAyMDAuNTY3QzI1OS44NTQgMjE0LjQ4NyAyNTMuMDIxIDIyNy4yNzIgMjQyLjk4OCAyMzcuMzA4QzIzMi45NTUgMjQ3LjM0MyAyMjAuMTczIDI1NC4xNzcgMjA2LjI1NiAyNTYuOTQ2QzE5Mi4zNCAyNTkuNzE1IDE3Ny45MTYgMjU4LjI5NCAxNjQuODA3IDI1Mi44NjNDMTUxLjY5OSAyNDcuNDMyIDE0MC40OTUgMjM4LjIzNCAxMzIuNjEyIDIyNi40MzRDMTI5LjgwOCAyMjIuMjM4IDEyNy40NyAyMTcuNzc5IDEyNS42MiAyMTMuMTM3QzEyMC4wNTYgMTk5LjE3NCAxMzIuNzA3IDE4Ni41NjggMTQ3LjczOCAxODYuNTY4TDE2NS4wNDQgMTg2LjU2OEMxODAuMDc2IDE4Ni41NjggMTkyLjI2MSAxNzQuMzgzIDE5Mi4yNjEgMTU5LjM1MkwxOTIuMjYxIDE0Mi4wMjhaXCIgZmlsbD1cIiMzMzNcIiBjbGFzcz1cInN2Zy1lbGVtLTJcIiA+PC9wYXRoPlxuICAgIDxwYXRoIGQ9XCJNOTUuNjUyMiAxNjQuMTM1Qzk1LjY1MjIgMTc5LjE2NyA4My4yMjc5IDE5MS43MjUgNjguODAxMyAxODcuNTA1QzU5LjUxNDUgMTg0Ljc4OCA1MC42NDMyIDE4MC42NjMgNDIuNTEwNiAxNzUuMjI3QzI2Ljc4MDYgMTY0LjcxNCAxNC41MjA2IDE0OS43NzIgNy4yODA4OSAxMzIuMjg5QzAuMDQxMTgzIDExNC44MDcgLTEuODUzMDUgOTUuNTY5NyAxLjgzNzcyIDc3LjAxMDRDNS41Mjg0OSA1OC40NTExIDE0LjYzODUgNDEuNDAzMyAyOC4wMTU3IDI4LjAyMjhDNDEuMzkzIDE0LjY0MjMgNTguNDM2NiA1LjUzMDA2IDc2Ljk5MTQgMS44MzgzOUM5NS41NDYxIC0xLjg1MzI5IDExNC43NzkgMC4wNDE0MTYyIDEzMi4yNTcgNy4yODI5QzE0OS43MzUgMTQuNTI0NCAxNjQuNjc0IDI2Ljc4NzQgMTc1LjE4NCA0Mi41MjEyQzE4MC42MiA1MC42NTc2IDE4NC43NDQgNTkuNTMzMiAxODcuNDYgNjguODI0NUMxOTEuNjc4IDgzLjI1MTkgMTc5LjExOSA5NS42NzU5IDE2NC4wODggOTUuNjc1OUwxMjIuODY5IDk1LjY3NTlDMTA3LjgzNyA5NS42NzU5IDk1LjY1MjIgMTA3Ljg2MSA5NS42NTIyIDEyMi44OTJMOTUuNjUyMiAxNjQuMTM1WlwiIGZpbGw9XCIjMzMzXCIgY2xhc3M9XCJzdmctZWxlbS0zXCI+PC9wYXRoPlxuICA8L3N2Zz5cbiAgPHNwYW4gY2xhc3M9XCJoaWRkZW5cIj5Db250ZXh0IEludmFsaWRhdGVkLCBQcmVzcyB0byBSZWxvYWQ8L3NwYW4+XG4gIGA7cmV0dXJuIGUuaW5uZXJIVE1MPVQ/VC5jcmVhdGVIVE1MKHQpOnQsZS5zdHlsZS5wb2ludGVyRXZlbnRzPVwibm9uZVwiLGUuc3R5bGUucG9zaXRpb249XCJmaXhlZFwiLGUuc3R5bGUuYm90dG9tPVwiMTQuN3B4XCIsZS5zdHlsZS5yaWdodD1cIjE0LjdweFwiLGUuc3R5bGUuZm9udEZhbWlseT1cInNhbnMtc2VyaWZcIixlLnN0eWxlLmRpc3BsYXk9XCJmbGV4XCIsZS5zdHlsZS5qdXN0aWZ5Q29udGVudD1cImNlbnRlclwiLGUuc3R5bGUuYWxpZ25JdGVtcz1cImNlbnRlclwiLGUuc3R5bGUucGFkZGluZz1cIjE0LjdweFwiLGUuc3R5bGUuZ2FwPVwiMTQuN3B4XCIsZS5zdHlsZS5ib3JkZXJSYWRpdXM9XCI0LjdweFwiLGUuc3R5bGUuekluZGV4PVwiMjE0NzQ4MzY0N1wiLGUuc3R5bGUub3BhY2l0eT1cIjBcIixlLnN0eWxlLnRyYW5zaXRpb249XCJhbGwgMC40N3MgZWFzZS1pbi1vdXRcIixlfWZ1bmN0aW9uIE4oZSl7cmV0dXJuIG5ldyBQcm9taXNlKHQ9Pntkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ/KGYoKSYmKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChlKSx0KCkpLHQoKSk6Z2xvYmFsVGhpcy5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCgpPT57ZigpJiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXBwZW5kQ2hpbGQoZSksdCgpfSl9KX12YXIgaz0oKT0+e2xldCBlO2lmKGYoKSl7bGV0IHQ9RigpO2U9Tih0KX1yZXR1cm57c2hvdzphc3luYyh7cmVsb2FkQnV0dG9uOnQ9ITF9PXt9KT0+e2F3YWl0IGU7bGV0IG89ZygpO28uc3R5bGUub3BhY2l0eT1cIjFcIix0JiYoby5vbmNsaWNrPXI9PntyLnN0b3BQcm9wYWdhdGlvbigpLGdsb2JhbFRoaXMubG9jYXRpb24ucmVsb2FkKCl9LG8ucXVlcnlTZWxlY3RvcihcInNwYW5cIikuY2xhc3NMaXN0LnJlbW92ZShcImhpZGRlblwiKSxvLnN0eWxlLmN1cnNvcj1cInBvaW50ZXJcIixvLnN0eWxlLnBvaW50ZXJFdmVudHM9XCJhbGxcIil9LGhpZGU6YXN5bmMoKT0+e2F3YWl0IGU7bGV0IHQ9ZygpO3Quc3R5bGUub3BhY2l0eT1cIjBcIn19fTt2YXIgVz1gJHtFfSR7bW9kdWxlLmlkfV9fYCxpLEE9ITEsTT1rKCk7YXN5bmMgZnVuY3Rpb24gaCgpe2MoXCJTY3JpcHQgUnVudGltZSAtIHJlbG9hZGluZ1wiKSxBP2dsb2JhbFRoaXMubG9jYXRpb24/LnJlbG9hZD8uKCk6TS5zaG93KHtyZWxvYWRCdXR0b246ITB9KX1mdW5jdGlvbiBSKCl7aT8uZGlzY29ubmVjdCgpLGk9bD8ucnVudGltZS5jb25uZWN0KHtuYW1lOld9KSxpLm9uRGlzY29ubmVjdC5hZGRMaXN0ZW5lcigoKT0+e2goKX0pLGkub25NZXNzYWdlLmFkZExpc3RlbmVyKGU9PntlLl9fcGxhc21vX2NzX3JlbG9hZF9fJiZoKCksZS5fX3BsYXNtb19jc19hY3RpdmVfdGFiX18mJihBPSEwKX0pfWZ1bmN0aW9uIGooKXtpZihsPy5ydW50aW1lKXRyeXtSKCksc2V0SW50ZXJ2YWwoUiwyNGUzKX1jYXRjaHtyZXR1cm59fWooKTtQKGFzeW5jIGU9PntjKFwiU2NyaXB0IHJ1bnRpbWUgLSBvbiB1cGRhdGVkIGFzc2V0c1wiKSxlLmZpbHRlcihvPT5vLmVudkhhc2g9PT1uLmVudkhhc2gpLnNvbWUobz0+TChtb2R1bGUuYnVuZGxlLG8uaWQpKSYmKE0uc2hvdygpLGw/LnJ1bnRpbWU/aS5wb3N0TWVzc2FnZSh7X19wbGFzbW9fY3NfY2hhbmdlZF9fOiEwfSk6c2V0VGltZW91dCgoKT0+e2goKX0sNDcwMCkpfSk7XG4iLCIvKipcbiAqIFBsYXNtbyBDb250ZW50IFNjcmlwdCBFbnRyeSBQb2ludFxuICogVGhpcyBmaWxlIGlzIGF1dG9tYXRpY2FsbHkgZGV0ZWN0ZWQgYnkgUGxhc21vIGFuZCBpbmplY3RlZCBpbnRvIG1hdGNoaW5nIHBhZ2VzXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBQbGFzbW9DU0NvbmZpZyB9IGZyb20gXCJwbGFzbW9cIjtcblxuLy8gQ29uZmlndXJlIHdoaWNoIHNpdGVzIHRoaXMgY29udGVudCBzY3JpcHQgcnVucyBvblxuZXhwb3J0IGNvbnN0IGNvbmZpZzogUGxhc21vQ1NDb25maWcgPSB7XG4gIG1hdGNoZXM6IFtcbiAgICBcImh0dHBzOi8vY2hhdC5vcGVuYWkuY29tLypcIixcbiAgICBcImh0dHBzOi8vY2hhdGdwdC5jb20vKlwiLFxuICAgIFwiaHR0cHM6Ly9jbGF1ZGUuYWkvKlwiLFxuICAgIFwiaHR0cHM6Ly93d3cucGVycGxleGl0eS5haS8qXCJcbiAgXSxcbiAgYWxsX2ZyYW1lczogZmFsc2UsXG4gIHJ1bl9hdDogXCJkb2N1bWVudF9lbmRcIlxufTtcblxuLy8gRGlyZWN0IGltcGxlbWVudGF0aW9uIHVzaW5nIHBsYXRmb3JtIGFkYXB0ZXJzXG5pbXBvcnQgeyBjaGF0R1BUQWRhcHRlciB9IGZyb20gJy4uL2NvbnRlbnQvcGxhdGZvcm1zL2NoYXRncHQtYWRhcHRlcic7XG5pbXBvcnQgeyBjbGF1ZGVBZGFwdGVyIH0gZnJvbSAnLi4vY29udGVudC9wbGF0Zm9ybXMvY2xhdWRlLWFkYXB0ZXInO1xuaW1wb3J0IHsgc2VuZEluaXRSZXF1ZXN0LCBzZW5kU2F2ZU1lc3NhZ2UgfSBmcm9tICcuLi9saWIvbWVzc2FnZXMnO1xuXG4vKipcbiAqIFNpbXBsZSBpbml0aWFsaXphdGlvblxuICovXG4oYXN5bmMgKCkgPT4ge1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBQbGFzbW8gY29udGVudCBzY3JpcHQgc3RhcnRpbmcuLi4nKTtcblxuICAgIC8vIFdhaXQgZm9yIERPTVxuICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgcmVzb2x2ZSwgeyBvbmNlOiB0cnVlIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IHBsYXRmb3JtXG4gICAgY29uc3QgdXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIFVSTDonLCB1cmwpO1xuXG4gICAgaWYgKHVybC5pbmNsdWRlcygnY2hhdC5vcGVuYWkuY29tJykgfHwgdXJsLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpKSB7XG4gICAgICBjb25zb2xlLmxvZygnW0VuZ3JhbV0gQ2hhdEdQVCBkZXRlY3RlZCwgaW5pdGlhbGl6aW5nIGFkYXB0ZXIuLi4nKTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBiYWNrZ3JvdW5kIGNvbm5lY3Rpb25cbiAgICAgIGNvbnN0IGluaXRSZXNwb25zZSA9IGF3YWl0IHNlbmRJbml0UmVxdWVzdCgpO1xuICAgICAgaWYgKCFpbml0UmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbRW5ncmFtXSBCYWNrZ3JvdW5kIGluaXQgZmFpbGVkOicsIGluaXRSZXNwb25zZS5lcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIEJhY2tncm91bmQgY29ubmVjdGVkLCBkZXZpY2UgSUQ6JywgaW5pdFJlc3BvbnNlLmRldmljZUlkKTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhZGFwdGVyXG4gICAgICBhd2FpdCBjaGF0R1BUQWRhcHRlci5pbml0aWFsaXplKCk7XG4gICAgICBjb25zb2xlLmxvZygnW0VuZ3JhbV0gQWRhcHRlciBpbml0aWFsaXplZCcpO1xuXG4gICAgICAvLyBTdGFydCBvYnNlcnZpbmcgbWVzc2FnZXMgKG5vdyBhc3luYyB3aXRoIHJldHJpZXMpXG4gICAgICBhd2FpdCBjaGF0R1BUQWRhcHRlci5vYnNlcnZlTWVzc2FnZXMoYXN5bmMgKGV4dHJhY3RlZE1lc3NhZ2UpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIE1lc3NhZ2UgZXh0cmFjdGVkOicsIHtcbiAgICAgICAgICByb2xlOiBleHRyYWN0ZWRNZXNzYWdlLnJvbGUsXG4gICAgICAgICAgY29udGVudExlbmd0aDogZXh0cmFjdGVkTWVzc2FnZS5jb250ZW50Lmxlbmd0aCxcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogZXh0cmFjdGVkTWVzc2FnZS5jb252ZXJzYXRpb25JZFxuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHNhdmVSZXNwb25zZSA9IGF3YWl0IHNlbmRTYXZlTWVzc2FnZShleHRyYWN0ZWRNZXNzYWdlKTtcbiAgICAgICAgICBpZiAoc2F2ZVJlc3BvbnNlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBNZXNzYWdlIHNhdmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbRW5ncmFtXSBGYWlsZWQgdG8gc2F2ZSBtZXNzYWdlOicsIHNhdmVSZXNwb25zZS5lcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tFbmdyYW1dIEVycm9yIHNhdmluZyBtZXNzYWdlOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBSZWFkeSAtIG1vbml0b3JpbmcgQ2hhdEdQVCBtZXNzYWdlcycpO1xuICAgIH0gZWxzZSBpZiAodXJsLmluY2x1ZGVzKCdjbGF1ZGUuYWknKSkge1xuICAgICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIENsYXVkZSBkZXRlY3RlZCwgaW5pdGlhbGl6aW5nIGFkYXB0ZXIuLi4nKTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBiYWNrZ3JvdW5kIGNvbm5lY3Rpb25cbiAgICAgIGNvbnN0IGluaXRSZXNwb25zZSA9IGF3YWl0IHNlbmRJbml0UmVxdWVzdCgpO1xuICAgICAgaWYgKCFpbml0UmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbRW5ncmFtXSBCYWNrZ3JvdW5kIGluaXQgZmFpbGVkOicsIGluaXRSZXNwb25zZS5lcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIEJhY2tncm91bmQgY29ubmVjdGVkLCBkZXZpY2UgSUQ6JywgaW5pdFJlc3BvbnNlLmRldmljZUlkKTtcblxuICAgICAgLy8gSW5pdGlhbGl6ZSBhZGFwdGVyXG4gICAgICBhd2FpdCBjbGF1ZGVBZGFwdGVyLmluaXRpYWxpemUoKTtcbiAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBBZGFwdGVyIGluaXRpYWxpemVkJyk7XG5cbiAgICAgIC8vIFN0YXJ0IG9ic2VydmluZyBtZXNzYWdlc1xuICAgICAgYXdhaXQgY2xhdWRlQWRhcHRlci5vYnNlcnZlTWVzc2FnZXMoYXN5bmMgKGV4dHJhY3RlZE1lc3NhZ2UpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tFbmdyYW1dIE1lc3NhZ2UgZXh0cmFjdGVkOicsIHtcbiAgICAgICAgICByb2xlOiBleHRyYWN0ZWRNZXNzYWdlLnJvbGUsXG4gICAgICAgICAgY29udGVudExlbmd0aDogZXh0cmFjdGVkTWVzc2FnZS5jb250ZW50Lmxlbmd0aCxcbiAgICAgICAgICBjb252ZXJzYXRpb25JZDogZXh0cmFjdGVkTWVzc2FnZS5jb252ZXJzYXRpb25JZFxuICAgICAgICB9KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHNhdmVSZXNwb25zZSA9IGF3YWl0IHNlbmRTYXZlTWVzc2FnZShleHRyYWN0ZWRNZXNzYWdlKTtcbiAgICAgICAgICBpZiAoc2F2ZVJlc3BvbnNlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBNZXNzYWdlIHNhdmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbRW5ncmFtXSBGYWlsZWQgdG8gc2F2ZSBtZXNzYWdlOicsIHNhdmVSZXNwb25zZS5lcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tFbmdyYW1dIEVycm9yIHNhdmluZyBtZXNzYWdlOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBSZWFkeSAtIG1vbml0b3JpbmcgQ2xhdWRlIG1lc3NhZ2VzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbRW5ncmFtXSBQbGF0Zm9ybSBub3QgeWV0IHN1cHBvcnRlZDonLCB1cmwpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbRW5ncmFtXSBDb250ZW50IHNjcmlwdCBlcnJvcjonLCBlcnJvcik7XG4gIH1cbn0pKCk7XG4iLCIvKipcbiAqIENoYXRHUFQgUGxhdGZvcm0gQWRhcHRlclxuICogSW1wbGVtZW50cyBJUGxhdGZvcm1BZGFwdGVyIGZvciBDaGF0R1BUIChjaGF0Lm9wZW5haS5jb20pXG4gKiBcbiAqIERPTSBTdHJ1Y3R1cmUgKGFzIG9mIERlYyAyMDI0KTpcbiAqIC0gTWVzc2FnZXM6IGFydGljbGVbZGF0YS10ZXN0aWRePVwiY29udmVyc2F0aW9uLXR1cm5cIl1cbiAqIC0gVXNlciBtZXNzYWdlczogLnRleHQtbWVzc2FnZSAod2l0aCBkYXRhLW1lc3NhZ2UtYXV0aG9yLXJvbGU9XCJ1c2VyXCIpXG4gKiAtIEFzc2lzdGFudCBtZXNzYWdlczogLnRleHQtbWVzc2FnZSAod2l0aCBkYXRhLW1lc3NhZ2UtYXV0aG9yLXJvbGU9XCJhc3Npc3RhbnRcIilcbiAqIC0gQ29kZSBibG9ja3M6IHByZSA+IGNvZGUgd2l0aCAubGFuZ3VhZ2UtKiBjbGFzc2VzXG4gKiAtIENvbnZlcnNhdGlvbiBJRDogVVJMIHBhdHRlcm4gL2Mve2NvbnZlcnNhdGlvbi1pZH1cbiAqL1xuXG5pbXBvcnQge1xuICBJUGxhdGZvcm1BZGFwdGVyLFxuICBQbGF0Zm9ybUNvbmZpZyxcbiAgRXh0cmFjdGVkTWVzc2FnZSxcbiAgRXh0cmFjdGVkQ29kZUJsb2NrLFxuICBQbGF0Zm9ybVNlbGVjdG9ycyxcbiAgUGxhdGZvcm1GZWF0dXJlcyxcbn0gZnJvbSAnZW5ncmFtLXNoYXJlZC90eXBlcy9wbGF0Zm9ybS1hZGFwdGVyJztcbmltcG9ydCB7IFBsYXRmb3JtLCBSb2xlIH0gZnJvbSAnZW5ncmFtLXNoYXJlZC90eXBlcy9tZW1vcnknO1xuXG4vKipcbiAqIENoYXRHUFQgRE9NIHNlbGVjdG9yc1xuICogVXBkYXRlZCBmb3IgY3VycmVudCBDaGF0R1BUIFVJIChEZWMgMjAyNClcbiAqL1xuY29uc3QgU0VMRUNUT1JTOiBQbGF0Zm9ybVNlbGVjdG9ycyA9IHtcbiAgY29udGFpbmVyU2VsZWN0b3I6ICcjdGhyZWFkLCBtYWluID4gZGl2JywgLy8gVXBkYXRlZDogQ2hhdEdQVCBub3cgdXNlcyAjdGhyZWFkXG4gIG1lc3NhZ2VTZWxlY3RvcjogJ2FydGljbGVbZGF0YS10ZXN0aWRePVwiY29udmVyc2F0aW9uLXR1cm5cIl0nLFxuICBjb250ZW50U2VsZWN0b3I6ICdbZGF0YS1tZXNzYWdlLWF1dGhvci1yb2xlXSAubWFya2Rvd24nLFxuICBjb2RlQmxvY2tTZWxlY3RvcjogJ3ByZSBjb2RlJyxcbiAgaW5qZWN0aW9uUG9pbnRTZWxlY3RvcjogJ21haW4gYXNpZGUsIG1haW4gPiBkaXY6bGFzdC1jaGlsZCcsXG59O1xuXG4vKipcbiAqIENoYXRHUFQgZmVhdHVyZSBzdXBwb3J0XG4gKi9cbmNvbnN0IEZFQVRVUkVTOiBQbGF0Zm9ybUZlYXR1cmVzID0ge1xuICBzdXBwb3J0c1N0cmVhbWluZzogdHJ1ZSxcbiAgc3VwcG9ydHNDb2RlQmxvY2tzOiB0cnVlLFxuICBzdXBwb3J0c0F0dGFjaG1lbnRzOiB0cnVlLFxuICBzdXBwb3J0c1JlZ2VuZXJhdGlvbjogdHJ1ZSxcbn07XG5cbi8qKlxuICogQ2hhdEdQVCBQbGF0Zm9ybSBBZGFwdGVyIEltcGxlbWVudGF0aW9uXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGF0R1BUQWRhcHRlciBpbXBsZW1lbnRzIElQbGF0Zm9ybUFkYXB0ZXIge1xuICBwcml2YXRlIG9ic2VydmVyOiBNdXRhdGlvbk9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgb2JzZXJ2ZXJDYWxsYmFjazogKChtZXNzYWdlOiBFeHRyYWN0ZWRNZXNzYWdlKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGxhc3RQcm9jZXNzZWRNZXNzYWdlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gIC8qKlxuICAgKiBHZXQgcGxhdGZvcm0gY29uZmlndXJhdGlvblxuICAgKi9cbiAgZ2V0Q29uZmlnKCk6IFBsYXRmb3JtQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgcGxhdGZvcm1JZDogJ2NoYXRncHQnIGFzIFBsYXRmb3JtLFxuICAgICAgc2VsZWN0b3JzOiBTRUxFQ1RPUlMsXG4gICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2NoYXQoPzpncHQpP1xcLm9wZW5haVxcLmNvbS8sXG4gICAgICBjb252ZXJzYXRpb25JZEV4dHJhY3RvcjogdGhpcy5leHRyYWN0Q29udmVyc2F0aW9uSWRGcm9tVXJsLFxuICAgICAgZmVhdHVyZXM6IEZFQVRVUkVTLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgYWRhcHRlclxuICAgKi9cbiAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBDbGVhciBhbnkgcHJldmlvdXMgc3RhdGVcbiAgICB0aGlzLmxhc3RQcm9jZXNzZWRNZXNzYWdlcy5jbGVhcigpO1xuXG4gICAgLy8gV2FpdCBmb3IgcGFnZSB0byBiZSByZWFkeVxuICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgcmVzb2x2ZSwgeyBvbmNlOiB0cnVlIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENsZWFuIHVwIHJlc291cmNlc1xuICAgKi9cbiAgZGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3BPYnNlcnZpbmcoKTtcbiAgICB0aGlzLmxhc3RQcm9jZXNzZWRNZXNzYWdlcy5jbGVhcigpO1xuICAgIHRoaXMub2JzZXJ2ZXJDYWxsYmFjayA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgY3VycmVudCBVUkwgaXMgQ2hhdEdQVFxuICAgKi9cbiAgaXNDdXJyZW50UGxhdGZvcm0odXJsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDb25maWcoKS51cmxQYXR0ZXJuLnRlc3QodXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGNvbnZlcnNhdGlvbiBJRCBmcm9tIFVSTFxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0Q29udmVyc2F0aW9uSWRGcm9tVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgLy8gVVJMIHBhdHRlcm46IGh0dHBzOi8vY2hhdC5vcGVuYWkuY29tL2Mve2NvbnZlcnNhdGlvbi1pZH1cbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXFwvY1xcLyhbXFx3LV0rKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGNvbnZlcnNhdGlvbiBJRCBmcm9tIGN1cnJlbnQgcGFnZVxuICAgKi9cbiAgZXh0cmFjdENvbnZlcnNhdGlvbklkKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmV4dHJhY3RDb252ZXJzYXRpb25JZEZyb21Vcmwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgYSBzaW5nbGUgbWVzc2FnZSBmcm9tIERPTSBlbGVtZW50XG4gICAqL1xuICBleHRyYWN0TWVzc2FnZShlbGVtZW50OiBIVE1MRWxlbWVudCk6IEV4dHJhY3RlZE1lc3NhZ2UgfCBudWxsIHtcbiAgICB0cnkge1xuICAgICAgLy8gR2V0IHJvbGUgZnJvbSBkYXRhIGF0dHJpYnV0ZVxuICAgICAgY29uc3Qgcm9sZUF0dHIgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLW1lc3NhZ2UtYXV0aG9yLXJvbGVdJyk7XG4gICAgICBpZiAoIXJvbGVBdHRyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByb2xlVmFsdWUgPSByb2xlQXR0ci5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWVzc2FnZS1hdXRob3Itcm9sZScpO1xuICAgICAgaWYgKCFyb2xlVmFsdWUgfHwgKHJvbGVWYWx1ZSAhPT0gJ3VzZXInICYmIHJvbGVWYWx1ZSAhPT0gJ2Fzc2lzdGFudCcpKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByb2xlOiBSb2xlID0gcm9sZVZhbHVlIGFzIFJvbGU7XG5cbiAgICAgIC8vIEV4dHJhY3QgY29udGVudFxuICAgICAgY29uc3QgY29udGVudEVsZW1lbnQgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoU0VMRUNUT1JTLmNvbnRlbnRTZWxlY3Rvcik7XG4gICAgICBpZiAoIWNvbnRlbnRFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBsZXQgY29udGVudCA9IHRoaXMuZXh0cmFjdFRleHRDb250ZW50KGNvbnRlbnRFbGVtZW50IGFzIEhUTUxFbGVtZW50KTtcbiAgICAgIFxuICAgICAgLy8gRXh0cmFjdCBjb2RlIGJsb2Nrc1xuICAgICAgY29uc3QgY29kZUJsb2NrcyA9IHRoaXMuZXh0cmFjdENvZGVCbG9ja3MoZWxlbWVudCk7XG5cbiAgICAgIC8vIEdldCBjb252ZXJzYXRpb24gSURcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5leHRyYWN0Q29udmVyc2F0aW9uSWQoKTtcbiAgICAgIGlmICghY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIG1lc3NhZ2UgaXMgc3RpbGwgc3RyZWFtaW5nXG4gICAgICBjb25zdCBpc1N0cmVhbWluZyA9IHRoaXMuaXNNZXNzYWdlU3RyZWFtaW5nKGVsZW1lbnQpO1xuXG4gICAgICAvLyBHZXQgbWVzc2FnZSB0aW1lc3RhbXAgKHVzZSBjdXJyZW50IHRpbWUgYXMgQ2hhdEdQVCBkb2Vzbid0IGV4cG9zZSB0aW1lc3RhbXBzKVxuICAgICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgICAgLy8gR2V0IG1lc3NhZ2UgaW5kZXggZnJvbSBET00gcG9zaXRpb25cbiAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoU0VMRUNUT1JTLmNvbnRhaW5lclNlbGVjdG9yKTtcbiAgICAgIGNvbnN0IG1lc3NhZ2VzID0gY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yQWxsKFNFTEVDVE9SUy5tZXNzYWdlU2VsZWN0b3IpO1xuICAgICAgY29uc3QgbWVzc2FnZUluZGV4ID0gbWVzc2FnZXMgPyBBcnJheS5mcm9tKG1lc3NhZ2VzKS5pbmRleE9mKGVsZW1lbnQpIDogdW5kZWZpbmVkO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICByb2xlLFxuICAgICAgICBjb250ZW50LFxuICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgICBtZXRhZGF0YToge1xuICAgICAgICAgIGNvZGVCbG9ja3M6IGNvZGVCbG9ja3MubGVuZ3RoID4gMCA/IGNvZGVCbG9ja3MgOiB1bmRlZmluZWQsXG4gICAgICAgICAgaXNTdHJlYW1pbmcsXG4gICAgICAgICAgbWVzc2FnZUluZGV4LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignQ2hhdEdQVCBhZGFwdGVyOiBFcnJvciBleHRyYWN0aW5nIG1lc3NhZ2U6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgdGV4dCBjb250ZW50IGZyb20gZWxlbWVudCwgaGFuZGxpbmcgbWFya2Rvd25cbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFRleHRDb250ZW50KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgICAvLyBDbG9uZSB0byBhdm9pZCBtb2RpZnlpbmcgRE9NXG4gICAgY29uc3QgY2xvbmUgPSBlbGVtZW50LmNsb25lTm9kZSh0cnVlKSBhcyBIVE1MRWxlbWVudDtcblxuICAgIC8vIFJlbW92ZSBjb2RlIGJsb2NrcyAod2UgaGFuZGxlIHRoZW0gc2VwYXJhdGVseSlcbiAgICBjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCdwcmUnKS5mb3JFYWNoKHByZSA9PiBwcmUucmVtb3ZlKCkpO1xuXG4gICAgLy8gR2V0IHRleHQgY29udGVudFxuICAgIGxldCB0ZXh0ID0gY2xvbmUudGV4dENvbnRlbnQgfHwgJyc7XG5cbiAgICAvLyBDbGVhbiB1cCB3aGl0ZXNwYWNlXG4gICAgdGV4dCA9IHRleHRcbiAgICAgIC5zcGxpdCgnXFxuJykgLy8gU3BsaXQgaW50byBsaW5lc1xuICAgICAgLm1hcChsaW5lID0+IGxpbmUudHJpbSgpKSAvLyBUcmltIGVhY2ggbGluZVxuICAgICAgLmpvaW4oJ1xcbicpIC8vIFJlam9pblxuICAgICAgLnJlcGxhY2UoL1xcbnszLH0vZywgJ1xcblxcbicpIC8vIE1heCAyIGNvbnNlY3V0aXZlIG5ld2xpbmVzXG4gICAgICAudHJpbSgpO1xuXG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICAvKipcbiAgICogRXh0cmFjdCBjb2RlIGJsb2NrcyBmcm9tIG1lc3NhZ2VcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdENvZGVCbG9ja3MoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBFeHRyYWN0ZWRDb2RlQmxvY2tbXSB7XG4gICAgY29uc3QgYmxvY2tzOiBFeHRyYWN0ZWRDb2RlQmxvY2tbXSA9IFtdO1xuICAgIGNvbnN0IGNvZGVFbGVtZW50cyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChTRUxFQ1RPUlMuY29kZUJsb2NrU2VsZWN0b3IhKTtcblxuICAgIGNvZGVFbGVtZW50cy5mb3JFYWNoKGNvZGVFbCA9PiB7XG4gICAgICBjb25zdCBjb2RlID0gY29kZUVsLnRleHRDb250ZW50IHx8ICcnO1xuICAgICAgXG4gICAgICAvLyBFeHRyYWN0IGxhbmd1YWdlIGZyb20gY2xhc3MgKGUuZy4sIFwibGFuZ3VhZ2UtcHl0aG9uXCIpXG4gICAgICBsZXQgbGFuZ3VhZ2UgPSAncGxhaW50ZXh0JztcbiAgICAgIGNvbnN0IGNsYXNzZXMgPSAoY29kZUVsIGFzIEhUTUxFbGVtZW50KS5jbGFzc05hbWU7XG4gICAgICBjb25zdCBsYW5nTWF0Y2ggPSBjbGFzc2VzLm1hdGNoKC9sYW5ndWFnZS0oXFx3KykvKTtcbiAgICAgIGlmIChsYW5nTWF0Y2gpIHtcbiAgICAgICAgbGFuZ3VhZ2UgPSBsYW5nTWF0Y2hbMV07XG4gICAgICB9XG5cbiAgICAgIGJsb2Nrcy5wdXNoKHsgbGFuZ3VhZ2UsIGNvZGU6IGNvZGUudHJpbSgpIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGJsb2NrcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBtZXNzYWdlIGlzIGN1cnJlbnRseSBzdHJlYW1pbmcgKGJlaW5nIHdyaXR0ZW4pXG4gICAqL1xuICBwcml2YXRlIGlzTWVzc2FnZVN0cmVhbWluZyhlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICAgIC8vIENoYXRHUFQgc2hvd3MgYSBibGlua2luZyBjdXJzb3Igb3IgXCJzdG9wIGdlbmVyYXRpbmdcIiBidXR0b24gZHVyaW5nIHN0cmVhbWluZ1xuICAgIGNvbnN0IHBhcmVudCA9IGVsZW1lbnQuY2xvc2VzdCgnW2RhdGEtdGVzdGlkXj1cImNvbnZlcnNhdGlvbi10dXJuXCJdJyk7XG4gICAgaWYgKCFwYXJlbnQpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIExvb2sgZm9yIHN0cmVhbWluZyBpbmRpY2F0b3JzXG4gICAgY29uc3QgaGFzU3RvcEJ1dHRvbiA9ICEhZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uW2FyaWEtbGFiZWwqPVwiU3RvcFwiXScpO1xuICAgIGNvbnN0IGhhc0N1cnNvciA9ICEhcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jdXJzb3ItYmxpbmssIFtjbGFzcyo9XCJjdXJzb3JcIl0nKTtcbiAgICBcbiAgICByZXR1cm4gaGFzU3RvcEJ1dHRvbiB8fCBoYXNDdXJzb3I7XG4gIH1cblxuICAvKipcbiAgICogV2FpdCBmb3IgY29udGFpbmVyIHRvIGFwcGVhciBpbiBET01cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgd2FpdEZvckNvbnRhaW5lcihtYXhBdHRlbXB0cyA9IDEwLCBkZWxheU1zID0gNTAwKTogUHJvbWlzZTxFbGVtZW50IHwgbnVsbD4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4QXR0ZW1wdHM7IGkrKykge1xuICAgICAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihTRUxFQ1RPUlMuY29udGFpbmVyU2VsZWN0b3IpO1xuICAgICAgaWYgKGNvbnRhaW5lcikge1xuICAgICAgICBjb25zb2xlLmxvZyhgQ2hhdEdQVCBhZGFwdGVyOiBDb250YWluZXIgZm91bmQgb24gYXR0ZW1wdCAke2kgKyAxfWApO1xuICAgICAgICByZXR1cm4gY29udGFpbmVyO1xuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZyhgQ2hhdEdQVCBhZGFwdGVyOiBXYWl0aW5nIGZvciBjb250YWluZXIgKGF0dGVtcHQgJHtpICsgMX0vJHttYXhBdHRlbXB0c30pLi4uYCk7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgZGVsYXlNcykpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IG9ic2VydmluZyBtZXNzYWdlc1xuICAgKi9cbiAgYXN5bmMgb2JzZXJ2ZU1lc3NhZ2VzKGNhbGxiYWNrOiAobWVzc2FnZTogRXh0cmFjdGVkTWVzc2FnZSkgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMub2JzZXJ2ZXJDYWxsYmFjayA9IGNhbGxiYWNrO1xuXG4gICAgLy8gV2FpdCBmb3IgY29udGFpbmVyIHdpdGggcmV0cmllc1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGF3YWl0IHRoaXMud2FpdEZvckNvbnRhaW5lcigpO1xuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdDaGF0R1BUIGFkYXB0ZXI6IE1lc3NhZ2UgY29udGFpbmVyIG5vdCBmb3VuZCBhZnRlciByZXRyaWVzJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCdDaGF0R1BUIGFkYXB0ZXI6IExvb2tpbmcgZm9yIHNlbGVjdG9yOicsIFNFTEVDVE9SUy5jb250YWluZXJTZWxlY3Rvcik7XG4gICAgICBjb25zb2xlLmVycm9yKCdDaGF0R1BUIGFkYXB0ZXI6IEF2YWlsYWJsZSBtYWluIGVsZW1lbnRzOicsIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ21haW4gPiAqJykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdDaGF0R1BUIGFkYXB0ZXI6IFN0YXJ0aW5nIHRvIG9ic2VydmUgbWVzc2FnZXMnKTtcblxuICAgIC8vIFByb2Nlc3MgZXhpc3RpbmcgbWVzc2FnZXNcbiAgICB0aGlzLnByb2Nlc3NFeGlzdGluZ01lc3NhZ2VzKCk7XG5cbiAgICAvLyBTZXQgdXAgbXV0YXRpb24gb2JzZXJ2ZXIgZm9yIG5ldyBtZXNzYWdlc1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICB0aGlzLmhhbmRsZU11dGF0aW9ucyhtdXRhdGlvbnMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKGNvbnRhaW5lciwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgIGNoYXJhY3RlckRhdGE6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RvcCBvYnNlcnZpbmcgbWVzc2FnZXNcbiAgICovXG4gIHN0b3BPYnNlcnZpbmcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMub2JzZXJ2ZXIpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgdGhpcy5vYnNlcnZlciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgZXhpc3RpbmcgbWVzc2FnZXMgb24gcGFnZVxuICAgKi9cbiAgcHJpdmF0ZSBwcm9jZXNzRXhpc3RpbmdNZXNzYWdlcygpOiB2b2lkIHtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFNFTEVDVE9SUy5jb250YWluZXJTZWxlY3Rvcik7XG4gICAgaWYgKCFjb250YWluZXIpIHJldHVybjtcblxuICAgIGNvbnN0IG1lc3NhZ2VzID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoU0VMRUNUT1JTLm1lc3NhZ2VTZWxlY3Rvcik7XG4gICAgbWVzc2FnZXMuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgdGhpcy5wcm9jZXNzTWVzc2FnZShtc2cgYXMgSFRNTEVsZW1lbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBET00gbXV0YXRpb25zXG4gICAqL1xuICBwcml2YXRlIGhhbmRsZU11dGF0aW9ucyhtdXRhdGlvbnM6IE11dGF0aW9uUmVjb3JkW10pOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IG11dGF0aW9uIG9mIG11dGF0aW9ucykge1xuICAgICAgLy8gQ2hlY2sgZm9yIG5ldyBtZXNzYWdlIGVsZW1lbnRzXG4gICAgICBpZiAobXV0YXRpb24udHlwZSA9PT0gJ2NoaWxkTGlzdCcpIHtcbiAgICAgICAgbXV0YXRpb24uYWRkZWROb2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IG5vZGUgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIGl0J3MgYSBtZXNzYWdlIG9yIGNvbnRhaW5zIG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5tYXRjaGVzKFNFTEVDVE9SUy5tZXNzYWdlU2VsZWN0b3IpKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJvY2Vzc01lc3NhZ2UoZWxlbWVudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChTRUxFQ1RPUlMubWVzc2FnZVNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgbWVzc2FnZXMuZm9yRWFjaChtc2cgPT4gdGhpcy5wcm9jZXNzTWVzc2FnZShtc2cgYXMgSFRNTEVsZW1lbnQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgc3RyZWFtaW5nIHVwZGF0ZXMgKGNoYXJhY3RlckRhdGEgY2hhbmdlcylcbiAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hhcmFjdGVyRGF0YScpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IChtdXRhdGlvbi50YXJnZXQgYXMgTm9kZSkucGFyZW50RWxlbWVudDtcbiAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZWxlbWVudC5jbG9zZXN0KFNFTEVDVE9SUy5tZXNzYWdlU2VsZWN0b3IpO1xuICAgICAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NNZXNzYWdlKG1lc3NhZ2UgYXMgSFRNTEVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGEgc2luZ2xlIG1lc3NhZ2UgZWxlbWVudFxuICAgKi9cbiAgcHJpdmF0ZSBwcm9jZXNzTWVzc2FnZShlbGVtZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5vYnNlcnZlckNhbGxiYWNrKSByZXR1cm47XG5cbiAgICAvLyBDcmVhdGUgdW5pcXVlIElEIGZvciBtZXNzYWdlICh1c2UgRE9NIHBvc2l0aW9uIGFzIENoYXRHUFQgZG9lc24ndCBoYXZlIElEcylcbiAgICBjb25zdCBtZXNzYWdlSWQgPSB0aGlzLmdldE1lc3NhZ2VJZChlbGVtZW50KTtcblxuICAgIC8vIFNraXAgaWYgYWxyZWFkeSBwcm9jZXNzZWQgYW5kIG5vdCBzdHJlYW1pbmdcbiAgICBpZiAodGhpcy5sYXN0UHJvY2Vzc2VkTWVzc2FnZXMuaGFzKG1lc3NhZ2VJZCkgJiYgIXRoaXMuaXNNZXNzYWdlU3RyZWFtaW5nKGVsZW1lbnQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZXh0cmFjdGVkID0gdGhpcy5leHRyYWN0TWVzc2FnZShlbGVtZW50KTtcbiAgICBpZiAoZXh0cmFjdGVkKSB7XG4gICAgICB0aGlzLmxhc3RQcm9jZXNzZWRNZXNzYWdlcy5hZGQobWVzc2FnZUlkKTtcbiAgICAgIHRoaXMub2JzZXJ2ZXJDYWxsYmFjayhleHRyYWN0ZWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSB1bmlxdWUgSUQgZm9yIG1lc3NhZ2UgZWxlbWVudFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRNZXNzYWdlSWQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoU0VMRUNUT1JTLmNvbnRhaW5lclNlbGVjdG9yKTtcbiAgICBjb25zdCBtZXNzYWdlcyA9IGNvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbChTRUxFQ1RPUlMubWVzc2FnZVNlbGVjdG9yKTtcbiAgICBjb25zdCBpbmRleCA9IG1lc3NhZ2VzID8gQXJyYXkuZnJvbShtZXNzYWdlcykuaW5kZXhPZihlbGVtZW50KSA6IC0xO1xuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5leHRyYWN0Q29udmVyc2F0aW9uSWQoKSB8fCAndW5rbm93bic7XG4gICAgcmV0dXJuIGAke2NvbnZlcnNhdGlvbklkfS0ke2luZGV4fWA7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGluamVjdGlvbiBwb2ludCBmb3IgbWVtb3J5IFVJXG4gICAqL1xuICBnZXRJbmplY3Rpb25Qb2ludCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIC8vIFRyeSBzaWRlYmFyIGZpcnN0XG4gICAgbGV0IGluamVjdGlvblBvaW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWFpbiBhc2lkZScpIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIC8vIEZhbGxiYWNrIHRvIG1haW4gY29udGFpbmVyXG4gICAgaWYgKCFpbmplY3Rpb25Qb2ludCkge1xuICAgICAgaW5qZWN0aW9uUG9pbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluID4gZGl2Omxhc3QtY2hpbGQnKSBhcyBIVE1MRWxlbWVudDtcbiAgICB9XG5cbiAgICByZXR1cm4gaW5qZWN0aW9uUG9pbnQ7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgbWVtb3J5IFVJIHNob3VsZCBiZSBzaG93blxuICAgKi9cbiAgc2hvdWxkU2hvd01lbW9yeVVJKCk6IGJvb2xlYW4ge1xuICAgIC8vIFNob3cgVUkgaWYgd2UgaGF2ZSBhIHZhbGlkIGNvbnZlcnNhdGlvblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbklkID0gdGhpcy5leHRyYWN0Q29udmVyc2F0aW9uSWQoKTtcbiAgICBcbiAgICAvLyBPbmx5IHNob3cgaW4gY29udmVyc2F0aW9uIHZpZXcsIG5vdCBvbiBob21lIHBhZ2VcbiAgICByZXR1cm4gY29udmVyc2F0aW9uSWQgIT09IG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBFeHBvcnQgc2luZ2xldG9uIGluc3RhbmNlXG4gKi9cbmV4cG9ydCBjb25zdCBjaGF0R1BUQWRhcHRlciA9IG5ldyBDaGF0R1BUQWRhcHRlcigpO1xuIiwiZXhwb3J0cy5pbnRlcm9wRGVmYXVsdCA9IGZ1bmN0aW9uIChhKSB7XG4gIHJldHVybiBhICYmIGEuX19lc01vZHVsZSA/IGEgOiB7ZGVmYXVsdDogYX07XG59O1xuXG5leHBvcnRzLmRlZmluZUludGVyb3BGbGFnID0gZnVuY3Rpb24gKGEpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGEsICdfX2VzTW9kdWxlJywge3ZhbHVlOiB0cnVlfSk7XG59O1xuXG5leHBvcnRzLmV4cG9ydEFsbCA9IGZ1bmN0aW9uIChzb3VyY2UsIGRlc3QpIHtcbiAgT2JqZWN0LmtleXMoc291cmNlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoa2V5ID09PSAnZGVmYXVsdCcgfHwga2V5ID09PSAnX19lc01vZHVsZScgfHwgZGVzdC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRlc3QsIGtleSwge1xuICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc291cmNlW2tleV07XG4gICAgICB9LFxuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gZGVzdDtcbn07XG5cbmV4cG9ydHMuZXhwb3J0ID0gZnVuY3Rpb24gKGRlc3QsIGRlc3ROYW1lLCBnZXQpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGRlc3QsIGRlc3ROYW1lLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBnZXQ6IGdldCxcbiAgfSk7XG59O1xuIiwiLyoqXG4gKiBDbGF1ZGUgUGxhdGZvcm0gQWRhcHRlclxuICogSGFuZGxlcyBtZXNzYWdlIGV4dHJhY3Rpb24gYW5kIG9ic2VydmF0aW9uIGZvciBDbGF1ZGUgQUkgKGNsYXVkZS5haSlcbiAqL1xuXG5pbXBvcnQge1xuICBJUGxhdGZvcm1BZGFwdGVyLFxuICBQbGF0Zm9ybUNvbmZpZyxcbiAgRXh0cmFjdGVkTWVzc2FnZSxcbiAgRXh0cmFjdGVkQ29kZUJsb2NrLFxuICBQbGF0Zm9ybVNlbGVjdG9ycyxcbiAgUGxhdGZvcm1GZWF0dXJlcyxcbn0gZnJvbSAnZW5ncmFtLXNoYXJlZC90eXBlcy9wbGF0Zm9ybS1hZGFwdGVyJztcbmltcG9ydCB7IFBsYXRmb3JtLCBSb2xlIH0gZnJvbSAnZW5ncmFtLXNoYXJlZC90eXBlcy9tZW1vcnknO1xuXG4vKipcbiAqIENsYXVkZSBET00gc2VsZWN0b3JzICh2ZXJpZmllZCBEZWMgMjAyNClcbiAqL1xuY29uc3QgU0VMRUNUT1JTOiBQbGF0Zm9ybVNlbGVjdG9ycyA9IHtcbiAgY29udGFpbmVyU2VsZWN0b3I6ICdib2R5JyxcbiAgbWVzc2FnZVNlbGVjdG9yOiAnW2RhdGEtdGVzdC1yZW5kZXItY291bnRdJyxcbiAgY29udGVudFNlbGVjdG9yOiAnLmZvbnQtdXNlci1tZXNzYWdlLCAuZm9udC1jbGF1ZGUtcmVzcG9uc2UnLFxuICBjb2RlQmxvY2tTZWxlY3RvcjogJ3ByZSBjb2RlJyxcbiAgaW5qZWN0aW9uUG9pbnRTZWxlY3RvcjogJ2FzaWRlJyxcbn07XG5cbi8qKlxuICogQ2xhdWRlIGZlYXR1cmUgc3VwcG9ydFxuICovXG5jb25zdCBGRUFUVVJFUzogUGxhdGZvcm1GZWF0dXJlcyA9IHtcbiAgc3VwcG9ydHNTdHJlYW1pbmc6IHRydWUsXG4gIHN1cHBvcnRzQ29kZUJsb2NrczogdHJ1ZSxcbiAgc3VwcG9ydHNBdHRhY2htZW50czogdHJ1ZSxcbiAgc3VwcG9ydHNSZWdlbmVyYXRpb246IHRydWUsXG59O1xuXG4vKipcbiAqIENsYXVkZSBQbGF0Zm9ybSBBZGFwdGVyIEltcGxlbWVudGF0aW9uXG4gKi9cbmNsYXNzIENsYXVkZUFkYXB0ZXIgaW1wbGVtZW50cyBJUGxhdGZvcm1BZGFwdGVyIHtcbiAgcHJpdmF0ZSBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG1lc3NhZ2VDYWxsYmFjazogKChtZXNzYWdlOiBFeHRyYWN0ZWRNZXNzYWdlKSA9PiB2b2lkKSB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHByb2Nlc3NlZE1lc3NhZ2VzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cbiAgLyoqXG4gICAqIEdldCBwbGF0Zm9ybSBjb25maWd1cmF0aW9uXG4gICAqL1xuICBnZXRDb25maWcoKTogUGxhdGZvcm1Db25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBwbGF0Zm9ybUlkOiAnY2xhdWRlJyBhcyBQbGF0Zm9ybSxcbiAgICAgIHNlbGVjdG9yczogU0VMRUNUT1JTLFxuICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9jbGF1ZGVcXC5haS8sXG4gICAgICBjb252ZXJzYXRpb25JZEV4dHJhY3RvcjogKHVybDogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9cXC9jaGF0XFwvKFthLWYwLTktXSspLyk7XG4gICAgICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgICAgIH0sXG4gICAgICBmZWF0dXJlczogRkVBVFVSRVMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBjdXJyZW50IFVSTCBpcyBDbGF1ZGVcbiAgICovXG4gIGlzQ3VycmVudFBsYXRmb3JtKHVybDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29uZmlnKCkudXJsUGF0dGVybi50ZXN0KHVybCk7XG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgYWRhcHRlclxuICAgKi9cbiAgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZygnW0NsYXVkZSBBZGFwdGVyXSBJbml0aWFsaXppbmcuLi4nKTtcbiAgICB0aGlzLnByb2Nlc3NlZE1lc3NhZ2VzLmNsZWFyKCk7XG4gICAgY29uc29sZS5sb2coJ1tDbGF1ZGUgQWRhcHRlcl0gUmVhZHknKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGNvbnZlcnNhdGlvbiBJRCBmcm9tIFVSTFxuICAgKiBDbGF1ZGUgZm9ybWF0OiBodHRwczovL2NsYXVkZS5haS9jaGF0L3tjb252ZXJzYXRpb24taWR9XG4gICAqL1xuICBleHRyYWN0Q29udmVyc2F0aW9uSWQoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUubWF0Y2goL1xcL2NoYXRcXC8oW2EtZjAtOS1dKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGluamVjdGlvbiBwb2ludCBmb3IgVUlcbiAgICogQ2xhdWRlIGhhcyBhIHNpZGViYXIgdGhhdCBjb3VsZCBiZSB1c2VkXG4gICAqL1xuICBnZXRJbmplY3Rpb25Qb2ludCgpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAgIC8vIFRyeSB0byBmaW5kIHNpZGViYXIgb3Igc3VpdGFibGUgY29udGFpbmVyXG4gICAgLy8gVGhpcyBpcyBhIHBsYWNlaG9sZGVyIC0gYWN0dWFsIHNlbGVjdG9yIGRlcGVuZHMgb24gQ2xhdWRlJ3MgRE9NIHN0cnVjdHVyZVxuICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhc2lkZScpIHx8IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgb2JzZXJ2aW5nIG1lc3NhZ2VzXG4gICAqL1xuICBvYnNlcnZlTWVzc2FnZXMoY2FsbGJhY2s6IChtZXNzYWdlOiBFeHRyYWN0ZWRNZXNzYWdlKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5tZXNzYWdlQ2FsbGJhY2sgPSBjYWxsYmFjaztcblxuICAgIGNvbnNvbGUubG9nKCdbQ2xhdWRlIEFkYXB0ZXJdIFN0YXJ0aW5nIG1lc3NhZ2Ugb2JzZXJ2YXRpb24uLi4nKTtcblxuICAgIC8vIFByb2Nlc3MgZXhpc3RpbmcgbWVzc2FnZXMgZmlyc3RcbiAgICB0aGlzLnByb2Nlc3NFeGlzdGluZ01lc3NhZ2VzKCk7XG5cbiAgICAvLyBXYXRjaCBmb3IgbmV3IG1lc3NhZ2VzXG4gICAgdGhpcy5zdGFydE11dGF0aW9uT2JzZXJ2ZXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIGV4aXN0aW5nIG1lc3NhZ2VzIG9uIHBhZ2VcbiAgICovXG4gIHByaXZhdGUgcHJvY2Vzc0V4aXN0aW5nTWVzc2FnZXMoKTogdm9pZCB7XG4gICAgY29uc3QgbWVzc2FnZUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdGVzdC1yZW5kZXItY291bnRdJyk7XG5cbiAgICBjb25zb2xlLmxvZyhgW0NsYXVkZSBBZGFwdGVyXSBGb3VuZCAke21lc3NhZ2VFbGVtZW50cy5sZW5ndGh9IGV4aXN0aW5nIG1lc3NhZ2VzYCk7XG5cbiAgICBtZXNzYWdlRWxlbWVudHMuZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgIHRoaXMucHJvY2Vzc01lc3NhZ2UoZWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3RhcnQgbXV0YXRpb24gb2JzZXJ2ZXIgZm9yIG5ldyBtZXNzYWdlc1xuICAgKi9cbiAgcHJpdmF0ZSBzdGFydE11dGF0aW9uT2JzZXJ2ZXIoKTogdm9pZCB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcbiAgICAgIGZvciAoY29uc3QgbXV0YXRpb24gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICAgIG11dGF0aW9uLmFkZGVkTm9kZXMuZm9yRWFjaCgobm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBub2RlIGFzIEhUTUxFbGVtZW50O1xuXG4gICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBtZXNzYWdlIGVsZW1lbnRcbiAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuaGFzQXR0cmlidXRlICYmIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdkYXRhLXRlc3QtcmVuZGVyLWNvdW50JykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NNZXNzYWdlKGVsZW1lbnQpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCkge1xuICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIGVsZW1lbnQgY29udGFpbnMgbWVzc2FnZXNcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdGVzdC1yZW5kZXItY291bnRdJyk7XG4gICAgICAgICAgICAgICAgbWVzc2FnZXMuZm9yRWFjaChtc2cgPT4gdGhpcy5wcm9jZXNzTWVzc2FnZShtc2cgYXMgSFRNTEVsZW1lbnQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIHN0cmVhbWluZyB1cGRhdGVzICh0ZXh0IGNoYW5nZXMpXG4gICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hhcmFjdGVyRGF0YScpIHtcbiAgICAgICAgICBjb25zdCBlbGVtZW50ID0gKG11dGF0aW9uLnRhcmdldCBhcyBOb2RlKS5wYXJlbnRFbGVtZW50O1xuICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gZWxlbWVudC5jbG9zZXN0KCdbZGF0YS10ZXN0LXJlbmRlci1jb3VudF0nKTtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJvY2Vzc01lc3NhZ2UobWVzc2FnZSBhcyBIVE1MRWxlbWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBPYnNlcnZlIHRoZSBib2R5IGZvciBuZXcgbWVzc2FnZXNcbiAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgIGNoYXJhY3RlckRhdGE6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLmxvZygnW0NsYXVkZSBBZGFwdGVyXSBNdXRhdGlvbiBvYnNlcnZlciBzdGFydGVkJyk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBhIHNpbmdsZSBtZXNzYWdlIGVsZW1lbnRcbiAgICovXG4gIHByaXZhdGUgcHJvY2Vzc01lc3NhZ2UoZWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMubWVzc2FnZUNhbGxiYWNrKSByZXR1cm47XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZXh0cmFjdE1lc3NhZ2VGcm9tRWxlbWVudChlbGVtZW50KTtcbiAgICAgIGlmIChtZXNzYWdlICYmIG1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICAvLyBVc2UgY29udGVudC1iYXNlZCBkZWR1cGxpY2F0aW9uIChzaW1pbGFyIHRvIENoYXRHUFQgYWRhcHRlcilcbiAgICAgICAgLy8gVGhpcyBhY2NlcHRzIHN0cmVhbWluZyBzcGFtIGZvciBNVlBcbiAgICAgICAgaWYgKCF0aGlzLnByb2Nlc3NlZE1lc3NhZ2VzLmhhcyhtZXNzYWdlLmNvbnRlbnQpKSB7XG4gICAgICAgICAgdGhpcy5wcm9jZXNzZWRNZXNzYWdlcy5hZGQobWVzc2FnZS5jb250ZW50KTtcbiAgICAgICAgICB0aGlzLm1lc3NhZ2VDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbQ2xhdWRlIEFkYXB0ZXJdIEVycm9yIHByb2Nlc3NpbmcgbWVzc2FnZTonLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgbWVzc2FnZSBkYXRhIGZyb20gRE9NIGVsZW1lbnRcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdE1lc3NhZ2VGcm9tRWxlbWVudChcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudCxcbiAgICBpbmRleD86IG51bWJlclxuICApOiBFeHRyYWN0ZWRNZXNzYWdlIHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIERldGVybWluZSByb2xlIHVzaW5nIENsYXVkZSdzIGFjdHVhbCBjbGFzc2VzXG4gICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcignLmZvbnQtdXNlci1tZXNzYWdlJyk7XG4gICAgICBjb25zdCBhc3Npc3RhbnRNZXNzYWdlID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuZm9udC1jbGF1ZGUtcmVzcG9uc2UnKTtcblxuICAgICAgaWYgKCF1c2VyTWVzc2FnZSAmJiAhYXNzaXN0YW50TWVzc2FnZSkge1xuICAgICAgICByZXR1cm4gbnVsbDsgLy8gTm90IGEgbWVzc2FnZSBlbGVtZW50XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJvbGU6IFJvbGUgPSB1c2VyTWVzc2FnZSA/ICd1c2VyJyA6ICdhc3Npc3RhbnQnO1xuICAgICAgY29uc3QgY29udGVudEVsZW1lbnQgPSAodXNlck1lc3NhZ2UgfHwgYXNzaXN0YW50TWVzc2FnZSkgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICAgIC8vIEV4dHJhY3QgdGV4dCBjb250ZW50XG4gICAgICBjb25zdCByYXdUZXh0ID0gY29udGVudEVsZW1lbnQudGV4dENvbnRlbnQgfHwgJyc7XG5cbiAgICAgIC8vIEV4dHJhY3QgY29kZSBibG9ja3NcbiAgICAgIGNvbnN0IGNvZGVCbG9ja3MgPSB0aGlzLmV4dHJhY3RDb2RlQmxvY2tzKGVsZW1lbnQpO1xuXG4gICAgICAvLyBDbGVhbiB0ZXh0IChyZW1vdmUgY29kZSBibG9ja3MgdGhhdCB3aWxsIGJlIGluIG1ldGFkYXRhKVxuICAgICAgbGV0IGNsZWFuVGV4dCA9IHJhd1RleHQ7XG4gICAgICBjb2RlQmxvY2tzLmZvckVhY2goYmxvY2sgPT4ge1xuICAgICAgICBjbGVhblRleHQgPSBjbGVhblRleHQucmVwbGFjZShibG9jay5jb2RlLCAnJyk7XG4gICAgICB9KTtcbiAgICAgIGNsZWFuVGV4dCA9IGNsZWFuVGV4dC50cmltKCk7XG5cbiAgICAgIGlmICghY2xlYW5UZXh0ICYmIGNvZGVCbG9ja3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IHRoaXMuZXh0cmFjdENvbnZlcnNhdGlvbklkKCk7XG4gICAgICBpZiAoIWNvbnZlcnNhdGlvbklkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICByb2xlLFxuICAgICAgICBjb250ZW50OiBjbGVhblRleHQsXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgY29udmVyc2F0aW9uSWQsXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgY29kZUJsb2NrczogY29kZUJsb2Nrcy5sZW5ndGggPiAwID8gY29kZUJsb2NrcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgICBtZXNzYWdlSW5kZXg6IGluZGV4LFxuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0NsYXVkZSBBZGFwdGVyXSBFcnJvciBleHRyYWN0aW5nIG1lc3NhZ2U6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgbWVzc2FnZSBmcm9tIERPTSBlbGVtZW50XG4gICAqL1xuICBleHRyYWN0TWVzc2FnZShlbGVtZW50OiBIVE1MRWxlbWVudCk6IEV4dHJhY3RlZE1lc3NhZ2UgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5leHRyYWN0TWVzc2FnZUZyb21FbGVtZW50KGVsZW1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIG1lbW9yeSBVSSBzaG91bGQgYmUgc2hvd25cbiAgICovXG4gIHNob3VsZFNob3dNZW1vcnlVSSgpOiBib29sZWFuIHtcbiAgICBjb25zdCBjb252ZXJzYXRpb25JZCA9IHRoaXMuZXh0cmFjdENvbnZlcnNhdGlvbklkKCk7XG4gICAgcmV0dXJuIGNvbnZlcnNhdGlvbklkICE9PSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4dHJhY3QgY29kZSBibG9ja3MgZnJvbSBtZXNzYWdlXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RDb2RlQmxvY2tzKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogRXh0cmFjdGVkQ29kZUJsb2NrW10ge1xuICAgIGNvbnN0IGJsb2NrczogRXh0cmFjdGVkQ29kZUJsb2NrW10gPSBbXTtcbiAgICBcbiAgICAvLyBDbGF1ZGUgdXNlcyBwcmUgPiBjb2RlIHN0cnVjdHVyZVxuICAgIGNvbnN0IGNvZGVFbGVtZW50cyA9IGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlIGNvZGUsIHByZScpO1xuICAgIFxuICAgIGNvZGVFbGVtZW50cy5mb3JFYWNoKChjb2RlRWxlbWVudCkgPT4ge1xuICAgICAgY29uc3QgY29kZSA9IGNvZGVFbGVtZW50LnRleHRDb250ZW50Py50cmltKCk7XG4gICAgICBpZiAoIWNvZGUpIHJldHVybjtcblxuICAgICAgLy8gVHJ5IHRvIGRldGVjdCBsYW5ndWFnZSBmcm9tIGNsYXNzIG9yIGRhdGEgYXR0cmlidXRlXG4gICAgICBsZXQgbGFuZ3VhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgZm9yIGxhbmd1YWdlIGNsYXNzIChlLmcuLCBcImxhbmd1YWdlLXB5dGhvblwiKVxuICAgICAgY29uc3QgY2xhc3NlcyA9IGNvZGVFbGVtZW50LmNsYXNzTmFtZS5zcGxpdCgnICcpO1xuICAgICAgY29uc3QgbGFuZ0NsYXNzID0gY2xhc3Nlcy5maW5kKGMgPT4gYy5zdGFydHNXaXRoKCdsYW5ndWFnZS0nKSk7XG4gICAgICBpZiAobGFuZ0NsYXNzKSB7XG4gICAgICAgIGxhbmd1YWdlID0gbGFuZ0NsYXNzLnJlcGxhY2UoJ2xhbmd1YWdlLScsICcnKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIGRhdGEtbGFuZ3VhZ2UgYXR0cmlidXRlXG4gICAgICBjb25zdCBkYXRhTGFuZyA9IGNvZGVFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1sYW5ndWFnZScpO1xuICAgICAgaWYgKGRhdGFMYW5nKSB7XG4gICAgICAgIGxhbmd1YWdlID0gZGF0YUxhbmc7XG4gICAgICB9XG5cbiAgICAgIC8vIEV4dHJhY3RlZENvZGVCbG9jayByZXF1aXJlcyBsYW5ndWFnZSB0byBiZSBub24tb3B0aW9uYWwsIGRlZmF1bHQgdG8gcGxhaW50ZXh0XG4gICAgICBibG9ja3MucHVzaCh7IGxhbmd1YWdlOiBsYW5ndWFnZSB8fCAncGxhaW50ZXh0JywgY29kZSB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBibG9ja3M7XG4gIH1cblxuICAvKipcbiAgICogU3RvcCBvYnNlcnZpbmcgbWVzc2FnZXNcbiAgICovXG4gIHN0b3BPYnNlcnZpbmcoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMub2JzZXJ2ZXIpIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuICAgICAgdGhpcy5vYnNlcnZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubWVzc2FnZUNhbGxiYWNrID0gbnVsbDtcbiAgICBjb25zb2xlLmxvZygnW0NsYXVkZSBBZGFwdGVyXSBTdG9wcGVkIG9ic2VydmluZycpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFudXBcbiAgICovXG4gIGRlc3Ryb3koKTogdm9pZCB7XG4gICAgdGhpcy5zdG9wT2JzZXJ2aW5nKCk7XG4gICAgdGhpcy5wcm9jZXNzZWRNZXNzYWdlcy5jbGVhcigpO1xuICAgIGNvbnNvbGUubG9nKCdbQ2xhdWRlIEFkYXB0ZXJdIERlc3Ryb3llZCcpO1xuICB9XG59XG5cbi8vIEV4cG9ydCBzaW5nbGV0b24gaW5zdGFuY2VcbmV4cG9ydCBjb25zdCBjbGF1ZGVBZGFwdGVyID0gbmV3IENsYXVkZUFkYXB0ZXIoKTtcbiIsIi8qKlxuICogTWVzc2FnZSBQcm90b2NvbFxuICogVHlwZS1zYWZlIG1lc3NhZ2UgcGFzc2luZyBiZXR3ZWVuIGNvbnRlbnQgc2NyaXB0cyBhbmQgYmFja2dyb3VuZCBzZXJ2aWNlIHdvcmtlclxuICogXG4gKiBNZXNzYWdlIEZsb3c6XG4gKiBDb250ZW50IFNjcmlwdCDihpIgQmFja2dyb3VuZCBXb3JrZXIg4oaSIFN0b3JhZ2UvQ3J5cHRvXG4gKiBCYWNrZ3JvdW5kIFdvcmtlciDihpIgQ29udGVudCBTY3JpcHQgKHJlc3BvbnNlcylcbiAqL1xuXG5pbXBvcnQgeyBFeHRyYWN0ZWRNZXNzYWdlIH0gZnJvbSAnZW5ncmFtLXNoYXJlZC90eXBlcy9wbGF0Zm9ybS1hZGFwdGVyJztcbmltcG9ydCB7IE1lbW9yeSwgVVVJRCB9IGZyb20gJ2VuZ3JhbS1zaGFyZWQvdHlwZXMvbWVtb3J5JztcbmltcG9ydCB7IE1lbW9yeUZpbHRlciB9IGZyb20gJ2VuZ3JhbS1zaGFyZWQvdHlwZXMvc3RvcmFnZSc7XG5cbi8qKlxuICogTWVzc2FnZSBUeXBlc1xuICovXG5leHBvcnQgZW51bSBNZXNzYWdlVHlwZSB7XG4gIC8vIEluaXRpYWxpemF0aW9uXG4gIElOSVRfUkVRVUVTVCA9ICdJTklUX1JFUVVFU1QnLFxuICBJTklUX1JFU1BPTlNFID0gJ0lOSVRfUkVTUE9OU0UnLFxuXG4gIC8vIE1lc3NhZ2UgRXh0cmFjdGlvblxuICBTQVZFX01FU1NBR0UgPSAnU0FWRV9NRVNTQUdFJyxcbiAgU0FWRV9NRVNTQUdFX1JFU1BPTlNFID0gJ1NBVkVfTUVTU0FHRV9SRVNQT05TRScsXG5cbiAgLy8gTWVtb3J5IFF1ZXJpZXNcbiAgR0VUX01FTU9SSUVTID0gJ0dFVF9NRU1PUklFUycsXG4gIEdFVF9NRU1PUklFU19SRVNQT05TRSA9ICdHRVRfTUVNT1JJRVNfUkVTUE9OU0UnLFxuICBcbiAgU0VBUkNIX01FTU9SSUVTID0gJ1NFQVJDSF9NRU1PUklFUycsXG4gIFNFQVJDSF9NRU1PUklFU19SRVNQT05TRSA9ICdTRUFSQ0hfTUVNT1JJRVNfUkVTUE9OU0UnLFxuXG4gIC8vIFN5bmMgU3RhdHVzXG4gIEdFVF9TWU5DX1NUQVRVUyA9ICdHRVRfU1lOQ19TVEFUVVMnLFxuICBHRVRfU1lOQ19TVEFUVVNfUkVTUE9OU0UgPSAnR0VUX1NZTkNfU1RBVFVTX1JFU1BPTlNFJyxcblxuICAvLyBBdXRoZW50aWNhdGlvblxuICBBVVRIX1JFR0lTVEVSID0gJ0FVVEhfUkVHSVNURVInLFxuICBBVVRIX1JFR0lTVEVSX1JFU1BPTlNFID0gJ0FVVEhfUkVHSVNURVJfUkVTUE9OU0UnLFxuICBBVVRIX0xPR0lOID0gJ0FVVEhfTE9HSU4nLFxuICBBVVRIX0xPR0lOX1JFU1BPTlNFID0gJ0FVVEhfTE9HSU5fUkVTUE9OU0UnLFxuICBBVVRIX0xPR09VVCA9ICdBVVRIX0xPR09VVCcsXG4gIEFVVEhfTE9HT1VUX1JFU1BPTlNFID0gJ0FVVEhfTE9HT1VUX1JFU1BPTlNFJyxcbiAgR0VUX0FVVEhfU1RBVEUgPSAnR0VUX0FVVEhfU1RBVEUnLFxuICBHRVRfQVVUSF9TVEFURV9SRVNQT05TRSA9ICdHRVRfQVVUSF9TVEFURV9SRVNQT05TRScsXG5cbiAgLy8gRXJyb3JzXG4gIEVSUk9SID0gJ0VSUk9SJyxcbn1cblxuLyoqXG4gKiBCYXNlIG1lc3NhZ2Ugc3RydWN0dXJlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZU1lc3NhZ2Uge1xuICB0eXBlOiBNZXNzYWdlVHlwZTtcbiAgcmVxdWVzdElkPzogc3RyaW5nOyAvLyBGb3IgcmVxdWVzdC9yZXNwb25zZSBjb3JyZWxhdGlvblxufVxuXG4vKipcbiAqIEluaXRpYWxpemF0aW9uIG1lc3NhZ2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSW5pdFJlcXVlc3QgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLklOSVRfUkVRVUVTVDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJbml0UmVzcG9uc2UgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLklOSVRfUkVTUE9OU0U7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGRldmljZUlkPzogVVVJRDtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogU2F2ZSBtZXNzYWdlIGZyb20gZXh0cmFjdGVkIGNvbnRlbnRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTYXZlTWVzc2FnZVJlcXVlc3QgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLlNBVkVfTUVTU0FHRTtcbiAgbWVzc2FnZTogRXh0cmFjdGVkTWVzc2FnZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBTYXZlTWVzc2FnZVJlc3BvbnNlIGV4dGVuZHMgQmFzZU1lc3NhZ2Uge1xuICB0eXBlOiBNZXNzYWdlVHlwZS5TQVZFX01FU1NBR0VfUkVTUE9OU0U7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIG1lbW9yeUlkPzogVVVJRDtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogR2V0IG1lbW9yaWVzIHdpdGggZmlsdGVyc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEdldE1lbW9yaWVzUmVxdWVzdCBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuR0VUX01FTU9SSUVTO1xuICBmaWx0ZXI/OiBNZW1vcnlGaWx0ZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2V0TWVtb3JpZXNSZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuR0VUX01FTU9SSUVTX1JFU1BPTlNFO1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBtZW1vcmllcz86IE1lbW9yeVtdO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuLyoqXG4gKiBTZWFyY2ggbWVtb3JpZXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZWFyY2hNZW1vcmllc1JlcXVlc3QgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLlNFQVJDSF9NRU1PUklFUztcbiAgcXVlcnk6IHN0cmluZztcbiAgbGltaXQ/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VhcmNoTWVtb3JpZXNSZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuU0VBUkNIX01FTU9SSUVTX1JFU1BPTlNFO1xuICBzdWNjZXNzOiBib29sZWFuO1xuICBtZW1vcmllcz86IE1lbW9yeVtdO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuLyoqXG4gKiBHZXQgc3luYyBzdGF0dXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBHZXRTeW5jU3RhdHVzUmVxdWVzdCBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuR0VUX1NZTkNfU1RBVFVTO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNTdGF0dXMge1xuICBpc0Nvbm5lY3RlZDogYm9vbGVhbjtcbiAgbGFzdFN5bmNUaW1lPzogbnVtYmVyO1xuICBwZW5kaW5nT3BlcmF0aW9uczogbnVtYmVyO1xuICBkZXZpY2VJZD86IFVVSUQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2V0U3luY1N0YXR1c1Jlc3BvbnNlIGV4dGVuZHMgQmFzZU1lc3NhZ2Uge1xuICB0eXBlOiBNZXNzYWdlVHlwZS5HRVRfU1lOQ19TVEFUVVNfUkVTUE9OU0U7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHN0YXR1cz86IFN5bmNTdGF0dXM7XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIEF1dGhlbnRpY2F0aW9uIG1lc3NhZ2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXV0aFJlZ2lzdGVyUmVxdWVzdCBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuQVVUSF9SRUdJU1RFUjtcbiAgZW1haWw6IHN0cmluZztcbiAgcGFzc3dvcmQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBdXRoUmVnaXN0ZXJSZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuQVVUSF9SRUdJU1RFUl9SRVNQT05TRTtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdXNlcklkPzogc3RyaW5nO1xuICBlbWFpbD86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXV0aExvZ2luUmVxdWVzdCBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuQVVUSF9MT0dJTjtcbiAgZW1haWw6IHN0cmluZztcbiAgcGFzc3dvcmQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBdXRoTG9naW5SZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuQVVUSF9MT0dJTl9SRVNQT05TRTtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgdXNlcklkPzogc3RyaW5nO1xuICBlbWFpbD86IHN0cmluZztcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXV0aExvZ291dFJlcXVlc3QgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLkFVVEhfTE9HT1VUO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhMb2dvdXRSZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuQVVUSF9MT0dPVVRfUkVTUE9OU0U7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGVycm9yPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdldEF1dGhTdGF0ZVJlcXVlc3QgZXh0ZW5kcyBCYXNlTWVzc2FnZSB7XG4gIHR5cGU6IE1lc3NhZ2VUeXBlLkdFVF9BVVRIX1NUQVRFO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhTdGF0ZSB7XG4gIGlzQXV0aGVudGljYXRlZDogYm9vbGVhbjtcbiAgdXNlcklkOiBzdHJpbmcgfCBudWxsO1xuICBlbWFpbDogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHZXRBdXRoU3RhdGVSZXNwb25zZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuR0VUX0FVVEhfU1RBVEVfUkVTUE9OU0U7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGF1dGhTdGF0ZT86IEF1dGhTdGF0ZTtcbiAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogRXJyb3IgbWVzc2FnZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVycm9yTWVzc2FnZSBleHRlbmRzIEJhc2VNZXNzYWdlIHtcbiAgdHlwZTogTWVzc2FnZVR5cGUuRVJST1I7XG4gIGVycm9yOiBzdHJpbmc7XG4gIG9yaWdpbmFsVHlwZT86IE1lc3NhZ2VUeXBlO1xufVxuXG4vKipcbiAqIFVuaW9uIG9mIGFsbCBtZXNzYWdlIHR5cGVzXG4gKi9cbmV4cG9ydCB0eXBlIE1lc3NhZ2UgPVxuICB8IEluaXRSZXF1ZXN0XG4gIHwgSW5pdFJlc3BvbnNlXG4gIHwgU2F2ZU1lc3NhZ2VSZXF1ZXN0XG4gIHwgU2F2ZU1lc3NhZ2VSZXNwb25zZVxuICB8IEdldE1lbW9yaWVzUmVxdWVzdFxuICB8IEdldE1lbW9yaWVzUmVzcG9uc2VcbiAgfCBTZWFyY2hNZW1vcmllc1JlcXVlc3RcbiAgfCBTZWFyY2hNZW1vcmllc1Jlc3BvbnNlXG4gIHwgR2V0U3luY1N0YXR1c1JlcXVlc3RcbiAgfCBHZXRTeW5jU3RhdHVzUmVzcG9uc2VcbiAgfCBBdXRoUmVnaXN0ZXJSZXF1ZXN0XG4gIHwgQXV0aFJlZ2lzdGVyUmVzcG9uc2VcbiAgfCBBdXRoTG9naW5SZXF1ZXN0XG4gIHwgQXV0aExvZ2luUmVzcG9uc2VcbiAgfCBBdXRoTG9nb3V0UmVxdWVzdFxuICB8IEF1dGhMb2dvdXRSZXNwb25zZVxuICB8IEdldEF1dGhTdGF0ZVJlcXVlc3RcbiAgfCBHZXRBdXRoU3RhdGVSZXNwb25zZVxuICB8IEVycm9yTWVzc2FnZTtcblxuLyoqXG4gKiBUeXBlIGd1YXJkIGZvciBtZXNzYWdlIHZhbGlkYXRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRNZXNzYWdlKG9iajogYW55KTogb2JqIGlzIE1lc3NhZ2Uge1xuICByZXR1cm4gb2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmICd0eXBlJyBpbiBvYmogJiYgdHlwZW9mIG9iai50eXBlID09PSAnc3RyaW5nJztcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSB1bmlxdWUgcmVxdWVzdCBJRFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVSZXF1ZXN0SWQoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDkpfWA7XG59XG5cbi8qKlxuICogU2VuZCBtZXNzYWdlIHRvIGJhY2tncm91bmQgd29ya2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kTWVzc2FnZTxUIGV4dGVuZHMgTWVzc2FnZT4oXG4gIG1lc3NhZ2U6IE9taXQ8VCwgJ3JlcXVlc3RJZCc+XG4pOiBQcm9taXNlPGFueT4ge1xuICBjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVJlcXVlc3RJZCgpO1xuICBjb25zdCBtZXNzYWdlV2l0aElkID0geyAuLi5tZXNzYWdlLCByZXF1ZXN0SWQgfSBhcyBUO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UobWVzc2FnZVdpdGhJZCwgKHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yLm1lc3NhZ2UpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2UudHlwZSA9PT0gTWVzc2FnZVR5cGUuRVJST1IpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihyZXNwb25zZS5lcnJvcikpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBIZWxwZXI6IFNlbmQgaW5pdCByZXF1ZXN0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kSW5pdFJlcXVlc3QoKTogUHJvbWlzZTxJbml0UmVzcG9uc2U+IHtcbiAgcmV0dXJuIHNlbmRNZXNzYWdlPEluaXRSZXF1ZXN0Pih7XG4gICAgdHlwZTogTWVzc2FnZVR5cGUuSU5JVF9SRVFVRVNULFxuICB9KTtcbn1cblxuLyoqXG4gKiBIZWxwZXI6IFNhdmUgZXh0cmFjdGVkIG1lc3NhZ2VcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRTYXZlTWVzc2FnZShcbiAgbWVzc2FnZTogRXh0cmFjdGVkTWVzc2FnZVxuKTogUHJvbWlzZTxTYXZlTWVzc2FnZVJlc3BvbnNlPiB7XG4gIHJldHVybiBzZW5kTWVzc2FnZTxTYXZlTWVzc2FnZVJlcXVlc3Q+KHtcbiAgICB0eXBlOiBNZXNzYWdlVHlwZS5TQVZFX01FU1NBR0UsXG4gICAgbWVzc2FnZSxcbiAgfSk7XG59XG5cbi8qKlxuICogSGVscGVyOiBHZXQgbWVtb3JpZXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRHZXRNZW1vcmllcyhcbiAgZmlsdGVyPzogTWVtb3J5RmlsdGVyXG4pOiBQcm9taXNlPEdldE1lbW9yaWVzUmVzcG9uc2U+IHtcbiAgcmV0dXJuIHNlbmRNZXNzYWdlPEdldE1lbW9yaWVzUmVxdWVzdD4oe1xuICAgIHR5cGU6IE1lc3NhZ2VUeXBlLkdFVF9NRU1PUklFUyxcbiAgICBmaWx0ZXIsXG4gIH0pO1xufVxuXG4vKipcbiAqIEhlbHBlcjogU2VhcmNoIG1lbW9yaWVzXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kU2VhcmNoTWVtb3JpZXMoXG4gIHF1ZXJ5OiBzdHJpbmcsXG4gIGxpbWl0PzogbnVtYmVyXG4pOiBQcm9taXNlPFNlYXJjaE1lbW9yaWVzUmVzcG9uc2U+IHtcbiAgcmV0dXJuIHNlbmRNZXNzYWdlPFNlYXJjaE1lbW9yaWVzUmVxdWVzdD4oe1xuICAgIHR5cGU6IE1lc3NhZ2VUeXBlLlNFQVJDSF9NRU1PUklFUyxcbiAgICBxdWVyeSxcbiAgICBsaW1pdCxcbiAgfSk7XG59XG5cbi8qKlxuICogSGVscGVyOiBHZXQgc3luYyBzdGF0dXNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRHZXRTeW5jU3RhdHVzKCk6IFByb21pc2U8R2V0U3luY1N0YXR1c1Jlc3BvbnNlPiB7XG4gIHJldHVybiBzZW5kTWVzc2FnZTxHZXRTeW5jU3RhdHVzUmVxdWVzdD4oe1xuICAgIHR5cGU6IE1lc3NhZ2VUeXBlLkdFVF9TWU5DX1NUQVRVUyxcbiAgfSk7XG59XG5cbi8qKlxuICogTWVzc2FnZSBoYW5kbGVyIHR5cGUgZm9yIGJhY2tncm91bmQgd29ya2VyXG4gKi9cbmV4cG9ydCB0eXBlIE1lc3NhZ2VIYW5kbGVyID0gKFxuICBtZXNzYWdlOiBNZXNzYWdlLFxuICBzZW5kZXI6IGNocm9tZS5ydW50aW1lLk1lc3NhZ2VTZW5kZXIsXG4gIHNlbmRSZXNwb25zZTogKHJlc3BvbnNlOiBhbnkpID0+IHZvaWRcbikgPT4gYm9vbGVhbiB8IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuXG4vKipcbiAqIENyZWF0ZSBlcnJvciByZXNwb25zZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXJyb3JSZXNwb25zZShcbiAgZXJyb3I6IHN0cmluZyB8IEVycm9yLFxuICBvcmlnaW5hbFR5cGU/OiBNZXNzYWdlVHlwZVxuKTogRXJyb3JNZXNzYWdlIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiBNZXNzYWdlVHlwZS5FUlJPUixcbiAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvcixcbiAgICBvcmlnaW5hbFR5cGUsXG4gIH07XG59XG5cbi8qKlxuICogVmFsaWRhdGUgbWVzc2FnZSBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTWVzc2FnZShtZXNzYWdlOiBhbnkpOiB7IHZhbGlkOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9IHtcbiAgaWYgKCFtZXNzYWdlIHx8IHR5cGVvZiBtZXNzYWdlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6ICdNZXNzYWdlIG11c3QgYmUgYW4gb2JqZWN0JyB9O1xuICB9XG5cbiAgaWYgKCFtZXNzYWdlLnR5cGUgfHwgdHlwZW9mIG1lc3NhZ2UudHlwZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4geyB2YWxpZDogZmFsc2UsIGVycm9yOiAnTWVzc2FnZSBtdXN0IGhhdmUgYSB0eXBlIHN0cmluZycgfTtcbiAgfVxuXG4gIGlmICghT2JqZWN0LnZhbHVlcyhNZXNzYWdlVHlwZSkuaW5jbHVkZXMobWVzc2FnZS50eXBlKSkge1xuICAgIHJldHVybiB7IHZhbGlkOiBmYWxzZSwgZXJyb3I6IGBJbnZhbGlkIG1lc3NhZ2UgdHlwZTogJHttZXNzYWdlLnR5cGV9YCB9O1xuICB9XG5cbiAgcmV0dXJuIHsgdmFsaWQ6IHRydWUgfTtcbn1cbiJdLCJuYW1lcyI6W10sInZlcnNpb24iOjMsImZpbGUiOiJjb250ZW50cy45Yjc5NDYzZC5qcy5tYXAifQ==
 globalThis.define=__define;  })(globalThis.define);