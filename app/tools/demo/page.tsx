"use client";

import {
  ToolContainer,
  ToolHeader,
  ToolSection,
  ToolButton,
  ToolTextarea,
} from "@/components/tools";

/**
 * Demo page — showcases the full tool layout system.
 * Remove or replace this file once real tools are added.
 */
export default function DemoToolPage() {
  return (
    <ToolContainer>
      <ToolHeader
        title="Demo Tool"
        description="This page demonstrates the shared layout system for all Toolsy tools. Every tool follows this exact structure for visual consistency."
        badge="Demo"
      />

      {/* Input section */}
      <ToolSection
        title="Input"
        description="Paste or type your content here."
      >
        <ToolTextarea
          label="Your text"
          placeholder="Enter some text to process..."
          hint="Supports plain text. Max recommended: 50,000 characters."
          rows={6}
          showCount
          value=""
          onChange={() => {}}
        />

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-3">
          <ToolButton variant="primary">
            Run Tool
          </ToolButton>
          <ToolButton variant="secondary">
            Clear
          </ToolButton>
          <ToolButton variant="ghost" size="sm">
            Copy Input
          </ToolButton>
        </div>
      </ToolSection>

      {/* Output section */}
      <ToolSection
        title="Output"
        description="Results will appear here after processing."
      >
        <ToolTextarea
          label="Result"
          placeholder="Output will appear here…"
          rows={6}
          readOnly
          value=""
        />

        <div className="flex flex-wrap items-center gap-3">
          <ToolButton variant="secondary" size="sm">
            Copy Output
          </ToolButton>
          <ToolButton variant="ghost" size="sm">
            Download
          </ToolButton>
          <ToolButton variant="danger" size="sm">
            Clear Output
          </ToolButton>
        </div>
      </ToolSection>

      {/* Loading state demo */}
      <ToolSection title="Component States">
        <div className="flex flex-wrap gap-3">
          <ToolButton variant="primary" loading>
            Processing…
          </ToolButton>
          <ToolButton variant="primary" disabled>
            Disabled
          </ToolButton>
          <ToolButton variant="secondary" size="lg">
            Large Secondary
          </ToolButton>
          <ToolButton variant="danger" size="sm">
            Delete
          </ToolButton>
        </div>

        <ToolTextarea
          label="Error state"
          placeholder="Bad input here…"
          error="Invalid format: expected valid JSON."
          rows={3}
        />
      </ToolSection>
    </ToolContainer>
  );
}
