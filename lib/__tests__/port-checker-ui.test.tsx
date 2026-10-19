import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PortCheckerClient from "@/app/tools/network-security/port-checker/client-page";

const fill = (host: string, ports: string) => {
  fireEvent.change(screen.getByPlaceholderText(/localhost, 192\.168/), { target: { value: host } });
  fireEvent.change(screen.getByPlaceholderText(/3000, 5432/), { target: { value: ports } });
};

describe("PortChecker UI", () => {
  it("picks the browser for local hosts and the server for public ones", () => {
    render(<PortCheckerClient />);

    fill("localhost", "3000");
    expect(screen.getByRole("radio", { name: "My browser" }).getAttribute("aria-checked")).toBe("true");

    fill("example.com", "443");
    expect(screen.getByRole("radio", { name: "Our server" }).getAttribute("aria-checked")).toBe("true");
  });

  it("explains that UDP is not possible from the browser", async () => {
    render(<PortCheckerClient />);

    fill("127.0.0.1", "53");
    fireEvent.click(screen.getByRole("radio", { name: "UDP" }));
    fireEvent.click(screen.getByRole("button", { name: /Check ports/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/cannot send UDP/i);
  });
});
