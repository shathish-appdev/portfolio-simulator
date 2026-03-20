// Temporary declaration to satisfy TypeScript when the JSX runtime module types
// are not resolved by the editor or @types/react. This provides minimal type
// information for the automatic JSX runtime functions used by React 17+.
declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export function jsxDEV(type: any, props?: any, key?: any): any;
}