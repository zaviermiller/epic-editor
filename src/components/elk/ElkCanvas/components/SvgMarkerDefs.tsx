/**
 * SvgMarkerDefs Component
 *
 * SVG marker definitions for arrows/arrowheads used in edge rendering.
 */

interface SvgMarkerDefsProps {
  /** Whether this is for export (uses explicit colors instead of CSS variables) */
  forExport?: boolean;
}

export function SvgMarkerDefs({ forExport = false }: SvgMarkerDefsProps) {
  if (forExport) {
    return (
      <defs>
        <marker
          id="export-arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polyline
            points="1 1, 9 5, 1 9"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <marker
          id="export-arrowhead-batch"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polyline
            points="2 2, 10 6, 2 10"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    );
  }

  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polyline
          points="1 1, 9 5, 1 9"
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id="arrowhead-highlighted"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polyline
          points="1 1, 9 5, 1 9"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id="arrowhead-batch"
        markerWidth="12"
        markerHeight="12"
        refX="10"
        refY="6"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polyline
          points="2 2, 10 6, 2 10"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id="arrowhead-pending"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polyline
          points="1 1, 9 5, 1 9"
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
      <marker
        id="arrowhead-snip"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polyline
          points="1 1, 9 5, 1 9"
          fill="none"
          stroke="#f87171"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </marker>
    </defs>
  );
}
