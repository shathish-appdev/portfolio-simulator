import '@testing-library/jest-dom'; 

if (typeof window !== 'undefined') {
  if (!window.CSS) {
    (window as Window & { CSS?: { supports?: (...args: string[]) => boolean } }).CSS = {};
  }
  if (typeof window.CSS.supports !== 'function') {
    window.CSS.supports = () => false;
  }
}