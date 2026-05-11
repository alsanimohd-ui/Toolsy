import { Metadata } from "next";
import RegexStudioClient from "./client-page";

export const metadata: Metadata = {
  title: "Regex Studio | Toolsy",
  description: "World-class regex debugging and pattern analysis workstation. Write, test, and debug regular expressions in real-time.",
};

export default function RegexStudioPage() {
  return <RegexStudioClient />;
}
