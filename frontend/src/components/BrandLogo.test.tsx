import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrandLogo } from "./BrandLogo";
import { brand } from "@/theme/brand";

describe("BrandLogo", () => {
  it("renders an img with the brand logo by default", () => {
    render(<BrandLogo variant="full" />);
    const img = screen.getByRole("img", { name: brand.identity.appName });
    expect(img).toHaveAttribute("src", brand.identity.logo);
  });

  it("falls back to a shortName monogram when the image fails to load", () => {
    render(<BrandLogo variant="mark" />);
    fireEvent.error(screen.getByRole("img"));
    // After error, the img is replaced by the monogram span (first letter).
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(brand.identity.shortName.slice(0, 1).toUpperCase())).toBeInTheDocument();
  });
});
