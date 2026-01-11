/**
 * Global type declarations for Plasmo and other module patterns
 */

// Plasmo asset imports
declare module 'data-base64:~assets/engram-logo.png' {
  const content: string;
  export default content;
}

declare module 'data-base64:~assets/*' {
  const content: string;
  export default content;
}

declare module 'data-base64:*' {
  const content: string;
  export default content;
}

declare module 'data-text:*' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
