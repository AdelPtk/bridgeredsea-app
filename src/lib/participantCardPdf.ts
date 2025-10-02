// Use dynamic imports to avoid type resolution issues; shim types are provided
let _PizZip: any;
let _Docxtemplater: any;
let _html2pdf: any;
let _renderAsync: any;

/**
 * Very lightweight DOCX templating by replacing text placeholders in the XML.
 * Placeholders: {NAME}, {HOTEL}, {START}, {END}
 */
export type ParticipantLike = { NAME: string; HOTEL: string; START: string; END: string };
export type PdfOptions = {
  /** Optional absolute/relative URL to the DOCX template */
  templateUrl?: string;
  /** Optional local file (from <input type="file">) or preloaded ArrayBuffer */
  templateFile?: File | ArrayBuffer;
  /** Optional server URL for server-side conversion (default: http://localhost:4000/convert) */
  convertUrl?: string;
};
export async function generateParticipantPdfFromParticipant(
  participant: ParticipantLike,
  opts?: PdfOptions
): Promise<void> {
  const dbg = (() => {
    try {
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      return q?.get("pdfDebug") === "1" || (typeof localStorage !== "undefined" && localStorage.getItem("pdfDebug") === "1");
    } catch {
      return false;
    }
  })();
  // Guard against running from file:// where fetch will fail
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    throw new Error("file-protocol");
  }
  // 1) obtain docx as ArrayBuffer (from provided File/buffer, or fetch from URL with fallbacks)
  let arrayBuffer: ArrayBuffer;
  if (opts?.templateFile) {
    if (opts.templateFile instanceof ArrayBuffer) {
      arrayBuffer = opts.templateFile;
    } else {
      arrayBuffer = await opts.templateFile.arrayBuffer();
    }
  } else {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const primary = opts?.templateUrl || `${base.endsWith("/") ? base : base + "/"}participantCardPDF.docx`;
    const fallbacks = [primary, "/participantCardPDF.docx"].filter(Boolean) as string[];
    let lastErr: any = null;
    let okRes: Response | null = null;
    for (const url of fallbacks) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          okRes = res;
          if (dbg) console.log("PDF: using template URL", url);
          break;
        } else {
          lastErr = new Error(`template-not-found:${res.status}`);
          if (dbg) console.warn("PDF: template not found", url, res.status);
        }
      } catch (e) {
        lastErr = e;
        if (dbg) console.warn("PDF: template fetch error", url, e);
      }
    }
    if (!okRes) {
      console.error("template fetch error (all candidates)", { fallbacks, lastErr });
      if (String(lastErr?.message || "").startsWith("template-not-found")) {
        throw lastErr;
      }
      throw new Error("template-fetch-failed");
    }
    arrayBuffer = await okRes.arrayBuffer();
  }

  // 2) unzip and fill placeholders using docxtemplater (keeps layout 1:1)
  if (!_PizZip) {
    const mod = await import("pizzip");
    _PizZip = mod.default || mod;
  }
  if (!_Docxtemplater) {
    const mod = await import("docxtemplater");
    _Docxtemplater = mod.default || mod;
  }
  const zip = new _PizZip(arrayBuffer);
  if (dbg) {
    try {
      const xml = zip.file("word/document.xml")?.asText() || "";
      const rawTags = Array.from(xml.matchAll(/\{\{[^}]+\}\}/g)).map(m => m[0]);
      const cleaned = rawTags.map(t => t.replace(/[\u200E\u200F\u202A-\u202E\u00A0]/g, "").replace(/[{}]/g, "").trim());
      console.log("PDF: found raw tags in template", rawTags);
      console.log("PDF: cleaned tag names", cleaned);
    } catch (e) {
      console.warn("PDF: debug tag scan failed", e);
    }
  }
  let doc: any;
  try {
    // Parser to make tags resilient: trim spaces and remove bidi/invisible marks
    const rtlSafeParser = (tag: string) => {
      const cleaned = tag
        .replace(/[\u200E\u200F\u202A-\u202E\u00A0]/g, "") // strip LRM/RLM & bidi marks & NBSP
        .trim();
      return {
        get: (scope: any) => scope[cleaned],
      } as any;
    };
    // Use double-curly delimiters to match template placeholders like {{NAME}}
    doc = new _Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{{", end: "}}" },
      parser: rtlSafeParser,
      // If a tag is missing, replace with empty string instead of throwing
      nullGetter() { return ""; },
    });
  } catch (e: any) {
    console.error("docx template error", e?.properties || e);
    // Surface a consistent error code for UI mapping
    throw new Error("docx-template-invalid");
  }
  // Prepare data for {{NAME}}, {{HOTEL}}, {{START}}, {{END}}
  const renderData = {
    NAME: String(participant.NAME ?? "").trim(),
    HOTEL: String(participant.HOTEL ?? "").trim(),
    START: String(participant.START ?? "").trim(),
    END: String(participant.END ?? "").trim(),
  };
  if (dbg) console.log("PDF: data mapping", renderData);
  try {
    // New API: pass data directly to render instead of using setData
    doc.render(renderData);
  } catch (e) {
    console.error("docx render error", e);
    throw new Error("docx-render-failed");
  }

  // 3) preferred: render full DOCX layout via docx-preview, else fallback to simple parser
  const buffer = doc.getZip().generate({ type: "arraybuffer" });
  let container: HTMLElement | null = null;
  try {
    if (!_renderAsync) {
      const mod = await import("docx-preview");
      _renderAsync = (mod as any).renderAsync;
    }
  container = document.createElement("div");
  container.style.background = "#ffffff";
  container.style.padding = "16px";
  container.style.direction = "rtl";
  // Place off-screen but fully visible (no opacity) so html2canvas captures content
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.pointerEvents = "none";
    // Give the container explicit physical size in mm so html2canvas measures height > 0
  const pageWidthMM = 257.1;
  const pageHeightMM = 161.9;
  const pxPerMM = 96 / 25.4; // ~3.78
  container.style.width = `${Math.round(pageWidthMM * pxPerMM)}px`;
  container.style.minHeight = `${Math.round(pageHeightMM * pxPerMM)}px`;
    container.style.boxSizing = "border-box";
    document.body.appendChild(container);
    // Render with wrapper so docx-preview injects page CSS and proper flow
    await _renderAsync(buffer, container, undefined, { inWrapper: true });
    // Wait a tick for DOM layout, then ensure images are fully loaded before snapshot
    await new Promise((r) => requestAnimationFrame(r));
    await waitForImagesToLoad(container, 8000);
    if (dbg) {
      const imgs = Array.from(container.querySelectorAll("img"));
      console.log(
        "PDF: container size after render",
        { width: container.offsetWidth, height: container.offsetHeight, imgCount: imgs.length }
      );
      if (imgs.length) {
        console.log(
          "PDF: first image info",
          {
            src: (imgs[0] as HTMLImageElement).currentSrc || (imgs[0] as HTMLImageElement).src,
            naturalWidth: (imgs[0] as HTMLImageElement).naturalWidth,
            naturalHeight: (imgs[0] as HTMLImageElement).naturalHeight,
          }
        );
      }
    }
    // If height is still zero (rare), add a spacer to ensure measurable height
    if (container.offsetHeight === 0) {
      const spacer = document.createElement("div");
      spacer.style.height = `${pageHeightMM}mm`;
      spacer.style.visibility = "hidden";
      container.appendChild(spacer);
    }
  } catch (e) {
    console.error("docx-preview render failed; not falling back to text-only renderer because it drops images.", e);
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
    throw new Error("docx-preview-failed");
  }

  // 4) render to PDF and download
  if (!_html2pdf) {
    const mod = await import("html2pdf.js");
    _html2pdf = (mod as any).default || mod;
  }
  // cm to mm conversion: 25.71cm x 16.19cm
  const pdfWidthMM = 257.1;
  const pdfHeightMM = 161.9;
  try {
    await _html2pdf()
      .set({
        margin: 0,
        filename: `participant-card.pdf`,
  jsPDF: { unit: "mm", format: [pdfWidthMM, pdfHeightMM], orientation: "landscape" },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" },
      })
      .from(container!)
      .save();
  } catch (e) {
    console.error("pdf generate error", e);
    throw new Error("pdf-generate-failed");
  } finally {
    // Cleanup the temporary DOM container
    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }
  }
}

