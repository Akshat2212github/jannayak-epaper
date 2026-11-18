/*
  ============================================================
   JANNAYAK E-PAPER — SITE SETTINGS  (edit this file only)
  ============================================================
  PDFs go in:   public/pdfs/<folder>/dd_mm__yyyy.pdf
  Example:      public/pdfs/kota/18_11__2026.pdf
*/
window.JANNAYAK_CONFIG = {
  // Language shown the first time someone visits: 'hi' (Hindi) or 'en' (English)
  defaultLang: 'hi',

  // Edition dates are decided in this time zone (not the visitor's)
  timezone: 'Asia/Kolkata',

  // Main accent colour (buttons, today's marker). Any hex colour.
  accent: '#B3261E',

  // Folder that holds the PDFs, relative to the site root.
  // (Can also be a full https:// address if you ever move PDFs to cloud storage.)
  pdfBase: 'pdfs',

  // Your public website address, used in WhatsApp share text.
  // Leave empty to use the address the visitor is on.
  siteUrl: '',

  // Editions. `id` appears in links, `folder` is the folder under pdfs/.
  cities: [
    { id: 'kota',        folder: 'kota',        name: { hi: 'कोटा',        en: 'Kota' } },
    { id: 'jaipur',      folder: 'jaipur',      name: { hi: 'जयपुर',       en: 'Jaipur' } },
    { id: 'chittorgarh', folder: 'chittorgarh', name: { hi: 'चित्तौड़गढ़',  en: 'Chittorgarh' } }
  ],

  // Contact details shown in the footer. Replace the [ ] placeholders.
  // Anything left in [square brackets] is shown as plain text, not as a link.
  offices: {
    kota:        { address: { hi: '[पूरा पता]', en: '[Full address]' }, phone: '[Phone]', email: '[Email]' },
    jaipur:      { address: { hi: '[पूरा पता]', en: '[Full address]' }, phone: '[Phone]', email: '[Email]' },
    chittorgarh: { address: { hi: '[पूरा पता]', en: '[Full address]' }, phone: '[Phone]', email: '[Email]' }
  }
};
