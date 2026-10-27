import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import { MAP_CREDIT, type Crop } from "@/core/cards/mapCrop";
import { cardSize, type CardSpec, type Disc } from "@/core/cards/models";
import { px, tok } from "@/core/cards/palette";

// The card images (WEB-41d): CardSpecs (src/core/cards/models.ts) drawn with Next's built-in `next/og` (Satori and
// resvg, no extra dependency) into PNGs. Every value comes from the tokens (src/core/cards/palette.ts); the fonts are
// the site's own, bundled under ./fonts (SIL OFL) and traced into the standalone build (next.config.ts).

const FONT_DIR = path.join(process.cwd(), "src", "server", "cards", "fonts");

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" };
let fonts: Promise<Font[]> | undefined;

function loadFonts(): Promise<Font[]> {
  const file = async (name: string, file: string, weight: 400 | 600): Promise<Font> => {
    const buf = await readFile(path.join(FONT_DIR, file));
    return {
      name,
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      weight,
      style: "normal",
    };
  };
  fonts ??= Promise.all([
    file("Marcellus SC", "MarcellusSC-Regular.ttf", 400),
    file("Marcellus", "Marcellus-Regular.ttf", 400),
    file("Inter", "Inter-Regular.woff", 400),
    file("Inter", "Inter-SemiBold.woff", 600),
  ]);
  return fonts;
}

const SC = "Marcellus SC";
const NAME = "Marcellus";
const UI = "Inter";
const PAD = px("--card-pad");
const RING = px("--size-card-ring");

function Frame({ children, width, height }: { children: ReactNode; width: number; height: number }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        background: `radial-gradient(circle at 30% 0%, ${tok("--page-glow")}, ${tok("--bg-night")} 70%)`,
        border: `1px solid ${tok("--line-box")}`,
        fontFamily: UI,
        color: tok("--text"),
      }}
    >
      {children}
    </div>
  );
}

function Footer({ host, credit }: { host: string; credit?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        bottom: PAD * 0.6,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: px("--fs-card-meta"),
        color: tok("--text-dim"),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: PAD / 4 }}>
        <svg width={px("--fs-card-meta")} height={px("--fs-card-meta")} viewBox="0 0 26 26" fill="none">
          <path d="M13 2l9 4v7c0 6-4 9-9 11C8 22 4 19 4 13V6z" stroke={tok("--gold")} strokeWidth={2} />
          <path d="M13 7v12M8 12h10" stroke={tok("--gold")} strokeWidth={2} />
        </svg>
        {host}
      </div>
      {credit === true ? <div style={{ display: "flex" }}>{MAP_CREDIT}</div> : <div style={{ display: "flex" }} />}
    </div>
  );
}

function BigDisc({ disc, size = px("--size-card-disc") }: { disc: Disc; size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        background: tok(disc.fill),
        border: `${RING}px solid ${tok("--gold")}`,
        boxShadow: `0 0 ${PAD * 2}px ${tok("--card-glow")}`,
        color: tok(disc.on),
        fontSize: (px("--fs-card-initials") * size) / px("--size-card-disc"),
        fontWeight: 600,
      }}
    >
      {disc.initials}
    </div>
  );
}

function Overline({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: px("--fs-card-overline"),
        fontWeight: 600,
        letterSpacing: px("--fs-card-overline") * 0.14,
        textTransform: "uppercase",
        color: tok("--gold"),
      }}
    >
      {children}
    </div>
  );
}

