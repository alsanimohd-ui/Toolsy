import { Metadata } from "next";
import ApiRequestLabClient from "./client-page";

export const metadata: Metadata = {
  title: "API Request Lab | Toolsy",
  description: "Cinematic next-generation API engineering workstation. Test, debug, and analyze RESTful endpoints in real-time.",
};

export default function ApiRequestLabPage() {
  return <ApiRequestLabClient />;
}
