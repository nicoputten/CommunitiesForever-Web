import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";
import { MAP_CREDIT, type Crop } from "@/core/cards/mapCrop";
import { cardSize, type CardSpec, type Disc, type FeatCardSpec, type FeatIcon } from "@/core/cards/models";
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

const SHIELD = "M13 2l9 4v7c0 6-4 9-9 11C8 22 4 19 4 13V6z";
const STAR = "M13 10.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z";
const STARS = [
  [10.4, 7.6],
  [15.6, 7.6],
  [10.4, 12.8],
  [15.6, 12.8],
];

/**
 * The drawn icons of the feat cards: rank badges, the first epic, epic mount, Jack of all trades, Arcanite Reaper and
 * 10,000 kills as the board doomsday-feat-cards draws them; the Arcanite Bar, Mooncloth, Devilsaur leather, the
 * Extravaganza's fish and pole, and the numbered badges of ranks 7 to 13 in the same style (Nico, 2026-10-28).
 */
function FeatIconSvg({ icon, rank, size }: { icon: FeatIcon; rank?: number; size: number }) {
  const line = tok("--gold-bright");
  const fill = tok("--card-icon-fill");
  if (icon === "rank") {
    const top = (rank ?? 0) >= 14;
    const numbered = !top && rank !== undefined && rank !== 6;
    return (
      <div style={{ display: "flex", position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 26 26">
          <path
            d={SHIELD}
            fill={top ? tok("--gold-pale") : tok("--gold")}
            stroke={tok("--card-badge-line")}
            strokeWidth={0.8}
          />
          {top
            ? STARS.map(([x, y], i) => (
                <path
                  key={i}
                  transform={`translate(${x} ${y}) scale(.85) translate(-13 -10.5)`}
                  d={STAR}
                  fill={tok("--on-gold")}
                />
              ))
            : null}
          {rank === 6 ? <circle cx={13} cy={13} r={1.4} fill={tok("--on-gold")} /> : null}
        </svg>
        {numbered ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              width: size,
              height: size * 0.92,
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SC,
              fontSize: size * 0.3,
              color: tok("--on-gold"),
            }}
          >
            {rank}
          </div>
        ) : null}
      </div>
    );
  }
  const paths: Record<Exclude<FeatIcon, "rank">, ReactNode> = {
    epic: (
      <>
        <path
          d="M14 10h36l-4 14 6 30H12l6-30z"
          fill={tok("--epic-deep")}
          stroke={tok("--epic")}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <path d="M22 10l10 12 10-12" fill="none" stroke={tok("--epic")} strokeWidth={2.4} />
        <path d="M32 22v32" stroke={tok("--epic")} strokeWidth={1.6} opacity={0.6} />
      </>
    ),
    mount: (
      <>
        <path
          d="M8 48c4-14 12-20 22-20l6-10 6 4-2 7c8 3 12 9 12 19"
          fill={fill}
          stroke={line}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <path d="M16 48v8M46 48v8M26 48v8" stroke={line} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M42 21l6-6" stroke={tok("--gold")} strokeWidth={2} />
      </>
    ),
    jack: (
      <>
        <circle cx={32} cy={32} r={24} fill={fill} stroke={line} strokeWidth={2.2} />
        <path
          d="M20 26h12l-2 14h-8z M38 22c4 4 8 10 4 18M30 46c6 2 14 0 16-6"
          fill="none"
          stroke={line}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <path d="M24 22v-6M28 22v-8" stroke={tok("--gold")} strokeWidth={2} strokeLinecap="round" />
      </>
    ),
    reaper: (
      <>
        <path d="M14 56L44 10" stroke={line} strokeWidth={3} strokeLinecap="round" />
        <path
          d="M40 14c10 0 16 6 18 14-8-6-14-6-22-4z"
          fill={tok("--card-steel")}
          stroke={tok("--card-arcanite")}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle cx={14} cy={56} r={3} fill={tok("--gold")} />
      </>
    ),
    kills: (
      <>
        <path d="M32 6l22 9v16c0 15-10 22-22 27C20 53 10 46 10 31V15z" fill={fill} stroke={line} strokeWidth={2.2} />
        <path d="M22 22l20 20M42 22L22 42" stroke={tok("--card-blood")} strokeWidth={3.2} strokeLinecap="round" />
      </>
    ),
    bar: (
      <>
        <path
          d="M10 42l8-16h28l8 16z"
          fill={tok("--card-steel")}
          stroke={tok("--card-arcanite")}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path
          d="M10 42h44v6H10z"
          fill={fill}
          stroke={tok("--card-arcanite")}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path d="M24 32h10" stroke={line} strokeWidth={2} strokeLinecap="round" />
      </>
    ),
    cloth: (
      <>
        <path
          d="M12 18c8-4 32-4 40 0v28c-8 4-32 4-40 0z"
          fill={fill}
          stroke={line}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path d="M12 28c8 4 32 4 40 0M12 38c8 4 32 4 40 0" fill="none" stroke={tok("--gold")} strokeWidth={1.6} />
        <circle cx={44} cy={14} r={5} fill="none" stroke={line} strokeWidth={2} />
      </>
    ),
    leather: (
      <>
        <path
          d="M18 10l6 6h16l6-6 6 10-6 8 2 22-10 6H24l-10-6 2-22-6-8z"
          fill={fill}
          stroke={line}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path d="M26 30l4 4M34 26l4 4M28 42l4 4" stroke={tok("--gold")} strokeWidth={2} strokeLinecap="round" />
      </>
    ),
    fish: (
      <>
        <path
          d="M8 32c8-12 26-14 38-4l10-8v24l-10-8c-12 10-30 8-38-4z"
          fill={fill}
          stroke={line}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <circle cx={18} cy={30} r={2} fill={tok("--gold")} />
        <path d="M26 26c2 4 2 8 0 12" fill="none" stroke={tok("--gold")} strokeWidth={1.6} />
      </>
    ),
    pole: (
      <>
        <path d="M10 56L50 8" stroke={line} strokeWidth={3} strokeLinecap="round" />
        <path d="M50 8c4 10 4 22 0 34" fill="none" stroke={tok("--card-arcanite")} strokeWidth={1.6} />
        <path
          d="M50 42c-2 4-6 4-6 0"
          fill="none"
          stroke={tok("--card-arcanite")}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={16} cy={49} r={4} fill={fill} stroke={tok("--gold")} strokeWidth={2} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {paths[icon]}
    </svg>
  );
}

