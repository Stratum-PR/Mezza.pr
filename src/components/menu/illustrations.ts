/**
 * Placeholder dish illustrations from the prototype (PH). Static, trusted markup.
 * The seed renders these to PNG as placeholder photos.
 */
const ILLUSTRATIONS: Record<string, string> = {
  cup: '<ellipse cx="50" cy="76" rx="34" ry="8" fill="#fff" stroke="#B08D57" stroke-width="2"/><path d="M28 44h44v12a22 22 0 0 1-44 0z" fill="#fff" stroke="#B08D57" stroke-width="2"/><ellipse cx="50" cy="44" rx="22" ry="5" fill="#7A4A2A"/><path d="M72 48a8 8 0 0 1 0 14" fill="none" stroke="#B08D57" stroke-width="3"/><path d="M42 32q4-6 0-12M54 32q4-6 0-12" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  pastry:
    '<circle cx="50" cy="55" r="30" fill="#D9A55B"/><path d="M50 55m-4 0a4 4 0 1 1 8 0a10 10 0 1 1-18 0a16 16 0 1 1 30 0a22 22 0 1 1-40 2" fill="none" stroke="#B8823A" stroke-width="3"/><g fill="#fff" opacity=".9"><circle cx="40" cy="45" r="2"/><circle cx="58" cy="40" r="2"/><circle cx="62" cy="60" r="2"/><circle cx="45" cy="66" r="2"/><circle cx="52" cy="52" r="1.6"/></g>',
  plate:
    '<circle cx="50" cy="55" r="34" fill="#fff" stroke="#B08D57" stroke-width="2"/><path d="M32 55q8-14 20-6q12-10 18 4q-6 14-20 10q-14 6-18-8z" fill="#F2C94C"/><rect x="56" y="58" width="16" height="10" rx="2" fill="#D98C8C" transform="rotate(-12 64 63)"/>',
  bowl: '<path d="M20 50h60a30 26 0 0 1-60 0z" fill="#fff" stroke="#B08D57" stroke-width="2"/><ellipse cx="50" cy="50" rx="30" ry="7" fill="#E8D3A4"/><g fill="#9C6B3C"><circle cx="42" cy="49" r="1.6"/><circle cx="55" cy="51" r="1.6"/><circle cx="60" cy="48" r="1.4"/></g>',
  sandwich:
    '<path d="M18 64L50 30L82 64Z" fill="#E7C08A" stroke="#B8823A" stroke-width="2"/><rect x="22" y="62" width="56" height="6" fill="#D98C8C"/><rect x="20" y="67" width="60" height="5" fill="#7FB069"/><rect x="18" y="71" width="64" height="8" rx="2" fill="#E7C08A" stroke="#B8823A" stroke-width="2"/>',
  flan: '<ellipse cx="50" cy="72" rx="34" ry="8" fill="#fff" stroke="#B08D57" stroke-width="2"/><path d="M30 70L36 40H64L70 70Z" fill="#F2D27A"/><path d="M36 40H64L62 48Q50 52 38 48Z" fill="#9C4A1A"/>',
  glass:
    '<path d="M34 22H66L62 82H38Z" fill="#fff" stroke="#B08D57" stroke-width="2"/><path d="M36 36H64L61 80H39Z" fill="#F29E38"/><circle cx="64" cy="24" r="9" fill="#F2B544" stroke="#fff" stroke-width="2"/>',
  bottle:
    '<path d="M44 14h12v14q10 8 10 20v36a4 4 0 0 1-4 4h-24a4 4 0 0 1-4-4v-36q0-12 10-20z" fill="#3B2314"/><rect x="34" y="50" width="32" height="18" fill="#F2D27A"/>',
};

export function illustrationSvg(key: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#EAD9B4"/>${ILLUSTRATIONS[key] ?? ""}</svg>`;
}

export function illustrationDataUrl(key: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(illustrationSvg(key))}`;
}
