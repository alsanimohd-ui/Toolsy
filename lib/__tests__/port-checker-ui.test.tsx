import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PortCheckerClient from "@/app/tools/network-security/port-checker/client-page";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock framer-motion to avoid animation issues in test
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("PortChecker UI", () => {
  it("displays warning card when UDP is selected in Local (Browser) mode", async () => {
    render(<PortCheckerClient />);

    // Click "Local (Browser)" mode button
    const localModeBtn = screen.getByText("Local (Browser)");
    fireEvent.click(localModeBtn);

    // Click "UDP" protocol button
    const udpBtn = screen.getByText("UDP");
    fireEvent.click(udpBtn);

    // Verify that the warning message is displayed in the UI
    const warning = screen.getByText(/UDP scanning is technically unsupported inside browser sandboxes/i);
    expect(warning).toBeDefined();
  });

  it("returns structured scan error status and explanation when attempting UDP scan in Local mode", async () => {
    render(<PortCheckerClient />);

    // Switch to Local mode and UDP protocol
    fireEvent.click(screen.getByText("Local (Browser)"));
    fireEvent.click(screen.getByText("UDP"));

    // Enter target host and port
    const hostInput = screen.getByPlaceholderText("e.g. scanme.nmap.org");
    fireEvent.change(hostInput, { target: { value: "127.0.0.1" } });

    // The ports input is queried by placeholder or generic selector
    const portInput = screen.getByPlaceholderText("e.g. 80,443,8080-8090");
    fireEvent.change(portInput, { target: { value: "53" } });

    // Click "Initiate Scan"
    const scanBtn = screen.getByRole("button", { name: /Initiate Scan/i });
    fireEvent.click(scanBtn);

    // Verify that the structured error result is listed
    const errorStatuses = await screen.findAllByText("ERROR");
    expect(errorStatuses.length).toBeGreaterThan(0);

    const desc = screen.getByText(/browser sandbox environment/i);
    expect(desc).toBeDefined();
  });
});
