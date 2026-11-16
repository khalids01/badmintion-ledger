import { toPng } from "html-to-image";

// Captures the given element exactly as painted and downloads it as a PNG.
// Controls opt out with the data-capture-exclude attribute so the saved image
// shows content without interactive chrome. Local-only: nothing is uploaded.
export async function saveElementAsPng(element: HTMLElement, name: string) {
  await document.fonts?.ready;
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    skipFonts: true,
    backgroundColor: getComputedStyle(document.documentElement).backgroundColor,
    filter: (node) =>
      !(
        node instanceof HTMLElement && node.hasAttribute("data-capture-exclude")
      ),
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return dataUrl;
}
