================================================
 SPLINE SCENE — GODADDY DEPLOYMENT GUIDE
================================================

FOLDER CONTENTS:
  index.html        — Standalone full-page viewer
  scene.splinecode  — Your Spline 3D scene file
  embed.html        — Reusable snippet for other pages
  README.txt        — This file

------------------------------------------------
STEP 1: UPLOAD THIS FOLDER TO GODADDY
------------------------------------------------
1. Log in to GoDaddy → Hosting → cPanel → File Manager
2. Open public_html/
3. Upload the entire "spline-scene" folder as-is

Your structure should look like:
  public_html/
    spline-scene/
      index.html
      scene.splinecode
      embed.html
      README.txt

------------------------------------------------
STEP 2: TEST THE STANDALONE PAGE
------------------------------------------------
Visit: https://yourdomain.com/spline-scene/

------------------------------------------------
STEP 3: EMBED INTO YOUR OTHER PAGES
------------------------------------------------
Open embed.html and copy ONE of the 3 options
into any other HTML page on your site.

The url path "/spline-scene/scene.splinecode" 
works from anywhere on your domain as long as
the folder stays in public_html/.

Also paste the <script> tag once before </body>
on every page that uses the scene.

------------------------------------------------
NOTES
------------------------------------------------
- Do NOT move scene.splinecode out of this folder
  without updating the url="..." path in your HTML.
- Alternatively, export from Spline editor via
  File > Export > Spline Viewer to get a hosted
  CDN URL — then no file upload is needed at all.
================================================
