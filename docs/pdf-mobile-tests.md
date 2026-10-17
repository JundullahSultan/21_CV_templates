# Tier 1 PDF export: physical-device acceptance tests

**Android Chrome and iOS Safari are unverified until you report the results below.** Chrome desktop tests and narrow-screen emulation do not verify a phone's print service, file picker, popup policy or font loading.

## Prepare

1. Run `npm run build`, then use a deployed HTTPS static site, or start `npm run dev -- --host 0.0.0.0 --port 5173` on your private network. Open the computer's LAN address on the phone, not `localhost`. Allow the local development server through your private-network firewall only if needed.
2. Record device model, OS version, browser version and template ID. Begin with 01, 13 (multiple original pages) and 21, then repeat with your preferred templates. The automated suite covers every numbered template.
3. Enter a distinctive full name, phone, email and location. Edit a job title and two achievements. Add Projects, Languages, a Custom section and an uploaded Signature. Add enough entries to produce at least one continuation page. Record the number of A4 sheets in Preview.
4. Test English, then Pashto, Dari and mixed text using these real examples. Copy exactly, including combining marks and zero-width non-joiners:

   - Pashto: `زه د کارن تجربې ډیزاینر یم. د څېړنې او ګډ کار له لارې روښانه حلونه جوړوم.`
   - Dari: `من طراح تجربهٔ کاربری هستم و با پژوهش و همکاری راه‌حل‌های روشن می‌سازم.`
   - Mixed: `زه د UX Design او React په برخه کې کار کوم — Portfolio 2026.`

## Android Chrome

1. Tap **Download PDF** once. Confirm a preparation/loading state appears before the print interface. Confirm the helper says **Choose Save as PDF**.
2. In the Android print interface, select **Save as PDF**, choose **A4**, portrait, all pages and 100% scale where available. Disable browser headers/footers and enable backgrounds if those controls are offered. Record any unavailable controls.
3. Save the file. Check the suggested name is `<Full Name>_CV.pdf`; the system may require you to confirm or edit the name.
4. Open the saved PDF in a PDF viewer. Count pages and compare page breaks against Preview. Inspect the bottom of every page: whole entries, no cropped bullets, no unexpected blank pages, no editor toolbar/chat/buttons.
5. Select/copy your name, email, an achievement, `تجربې`, `څېړنه`, `پژوهش` and `همکاری`. Search for those exact words in the PDF viewer. Paste the copied text into Notes and inspect it. Confirm Arabic letters join correctly, punctuation and numbers follow the intended direction, and English words such as React retain their order.
6. Compare colored headers/backgrounds and signature against Preview. Repeat after cancelling the first print, and repeat once after a reload with autosaved data.

## iOS Safari

1. Repeat Prepare, then tap **Download PDF** once. Record whether Safari actually opens its print interface after preparation. If no dialog appears, record that as a failure; do not assume the export succeeded.
2. Choose A4/portrait and all pages wherever Safari exposes those choices. Use the print preview's share/export controls to save a PDF to Files; on versions that require it, expand the print preview first. Record the exact OS-specific steps and any missing paper-size or background controls.
3. Check/adjust the filename in the save sheet, then open the saved file in Files or another PDF viewer. Perform Android steps 4–6, including exact Pashto/Dari word searches and copied-text inspection.
4. Repeat in both portrait and landscape phone orientation. Cancel a print and immediately try again. Confirm that returning to the editor preserves all data and that export still works after switching templates.

## Report back

Send device/OS/browser versions, template IDs, language, expected/actual page count, filename, whether the dialog opened, whether each search/copy test passed, and whether colors/backgrounds matched. Include the saved PDF when possible. **Tier 1 remains unverified on that device until these checks pass.** No serverless exporter is installed or enabled; Tier 2 requires approval.
