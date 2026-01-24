/**
 * useExport Hook
 *
 * Handles exporting the canvas diagram as a PNG image.
 */

import { useCallback, RefObject } from "react";
import { ElkLayoutResult } from "@/lib/elk";
import { STATUS_ITEMS } from "@/lib/statusUtils";

interface UseExportOptions {
  /** Ref to the export container element */
  exportRef: RefObject<HTMLDivElement | null>;
  /** Current layout result */
  layout: ElkLayoutResult | null;
  /** Epic title for the filename */
  epicTitle: string;
  /** Callback to set exporting state in context */
  setIsExporting: (value: boolean) => void;
}

interface UseExportReturn {
  /** Export the diagram as PNG */
  handleExport: () => Promise<void>;
}

export function useExport({
  exportRef,
  layout,
  epicTitle,
  setIsExporting,
}: UseExportOptions): UseExportReturn {
  const handleExport = useCallback(async () => {
    if (!exportRef.current || !layout) return;

    setIsExporting(true);

    try {
      const exportContainer = exportRef.current;
      const svgElement = exportContainer.querySelector("svg");

      if (!svgElement) {
        console.error("No SVG element found for export");
        setIsExporting(false);
        return;
      }

      // Clone SVG and add background
      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

      const bgRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      bgRect.setAttribute("width", "100%");
      bgRect.setAttribute("height", "100%");
      bgRect.setAttribute("fill", "#09090b");
      svgClone.insertBefore(bgRect, svgClone.firstChild);

      // Create canvas for export
      const canvas = document.createElement("canvas");
      const scale = 2;
      const padding = 24;
      const legendWidth = 120;
      const legendHeight = 100;

      canvas.width = (layout.canvasWidth + legendWidth + padding * 3) * scale;
      canvas.height = (layout.canvasHeight + padding * 2) * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Could not get canvas context");
        setIsExporting(false);
        return;
      }

      // Fill background
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      // Create blob and URL
      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Load SVG as image
      const svgImage = new Image();
      svgImage.onload = () => {
        // Draw SVG
        ctx.drawImage(
          svgImage,
          padding * scale,
          padding * scale,
          layout.canvasWidth * scale,
          layout.canvasHeight * scale,
        );

        // Draw legend
        const legendX = (layout.canvasWidth + padding * 2) * scale;
        const legendY = padding * scale;

        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = "#27272a";
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.roundRect(
          legendX,
          legendY,
          legendWidth * scale,
          legendHeight * scale,
          6 * scale,
        );
        ctx.fill();
        ctx.stroke();

        ctx.font = `${11 * scale}px system-ui, -apple-system, sans-serif`;

        STATUS_ITEMS.forEach((item, index) => {
          const itemY = legendY + (16 + index * 20) * scale;

          ctx.fillStyle = item.hexColor;
          ctx.beginPath();
          ctx.roundRect(
            legendX + 12 * scale,
            itemY,
            12 * scale,
            12 * scale,
            2 * scale,
          );
          ctx.fill();

          ctx.fillStyle = "#fafafa";
          ctx.fillText(item.label, legendX + 32 * scale, itemY + 10 * scale);
        });

        // Download
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `${epicTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-diagram.png`;
        link.href = dataUrl;
        link.click();

        URL.revokeObjectURL(svgUrl);
        setIsExporting(false);
      };

      svgImage.onerror = (err) => {
        console.error("Failed to load SVG for export:", err);
        URL.revokeObjectURL(svgUrl);
        setIsExporting(false);
      };

      svgImage.src = svgUrl;
    } catch (err) {
      console.error("Failed to export diagram:", err);
      setIsExporting(false);
    }
  }, [exportRef, layout, epicTitle, setIsExporting]);

  return { handleExport };
}
