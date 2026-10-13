/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourceForm } from "@/components/forms/resource-form-dialog";
import { formSpecsFor, RESOURCE_FORM_POLICIES } from "@/features/resources/resource-form-policy";
import { I18nProvider } from "@/i18n/provider";
import { AppApiError } from "@/lib/api/errors";

// jsdom has no ResizeObserver, which Radix's Switch uses.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

afterEach(cleanup);

const renderForm = (props: Partial<React.ComponentProps<typeof ResourceForm>> = {}) => {
  const onSubmit = vi.fn();
  const utils = render(
    <I18nProvider locale="en">
      <ResourceForm specs={formSpecsFor("academic-years", "create")} mode="create" crossRules={RESOURCE_FORM_POLICIES["academic-years"].crossRules} onSubmit={onSubmit} {...props} />
    </I18nProvider>,
  );
  return { onSubmit, ...utils };
};

describe("ResourceForm", () => {
  it("blocks an empty submit and shows inline errors wired with aria-invalid and aria-describedby", async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const name = screen.getByLabelText(/Name/u);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    const describedBy = name.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)?.textContent).toBe("This field is required.");
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
  });

  it("submits typed values once valid and clears the error when the field is edited", async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.type(screen.getByLabelText(/Name/u), "First year");
    expect(screen.getByLabelText(/Name/u).getAttribute("aria-invalid")).toBeNull();
    await userEvent.type(screen.getByLabelText(/Order/u), "1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "First year", order: 1, is_active: true });
  });

  it("reports a non-numeric order and an out-of-range one", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/Name/u), "Y");
    await userEvent.type(screen.getByLabelText(/Order/u), "12x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter a whole number.")).toBeTruthy();
    await userEvent.clear(screen.getByLabelText(/Order/u));
    await userEvent.type(screen.getByLabelText(/Order/u), "99999");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Must be at most 32767.")).toBeTruthy();
  });

  it("is disabled while pending", () => {
    renderForm({ pending: true });
    expect((screen.getByRole("button", { name: /Save/u }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Name/u) as HTMLInputElement).disabled).toBe(true);
  });

  it("shows backend field errors next to the field and a 403 explanation", () => {
    const conflict = new AppApiError({ status: 400, code: "VALIDATION_ERROR", message: "Validation error", errors: { order: ["academic year with this order already exists."] } });
    const { unmount } = renderForm({ serverError: conflict });
    const order = screen.getByLabelText(/Order/u);
    expect(order.getAttribute("aria-invalid")).toBe("true");
    expect(order.getAttribute("aria-describedby")).toContain("field-order-error");
    expect(document.getElementById("field-order-error")?.textContent).toBe("academic year with this order already exists.");
    unmount();
    renderForm({ serverError: new AppApiError({ status: 403, message: "Permission denied" }) });
    expect(screen.getByText(/not allowed/u)).toBeTruthy();
  });

  it("asks for confirmation before submitting when a confirm text is provided", async () => {
    const { onSubmit } = renderForm({ confirm: () => "Really publish?" });
    await userEvent.type(screen.getByLabelText(/Name/u), "Y");
    await userEvent.type(screen.getByLabelText(/Order/u), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Really publish?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("does not submit an unchanged edit", async () => {
    const entity = { id: 4, name: "Second year", order: 2, is_active: true };
    const { onSubmit } = renderForm({ mode: "edit", entity, specs: formSpecsFor("academic-years", "edit") });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Nothing has changed, so there is nothing to save.")).toBeTruthy();
    await userEvent.clear(screen.getByLabelText(/Name/u));
    await userEvent.type(screen.getByLabelText(/Name/u), "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Renamed" });
  });
});
