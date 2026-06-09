import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierForm } from "../SupplierForm";

// Mock ProfileContext so we don't need context provider wrapper
vi.mock("../../../context/ProfileContext", () => ({
  useProfile: () => ({
    user: { id: "test-user-id" },
    isAdmin: true,
    role: "admin",
    orgId: "test-org-id",
    isLoading: false,
  }),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SupplierForm", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function renderForm(props: React.ComponentProps<typeof SupplierForm>) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<SupplierForm {...props} />);
    });

    return {
      container,
      root,
    };
  }

  it("renders form fields correctly", () => {
    const { container, root } = renderForm({
      onSubmit: async () => {},
    });

    expect(container.querySelector('[data-testid="supplier-name"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-slug"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-email"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-logo-url"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-brand-colour"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-trust-tier"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="supplier-status"]')).not.toBeNull();

    act(() => root.unmount());
  });

  it("auto-slugifies name input during creation", async () => {
    const { container, root } = renderForm({
      onSubmit: async () => {},
    });

    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-name"]');
    const slugInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-slug"]');

    expect(nameInput).not.toBeNull();
    expect(slugInput).not.toBeNull();

    await act(async () => {
      setInputValue(nameInput!, "Super Fencing Supply Co");
    });

    // Wait a brief tick for react-hook-form to process
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(slugInput!.value).toBe("super-fencing-supply-co");

    act(() => root.unmount());
  });

  it("surfaces inline validations on invalid inputs", async () => {
    const { container, root } = renderForm({
      onSubmit: async () => {},
    });

    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-name"]');
    const emailInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-email"]');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    await act(async () => {
      // Clear name to trigger "Name is required"
      setInputValue(nameInput!, "");

      // Set invalid email
      setInputValue(emailInput!, "not-an-email");
    });

    await act(async () => {
      submitBtn!.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain("Name is required");
    expect(container.textContent).toContain("Must be a valid email");

    act(() => root.unmount());
  });

  it("calls onSubmit with parsed values on valid submission", async () => {
    let submittedData: any = null;
    const handleSubmit = async (data: any) => {
      submittedData = data;
    };

    const { container, root } = renderForm({
      onSubmit: handleSubmit,
    });

    const nameInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-name"]');
    const emailInput = container.querySelector<HTMLInputElement>('[data-testid="supplier-email"]');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    await act(async () => {
      setInputValue(nameInput!, "Valid Supplier");
      setInputValue(emailInput!, "valid@supplier.com");
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      submitBtn!.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(submittedData).not.toBeNull();
    expect(submittedData.name).toBe("Valid Supplier");
    expect(submittedData.slug).toBe("valid-supplier");
    expect(submittedData.contactEmail).toBe("valid@supplier.com");

    act(() => root.unmount());
  });

  it("renders promote/demote buttons for admin and updates values", async () => {
    const { container, root } = renderForm({
      initialData: {
        trustTier: "community",
      },
      onSubmit: async () => {},
    });

    // Wait a brief tick for render
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const select = container.querySelector<HTMLSelectElement>('[data-testid="supplier-trust-tier"]');
    expect(select!.value).toBe("community");

    const promoteBtn = container.querySelector<HTMLButtonElement>('[data-testid="promote-supplier-btn"]');
    expect(promoteBtn).not.toBeNull();
    expect(promoteBtn!.textContent).toBe("Promote to Verified");

    await act(async () => {
      promoteBtn!.click();
    });

    // Wait for state updates
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(select!.value).toBe("verified");
    
    // Now that it's verified, demote button should be visible
    const demoteBtn = container.querySelector<HTMLButtonElement>('[data-testid="demote-supplier-btn"]');
    expect(demoteBtn).not.toBeNull();
    expect(demoteBtn!.textContent).toBe("Demote to Community");

    await act(async () => {
      demoteBtn!.click();
    });

    // Wait for state updates
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(select!.value).toBe("community");

    act(() => root.unmount());
  });
});
