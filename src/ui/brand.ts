// Browser-tab icon from the logo. (The colour direction is fixed in the CSS variables at the top of styles.css.)

/** Use the logo as the browser tab icon. */
export function setFavicon(url: string): void {
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link || !url) return;
    link.type = 'image/png';
    link.href = url;
  } catch {
    /* keep the built-in icon */
  }
}
