import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";

// A small streaming multipart/form-data reader (WEB-35): release files are written to disk as they arrive, never held
// in memory, and hashed on the way. Only file parts; fields are refused. No dependency (CLAUDE.md rule 9).

export interface ReceivedFile {
  /** The part's file name as sent (checked by the caller). */
  name: string;
  /** Where it was written. */
  path: string;
  size: number;
  /** Hex SHA-256. */
  sha256: string;
}

export class MultipartError extends Error {
  constructor(
    readonly code: "invalid_request" | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "MultipartError";
  }
}

const MAX_HEADER = 4 * 1024;

/** The boundary of a `multipart/form-data` Content-Type; undefined for any other type. */
export function boundaryOf(contentType: string | null): string | undefined {
  const m = /^multipart\/form-data\s*;.*boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType ?? "");
  return m?.[1] ?? m?.[2];
}

/**
 * Reads every file part of `body` into `dir` (one file per part, named by `nameFor`, which returns undefined to
 * refuse a name). At most `maxFiles` parts and `maxBytes` in all.
 */
export async function receiveFiles(
  body: ReadableStream<Uint8Array>,
  boundary: string,
  dir: string,
  nameFor: (sent: string) => string | undefined,
  { maxFiles = 8, maxBytes = 500 * 1024 * 1024 }: { maxFiles?: number; maxBytes?: number } = {},
): Promise<ReceivedFile[]> {
  const first = Buffer.from(`--${boundary}`);
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  const files: ReceivedFile[] = [];
  let buf: Buffer = Buffer.alloc(0);
  let state: "preamble" | "headers" | "body" | "done" = "preamble";
  let total = 0;
  let part:
    { file: Awaited<ReturnType<typeof open>>; hash: ReturnType<typeof createHash>; info: ReceivedFile } | undefined;

  const write = async (chunk: Buffer) => {
    if (chunk.length === 0 || part === undefined) return;
    part.info.size += chunk.length;
    part.hash.update(chunk);
    await part.file.write(chunk);
  };
  const close = async () => {
    if (part === undefined) return;
    await part.file.close();
    part.info.sha256 = part.hash.digest("hex");
    files.push(part.info);
    part = undefined;
  };

  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value !== undefined) {
        total += value.byteLength;
        if (total > maxBytes) throw new MultipartError("too_large", "The release is too large.");
        buf = Buffer.concat([buf, value]);
      }
      // Work through what is buffered; stop when more input is needed.
      for (;;) {
        if (state === "preamble") {
          const at = buf.indexOf(first);
          if (at < 0) break;
          buf = buf.subarray(at + first.length);
          state = "headers";
        } else if (state === "headers") {
          if (buf.length >= 2 && buf.subarray(0, 2).toString() === "--") {
            state = "done";
            break;
          }
          const end = buf.indexOf("\r\n\r\n");
          if (end < 0) {
            if (buf.length > MAX_HEADER) throw new MultipartError("invalid_request", "Part headers too long.");
            break;
          }
          const headers = buf.subarray(0, end).toString("utf8");
          buf = buf.subarray(end + 4);
          const sent = /filename="([^"]*)"/i.exec(headers)?.[1];
          if (sent === undefined) throw new MultipartError("invalid_request", "Only file parts.");
          const name = nameFor(sent);
          if (name === undefined) throw new MultipartError("invalid_request", `Not a release file: ${sent}`);
          if (files.length >= maxFiles || files.some((f) => f.name === sent)) {
            throw new MultipartError("invalid_request", "Too many or repeated files.");
          }
          const target = path.join(dir, name);
          part = {
            file: await open(target, "wx"),
            hash: createHash("sha256"),
            info: { name: sent, path: target, size: 0, sha256: "" },
          };
          state = "body";
        } else if (state === "body") {
          const at = buf.indexOf(delimiter);
          if (at >= 0) {
            await write(buf.subarray(0, at));
            buf = buf.subarray(at + delimiter.length);
            await close();
            state = "headers";
            // Skip the CRLF after the delimiter (the closing "--" is checked in headers).
            if (buf.subarray(0, 2).toString() === "\r\n") buf = buf.subarray(2);
            else if (buf.length < 2 && !done) break;
          } else {
            // Keep a tail that could be the start of the delimiter.
            const keep = Math.min(buf.length, delimiter.length - 1);
            await write(buf.subarray(0, buf.length - keep));
            buf = buf.subarray(buf.length - keep);
            break;
          }
        } else break;
      }
      if (done) break;
    }
    if (state !== "done") throw new MultipartError("invalid_request", "The form ended early.");
    return files;
  } finally {
    await part?.file.close();
  }
}