/** A feat card (WEB-56) as the board doomsday-feat-cards lays it out. */
function FeatCard({ spec, width, height }: { spec: FeatCardSpec; width: number; height: number }) {
  const box = px("--size-card-icon-box");
  const frame = spec.special
    ? `inset 0 0 0 2px ${tok("--gold-bright")}, inset 0 0 0 6px ${tok("--card-frame-special")}`
    : `inset 0 0 0 2px ${tok("--card-frame")}`;
  return (
    <Frame width={width} height={height}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width, height, boxShadow: frame }} />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: box,
          height,
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: PAD / 2,
          backgroundImage: `radial-gradient(circle at 50% 46%, ${tok(spec.glow)}, transparent 62%)`,
        }}
      >
        <FeatIconSvg
          icon={spec.icon}
          {...(spec.rank !== undefined ? { rank: spec.rank } : {})}
          size={px("--size-card-icon")}
        />
      </div>
      {spec.firstInGroup ? (
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: PAD * 0.65,
            top: PAD * 0.6,
            padding: `${PAD / 5}px ${PAD * 0.3}px`,
            borderRadius: PAD,
            background: tok("--card-pill-bg"),
            border: `1.5px solid ${tok("--gold")}`,
            color: tok("--gold-pale"),
            fontSize: px("--fs-card-pill"),
            fontWeight: 600,
            letterSpacing: px("--fs-card-pill") * 0.1,
            textTransform: "uppercase",
          }}
        >
          First in the group
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: box - PAD / 4,
          top: PAD * 1.75,
          right: PAD * 0.75,
          gap: PAD / 7,
        }}
      >
        <Overline>Feat unlocked</Overline>
        <div
          style={{
            display: "flex",
            fontFamily: SC,
            fontSize: px(spec.longTitle ? "--fs-card-award" : "--fs-card-feat-title"),
            lineHeight: 1.05,
            color: tok(spec.titleColour),
            textShadow: `0 0 ${PAD * 0.75}px ${tok(spec.glow)}`,
          }}
        >
          {spec.title}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: NAME,
            fontSize: px("--fs-card-feat-name"),
            color: tok(spec.nameColour),
            marginTop: PAD / 7,
          }}
        >
          {spec.name}
        </div>
        <div
          style={{ display: "flex", fontSize: px("--fs-card-feat-line"), color: tok("--text"), marginTop: PAD / 10 }}
        >
          {spec.line}
        </div>
        {spec.meta !== undefined ? (
          <div style={{ display: "flex", fontSize: px("--fs-card-feat-meta"), color: tok("--text-muted") }}>
            {spec.meta}
          </div>
        ) : null}
      </div>
      <Footer host={spec.host} />
    </Frame>
  );
}

function card(spec: CardSpec): ReactNode {
  const { width, height } = cardSize(spec);
  switch (spec.kind) {
    case "feat":
      return <FeatCard spec={spec} width={width} height={height} />;
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
