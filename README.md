# Image Converter

Convert images between JPG, PNG and WebP free online. Batch convert many photos at once, choose quality, and download as a ZIP. Private: files stay on your device.

**Live demo:** https://harikabehara247.github.io/image-converter/

## About

Different places want different image formats. A government or exam portal may accept only JPG, a website loads faster with WebP, and a logo needs PNG to keep its transparent background. Images saved from the web are often WebP files that some apps cannot open.

This converter reads any image your browser can open and saves it as JPG, PNG or WebP at the quality you choose. To also make the files smaller, use the Image Compressor; to change the dimensions, use the Image Resizer.

## Features

- **Batch conversion** — Convert dozens of images in one go and download them as a single ZIP.
- **Quality control** — Set JPG and WebP quality to balance sharpness and file size.
- **Transparency handled** — PNGs with transparent areas get a white (or any colour) background when saved as JPG.
- **Nothing uploaded** — Files never leave your device, so private photos and documents stay private.

## How to use

1. **Add images** — Drop as many images as you like, choose them, or paste one with Ctrl+V.
2. **Pick the new format** — JPG for photos and small files, PNG for transparency and sharp graphics, WebP for websites.
3. **Convert** — Every file is converted in a moment, with its new size shown next to it.
4. **Download** — Save files one by one, or all together as a ZIP.

## Tech

- Plain HTML, CSS and JavaScript (ES modules), no build step
- Runs entirely in the browser: files and inputs never leave the device
- Third-party libraries:
  - fflate 0.8.3 MIT

## Run locally

Serve the folder with any static server, for example `python3 -m http.server`, then open http://localhost:8000. (ES modules do not load from `file://`.)

## FAQ

**How do I convert WebP to JPG?**  
Add the WebP files, choose JPG as the new format and click Convert. Download each file or all of them as a ZIP.

**Will converting PNG to JPG lose transparency?**  
JPG cannot store transparency, so transparent areas are filled with white by default. You can pick another colour, or choose PNG or WebP to keep transparency.

**Can I convert HEIC photos from an iPhone?**  
If your browser can open HEIC (Safari on iPhone and Mac can), the converter can turn it into JPG. In other browsers, set the iPhone camera to “Most Compatible” to save JPGs.

**Is there a limit on files?**  
No fixed limit. Very large batches depend on your device’s memory; converting 50 to 100 photos at a time works well on most computers.

**Is my data safe?**  
Yes. Conversion happens in your browser and no file is uploaded.

## Author

Built by **[Harika Behara](https://github.com/harikabehara247)**.

## Licence

Code: [MIT](LICENSE) © 2026 Harika Behara. Bundled third-party libraries keep their own licences — see `assets/tools/vendor/LICENSES.txt`.