/**
 * Generate a filled DOCX (Word) using single-brace placeholders like {NAME}, {HOTEL}, {START}, {END}
 * and trigger a browser download. No PDF conversion.
 */
export async function generateParticipantDocxFromParticipant(
  participant: ParticipantLike,
  opts?: PdfOptions
): Promise<void> {
  const dbg = (() => {
    try {
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      return q?.get("pdfDebug") === "1" || (typeof localStorage !== "undefined" && localStorage.getItem("pdfDebug") === "1");
    } catch {
      return false;
    }
  })();
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    throw new Error("file-protocol");
  }
  // 1) Load the DOCX template as ArrayBuffer
  let arrayBuffer: ArrayBuffer;
  if (opts?.templateFile) {
    arrayBuffer = opts.templateFile instanceof ArrayBuffer ? opts.templateFile : await opts.templateFile.arrayBuffer();
  } else {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const primary = opts?.templateUrl || `${base.endsWith("/") ? base : base + "/"}participantCardPDF.docx`;
    const fallbacks = [primary, "/participantCardPDF.docx"].filter(Boolean) as string[];
    let lastErr: any = null;
    let okRes: Response | null = null;
    for (const url of fallbacks) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          okRes = res;
          if (dbg) console.log("DOCX: using template URL", url);
          break;
        } else {
          lastErr = new Error(`template-not-found:${res.status}`);
          if (dbg) console.warn("DOCX: template not found", url, res.status);
        }
      } catch (e) {
        lastErr = e;
        if (dbg) console.warn("DOCX: template fetch error", url, e);
      }
    }
    if (!okRes) {
      console.error("DOCX: template fetch error (all candidates)", { fallbacks, lastErr });
      if (String(lastErr?.message || "").startsWith("template-not-found")) {
        throw lastErr;
      }
      throw new Error("template-fetch-failed");
    }
    arrayBuffer = await okRes.arrayBuffer();
  }

  // 2) Fill placeholders using docxtemplater with single-brace delimiters
  if (!_PizZip) {
    const mod = await import("pizzip");
    _PizZip = mod.default || mod;
  }
  if (!_Docxtemplater) {
    const mod = await import("docxtemplater");
    _Docxtemplater = mod.default || mod;
  }
  const zip = new _PizZip(arrayBuffer);
  if (dbg) {
    try {
      const xml = zip.file("word/document.xml")?.asText() || "";
      const rawTags = Array.from(xml.matchAll(/\{[^}]+\}/g)).map(m => m[0]);
      const cleaned = rawTags.map(t => t.replace(/[\u200E\u200F\u202A-\u202E\u00A0]/g, "").replace(/[{}]/g, "").trim());
      console.log("DOCX: found raw tags in template", rawTags);
      console.log("DOCX: cleaned tag names", cleaned);
    } catch (e) {
      console.warn("DOCX: debug tag scan failed", e);
    }
  }
  let doc: any;
  try {
    const rtlSafeParser = (tag: string) => {
      const cleaned = tag
        .replace(/[\u200E\u200F\u202A-\u202E\u00A0]/g, "")
        .trim();
      return { get: (scope: any) => scope[cleaned] } as any;
    };
    doc = new _Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
      parser: rtlSafeParser,
      nullGetter() { return ""; },
    });
  } catch (e: any) {
    console.error("docx template error", e?.properties || e);
    throw new Error("docx-template-invalid");
  }
  const renderData = {
    NAME: String(participant.NAME ?? "").trim(),
    HOTEL: String(participant.HOTEL ?? "").trim(),
    START: String(participant.START ?? "").trim(),
    END: String(participant.END ?? "").trim(),
  };
  if (dbg) console.log("DOCX: data mapping", renderData);
  try {
    doc.render(renderData);
  } catch (e) {
    console.error("docx render error", e);
    throw new Error("docx-render-failed");
  }

  // 3) Export filled DOCX and download
  const out = doc.getZip().generate({ type: "arraybuffer" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (participant.NAME || "participant").toString().replace(/[\\/:*?"<>|]/g, "_");
  a.download = `participant-card-${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/**
 * Simplest path: Fill DOCX using single-brace placeholders and download as PDF via docx-preview + html2pdf.
 */
export async function generateParticipantPdfSimple(
  participant: ParticipantLike,
  opts?: PdfOptions
): Promise<void> {
  const dbg = (() => {
    try {
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      return q?.get("pdfDebug") === "1" || (typeof localStorage !== "undefined" && localStorage.getItem("pdfDebug") === "1");
    } catch {
      return false;
    }
  })();
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    throw new Error("file-protocol");
  }
  // 1) Load template
  let arrayBuffer: ArrayBuffer;
  if (opts?.templateFile) {
    arrayBuffer = opts.templateFile instanceof ArrayBuffer ? opts.templateFile : await opts.templateFile.arrayBuffer();
  } else {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const primary = opts?.templateUrl || `${base.endsWith("/") ? base : base + "/"}participantCardPDF.docx`;
    const fallbacks = [primary, "/participantCardPDF.docx"].filter(Boolean) as string[];
    let lastErr: any = null;
    let okRes: Response | null = null;
    for (const url of fallbacks) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          okRes = res;
          if (dbg) console.log("PDFsimple: using template URL", url);
          break;
        } else {
          lastErr = new Error(`template-not-found:${res.status}`);
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!okRes) {
      if (String(lastErr?.message || "").startsWith("template-not-found")) throw lastErr;
      throw new Error("template-fetch-failed");
    }
    arrayBuffer = await okRes.arrayBuffer();
  }

  // 2) Fill with single-brace placeholders
  if (!_PizZip) {
    const mod = await import("pizzip");
    _PizZip = mod.default || mod;
  }
  if (!_Docxtemplater) {
    const mod = await import("docxtemplater");
    _Docxtemplater = mod.default || mod;
  }
  const zip = new _PizZip(arrayBuffer);
  let doc: any;
  try {
    const rtlSafeParser = (tag: string) => {
      const cleaned = tag.replace(/[\u200E\u200F\u202A-\u202E\u00A0]/g, "").trim();
      return { get: (scope: any) => scope[cleaned] } as any;
    };
    doc = new _Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
      parser: rtlSafeParser,
      nullGetter() { return ""; },
    });
  } catch (e) {
    throw new Error("docx-template-invalid");
  }
  const renderData = {
    NAME: String(participant.NAME ?? "").trim(),
    HOTEL: String(participant.HOTEL ?? "").trim(),
    START: String(participant.START ?? "").trim(),
    END: String(participant.END ?? "").trim(),
  };
  try {
    doc.render(renderData);
  } catch (e) {
    throw new Error("docx-render-failed");
  }

  // 3) Prepare filled DOCX buffer
  const filled = doc.getZip().generate({ type: "arraybuffer" });
  // Option A: send to local server for conversion (best fidelity)
  const convertUrl = opts?.convertUrl || 'http://localhost:4000/convert';
  try {
    const form = new FormData();
    form.append('file', new Blob([filled], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'input.docx');
    const resp = await fetch(convertUrl, { method: 'POST', body: form });
    if (resp.ok && resp.headers.get('content-type')?.includes('application/pdf')) {
      const pdfBlob = await resp.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participant-card-${(participant.NAME || 'participant').toString().replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      return;
    }
  } catch {
    // server not available; fall back to client-side render
  }
  // Option B: Render filled DOCX to HTML and then to PDF (client-only fallback)
  if (!_renderAsync) {
    const mod = await import("docx-preview");
    _renderAsync = (mod as any).renderAsync;
  }
  const container = document.createElement("div");
  container.style.background = "#ffffff";
  container.style.padding = "16px";
  container.style.direction = "rtl";
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.pointerEvents = "none";
  const pageWidthMM = 257.1;
  const pageHeightMM = 161.9;
  const pxPerMM = 96 / 25.4;
  container.style.width = `${Math.round(pageWidthMM * pxPerMM)}px`;
  container.style.minHeight = `${Math.round(pageHeightMM * pxPerMM)}px`;
  container.style.boxSizing = "border-box";
  document.body.appendChild(container);
  try {
    await _renderAsync(filled, container, undefined, { inWrapper: true });
    await new Promise((r) => requestAnimationFrame(r));
    await waitForImagesToLoad(container, 8000);
    const dbg = (() => {
      try {
        const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        return q?.get("pdfDebug") === "1" || (typeof localStorage !== "undefined" && localStorage.getItem("pdfDebug") === "1");
      } catch {
        return false;
      }
    })();
    if (dbg) {
      const imgs = Array.from(container.querySelectorAll("img"));
      console.log("PDFsimple: container size after render", { width: container.offsetWidth, height: container.offsetHeight, imgCount: imgs.length });
      if (imgs.length) {
        const im = imgs[0] as HTMLImageElement;
        console.log("PDFsimple: first image info", { src: im.currentSrc || im.src, naturalWidth: im.naturalWidth, naturalHeight: im.naturalHeight });
      }
    }
    if (container.offsetHeight === 0) {
      const spacer = document.createElement("div");
      spacer.style.height = `${pageHeightMM}mm`;
      spacer.style.visibility = "hidden";
      container.appendChild(spacer);
    }
  } catch (e) {
    if (container.parentElement) container.parentElement.removeChild(container);
    throw new Error("docx-preview-failed");
  }

  if (!_html2pdf) {
    const mod = await import("html2pdf.js");
    _html2pdf = (mod as any).default || mod;
  }
  try {
    await _html2pdf()
      .set({
        margin: 0,
        filename: `participant-card-${(participant.NAME || "participant").toString().replace(/[\\/:*?"<>|]/g, "_")}.pdf`,
        jsPDF: { unit: "mm", format: [pageWidthMM, pageHeightMM], orientation: "landscape" },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" },
      })
      .from(container)
      .save();
  } catch (e) {
    throw new Error("pdf-generate-failed");
  } finally {
    if (container.parentElement) container.parentElement.removeChild(container);
  }
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function docxToSimpleHtml(buffer: ArrayBuffer): Promise<HTMLElement> {
  // Minimal converter: render the document XML paragraphs as divs.
  const zip = new _PizZip(buffer);
  const xml = zip.file("word/document.xml")?.asText() || "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagName("w:body")[0];
  const container = document.createElement("div");
  container.style.fontFamily = "Arial, sans-serif";
  container.style.direction = "rtl";
  if (!body) return container;
  const paras = Array.from(body.getElementsByTagName("w:p"));
  for (const p of paras) {
    const runs = Array.from(p.getElementsByTagName("w:t"));
    const line = document.createElement("div");
    line.textContent = runs.map((t) => t.textContent || "").join("");
    line.style.margin = "6px 0";
    container.appendChild(line);
  }
  return container;
}

async function waitForImagesToLoad(root: HTMLElement, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if ((img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0) {
              resolve();
              return;
            }
            const onDone = () => {
              img.removeEventListener("load", onDone);
              img.removeEventListener("error", onDone);
              resolve();
            };
            img.addEventListener("load", onDone);
            img.addEventListener("error", onDone);
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
