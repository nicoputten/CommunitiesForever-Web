import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/app/viewer";
import { Placeholder } from "../placeholder";

export const metadata: Metadata = { title: "Upload" };

// Placeholder until the upload page (WEB-19). Only for those who may upload (WEB-06 replaces the check).
export default async function UploadPage() {
  if (!(await getViewer())?.mayUpload) notFound();
  return <Placeholder title="Upload" story="WEB-19" />;
}