function MapCrop({ crop, width, height }: { crop: Crop; width: number; height: number }) {
  const v = crop.viewBox;
  const stroke = v.w / width;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {crop.zones.map((z) => (
        <path
          key={z.id}
          d={z.d}
          fill={z.highlight ? tok("--card-zone") : tok("--card-land")}
          stroke={z.highlight ? tok("--gold-bright") : tok("--card-land-line")}
          strokeWidth={z.highlight ? stroke * 4 : stroke * 1.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function card(spec: CardSpec): ReactNode {
  const { width, height } = cardSize(spec);
  switch (spec.kind) {
    case "milestone":
    case "award": {
      const award = spec.kind === "award";
      return (
        <Frame width={width} height={height}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: PAD * 1.3,
              padding: `0 ${PAD * 1.4}px`,
              height: height - PAD,
            }}
          >
            <BigDisc disc={spec.disc} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: PAD / 5,
                maxWidth: width - px("--size-card-disc") - PAD * 5,
              }}
            >
              <Overline>{spec.overline}</Overline>
              <div
                style={{
                  display: "flex",
                  fontFamily: SC,
                  fontSize: px(award || spec.title.length > 10 ? "--fs-card-award" : "--fs-card-title"),
                  whiteSpace: "nowrap",
                  color: tok("--gold-pale"),
                }}
              >
                {spec.title}
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: NAME,
                  fontSize: px(award ? "--fs-card-title" : "--fs-card-name") * (award ? 0.75 : 1),
                  color: award ? tok("--text-strong") : tok(spec.nameColour),
                }}
              >
                {spec.name}
              </div>
              {award ? (
                <div style={{ display: "flex", fontSize: px("--fs-card-stat"), color: tok("--text") }}>{spec.stat}</div>
              ) : (
                spec.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      fontSize: px(i === 0 ? "--fs-card-line" : "--fs-card-meta"),
                      color: i === 0 ? tok("--text-strong") : tok("--text-dim"),
                    }}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
          <Footer host={spec.host} />
        </Frame>
      );
    }
    case "zoneHeader":
    case "zone": {
      const header = spec.kind === "zoneHeader";
      const mapWidth = header ? width * 0.45 : width;
      return (
        <Frame width={width} height={height}>
          <div style={{ display: "flex", position: "absolute", top: 0, right: 0, width: mapWidth, height }}>
            <MapCrop crop={spec.crop} width={mapWidth} height={height} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: header ? "center" : "space-between",
              gap: PAD / 5,
              padding: PAD,
              height: height - PAD,
            }}
          >
            <Overline>{spec.overline}</Overline>
            <div style={{ display: "flex", flexDirection: "column", gap: PAD / 5 }}>
              {spec.label !== undefined && (
                <div style={{ display: "flex", fontSize: px("--fs-card-stat") * 0.9, color: tok("--text-muted") }}>
                  {spec.label}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  fontFamily: SC,
                  fontSize: px("--fs-card-title"),
                  color: tok("--gold-pale"),
                  textShadow: `0 0 ${PAD / 2}px ${tok("--card-glow")}`,
                }}
              >
                {spec.zone}
              </div>
              <div style={{ display: "flex", fontSize: px("--fs-card-stat"), color: tok("--text") }}>{spec.stat}</div>
            </div>
          </div>
          <Footer host={spec.host} credit />
        </Frame>
      );
    }
    case "headline":
      return (
        <Frame width={width} height={height}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: PAD / 4,
              padding: PAD * 1.4,
              height: height - PAD,
            }}
          >
            <Overline>{spec.overline}</Overline>
            <div
              style={{ display: "flex", fontFamily: SC, fontSize: px("--fs-card-title"), color: tok("--gold-pale") }}
            >
              {spec.title}
            </div>
          </div>
          <Footer host={spec.host} />
        </Frame>
      );
    case "whereis":
      return (
        <Frame width={width} height={height}>
          <MapCrop crop={spec.crop} width={width} height={height} />
          {spec.markers.map((m, i) => (
            <Marker key={i} marker={m} width={width} height={height} fill={spec.disc.fill} />
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: PAD / 2,
              position: "absolute",
              top: PAD * 0.6,
              left: PAD * 0.75,
            }}
          >
            <BigDisc disc={spec.disc} size={px("--size-card-disc-small")} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: NAME,
                  fontSize: px("--fs-card-name"),
                  color: tok(spec.nameColour),
                }}
              >
                {spec.name}
              </div>
              <div style={{ display: "flex", fontSize: px("--fs-card-meta"), color: tok("--text-strong") }}>
                {spec.line}
              </div>
            </div>
          </div>
          <Footer host={spec.host} credit />
        </Frame>
      );
  }
}

function Marker({
  marker,
  width,
  height,
  fill,
}: {
  marker: { x: number; y: number; label: string; age: "now" | "recent" | "old" };
  width: number;
  height: number;
  fill: Disc["fill"];
}) {
  const size = px("--size-card-marker");
  const colour = marker.age === "old" ? tok("--stale") : tok(fill);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size / 3,
        position: "absolute",
        left: marker.x * width - size / 2,
        top: marker.y * height - size / 2,
      }}
    >
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: size,
          background: marker.age === "now" ? colour : "transparent",
          border: `${RING * 0.8}px ${marker.age === "old" ? "dashed" : "solid"} ${colour}`,
          boxShadow: marker.age === "now" ? `0 0 ${size}px ${colour}` : "none",
        }}
      />
      <div
        style={{
          display: "flex",
          padding: `${size / 8}px ${size / 2.5}px`,
          borderRadius: size,
          background: marker.age === "now" ? colour : tok("--card-label-bg"),
          border: `${RING / 3}px solid ${colour}`,
          color:
            marker.age === "now" ? tok("--on-gold") : marker.age === "old" ? tok("--stale-text") : tok("--text-strong"),
          fontSize: px("--fs-card-line"),
          fontWeight: 600,
        }}
      >
        {marker.label}
      </div>
    </div>
  );
}

/** The card as a PNG response; private and cached for a day (the bot fetches each once). */
export async function renderCard(spec: CardSpec): Promise<Response> {
  const { width, height } = cardSize(spec);
  const image = new ImageResponse(card(spec) as ReactElement, { width, height, fonts: await loadFonts() });
  const bytes = await image.arrayBuffer();
  return new Response(bytes, {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
