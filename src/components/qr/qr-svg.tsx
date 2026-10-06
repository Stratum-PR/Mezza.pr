import type { QrRender } from "@/lib/qr/render";

/** Draws the shared QR shapes as inline SVG (the PDF renderer draws the same shapes). */
export function QrSvg({ render, label, className }: { render: QrRender; label: string; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${render.size} ${render.size}`}
      role="img"
      aria-label={label}
      className={className}
      shapeRendering="geometricPrecision"
    >
      {render.shapes.map((s, i) => {
        switch (s.kind) {
          case "rect":
            return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />;
          case "circle":
            return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />;
          case "ring":
            return <path key={i} d={s.d} fill={s.fill} fillRule="evenodd" />;
          case "text":
            return (
              <text
                key={i}
                x={s.x}
                y={s.y}
                fontSize={s.size}
                fontFamily="Georgia, serif"
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                fill={s.fill}
              >
                {s.text}
              </text>
            );
          case "image":
            return (
              <image
                key={i}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                href={s.href}
                preserveAspectRatio="xMidYMid meet"
              />
            );
        }
      })}
    </svg>
  );
}
