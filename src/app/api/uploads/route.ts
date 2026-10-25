import { guard } from "@/server/session";
import { MAX_UPLOAD_BYTES, upload, UploadForbiddenError, UploadTooLargeError } from "@/server/uploads";

// POST a SavedVariables file (multipart field `file`) for the upload screen (WEB-19). Admin, members and guests with
// "may upload" (WEB-06). A readable file that is not the uploader's own or of another community comes back as
// `status: "rejected"` with its `rejection`.

export async function POST(req: Request): Promise<Response> {
  const caller = await guard(req, "upload");
  if (caller instanceof Response) return caller;

  const length = Number(req.headers.get("content-length") ?? "0");
  // Multipart framing adds a little; the file itself is checked exactly below.
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return tooLarge();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Send the file as multipart form data, field "file".' }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: 'No file in field "file".' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return tooLarge();

  try {
    return Response.json(upload(caller.db, new Uint8Array(await file.arrayBuffer()), caller.battleTag));
  } catch (e) {
    if (e instanceof UploadTooLargeError) return tooLarge();
    if (e instanceof UploadForbiddenError) return Response.json({ error: "You may not upload." }, { status: 403 });
    throw e;
  }
}

function tooLarge(): Response {
  return Response.json({ error: `The file is larger than ${MAX_UPLOAD_BYTES} bytes.` }, { status: 413 });
}
