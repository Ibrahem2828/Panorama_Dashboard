/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/shared/page-header";

describe("PageHeader", () => {
  it("renders an accessible page heading and action", () => {
    render(<PageHeader title="Dashboard" description="Overview" actionLabel="Refresh" onAction={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});
