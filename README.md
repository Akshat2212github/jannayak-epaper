# Jannayak e-paper website

Plain HTML / CSS / JavaScript. No framework, no database, nothing to install except Node (only needed to preview on your own computer).
Hindi and English versions (button at the top of every page). Editions: Kota, Jaipur, Chittorgarh.

## 1. Adding the daily PDFs

Put each PDF in the folder of its city, named **`dd_mm__yyyy.pdf`** (two underscores before the year):

```
public/pdfs/kota/18_11__2026.pdf
public/pdfs/jaipur/18_11__2026.pdf
public/pdfs/chittorgarh/18_11__2026.pdf
```

Then commit and push to GitHub. Vercel redeploys by itself, and the new edition appears on the home page, the reader and the archive calendar. There is nothing else to edit.

Good to know
- A file with a wrong name (for example `kota_18nov.pdf`) is skipped, and the Vercel build log says so.
- If a city has no PDF for today yet, its card shows the most recent edition and labels it "Previous edition".
- **Optional, makes the home page lighter:** put a front-page picture next to the PDF with the same name, e.g. `18_11__2026.jpg` (or `.webp` / `.png`, about 600 px wide). The site then uses the picture as the thumbnail. Without it, the site draws the thumbnail from the PDF itself.

## 2. Put it on GitHub

1. Create a new repository on github.com (private is fine).
2. Upload the contents of this folder (or run `git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push`).

## 3. Deploy on Vercel

1. vercel.com -> **Add New -> Project** -> import the GitHub repository.
2. Leave the settings as they are. `vercel.json` already sets the build command (`node scripts/build-manifest.js`) and the output folder (`public`). Framework preset: **Other**.
3. Click **Deploy**. Add your own domain under **Settings -> Domains**.

Every push to the main branch redeploys the site.

## 4. Changing details

| What | Where |
| --- | --- |
| Office addresses, phones, emails (footer) | `public/config.js` -> `offices` |
| Accent colour, default language, city names/folders | `public/config.js` |
| Any Hindi or English wording | `public/assets/js/i18n.js` |
| Colours, fonts, spacing | `public/assets/css/style.css` (variables at the top) |

To open the site in English by default, set `defaultLang: 'en'` in `config.js`. Visitors' own choice is remembered in their browser. A link like `https://yoursite.com/?lang=en` also opens it in English.

## 5. Try it on your computer

```
npm run dev
```

Open http://localhost:3000 . Add a PDF, refresh the page, and it shows up. (Opening the HTML files by double-clicking will not work, because the browser blocks reading the PDFs and the edition list that way.)

## 6. Important: PDF storage

Every PDF you commit is stored in the Git repository and is included in every Vercel deployment. Three PDFs a day add up quickly.

- GitHub rejects any single file over 100 MB. Keep each PDF well below that (compress the PDF before uploading if it is large).
- Vercel's limits page lists static file uploads at 100 MB on the Hobby plan and 1 GB on Pro. Vercel describes the Hobby plan as for personal, non-commercial use, so a newspaper business should check Vercel's current terms and probably use a Pro plan.
- Plan for the archive to grow: for example keep the last 60-90 days in the repository, or move PDFs to cloud storage (Cloudflare R2, Vercel Blob, Amazon S3) and set `pdfBase` in `config.js` to that address. Note that the automatic edition list (`scripts/build-manifest.js`) reads the local `public/pdfs` folders, so moving the files out would need a small change there.

## How it works

- `scripts/build-manifest.js` scans `public/pdfs/*/` and writes `public/editions.json` (a list of which dates exist for each city). Vercel runs it on every deploy.
- The home page reads that list for the latest editions and the archive calendar.
- The reader uses PDF.js (included in `public/assets/vendor/pdfjs/`, Apache-2.0 licence) to draw the PDF page by page, so it works on phones. It loads only the pages being viewed.
- Edition dates use India time (Asia/Kolkata), whatever country the visitor is in.

## Files

```
public/
  index.html            home page
  reader.html           e-paper reader
  config.js             your settings
  editions.json         generated list of editions (do not edit by hand)
  pdfs/<city>/          put the PDFs here
  assets/css/style.css
  assets/js/            i18n.js (wording), common.js, home.js, reader.js
  assets/vendor/pdfjs/  PDF.js
scripts/
  build-manifest.js     builds editions.json
  dev-server.js         local preview server (npm run dev)
vercel.json             Vercel settings
```
