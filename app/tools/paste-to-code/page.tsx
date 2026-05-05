import { Metadata } from "next";
import PasteToCodeClient from "./client-page";

export const metadata: Metadata = {
  title: "Paste Data → Get Code | Toolsy",
  description: "Paste messy data and instantly convert it into clean code like JSON, TS, SQL, or PHP.",
};

export default function PasteToCodePage() {
  return <PasteToCodeClient />;
}
