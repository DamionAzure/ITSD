const P = {
  slides: "M4 6h10v8H4zM7 16h10V9",
  source: "M8 6l-4 4 4 4M12 6l4 4-4 4",
  canvas: "M3 5h14v9H3zM7 17h6",
};
export const Icon = ({ n }: { n: keyof typeof P }) => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={P[n]} /></svg>
);
