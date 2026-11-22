// @vitest-environment node
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import CalculatorView from "../../src/components/CalculatorView.js";
import { CALC_TOOLS } from "../../src/lib/calculatorsContent.js";

const render = (tool: "mortgage" | "yield" | "afford", isRtl: boolean) =>
  renderToString(React.createElement(CalculatorView, { isRtl, tool, onSelectTool: () => {}, onOpenPriceCheck: () => {}, onSearch: () => {} }));

describe("the calculator screens draw without error and show a result from the example numbers", () => {
  for (const isRtl of [false, true]) {
    for (const t of CALC_TOOLS) {
      it(`${t.key} (${isRtl ? "Arabic" : "English"})`, () => {
        const html = render(t.key, isRtl);
        expect(html).toContain(isRtl ? t.h1.ar : t.h1.en);
        expect(html).toContain(isRtl ? 'dir="rtl"' : 'dir="ltr"');
        // every question is on the page, and the result area holds figures
        for (const f of t.faq) expect(html).toContain(isRtl ? f.q.ar : f.q.en);
        expect(html).toMatch(/\d{1,3}(,\d{3})+|\d+\.\d{2}%/);
        expect(html).not.toContain("NaN");
        expect(html).not.toContain("Infinity");
      });
    }
  }

  it("shows the monthly payment of the example loan", () => {
    // 1,500,000 with 20% down, 5.5% for 25 years
    expect(render("mortgage", false)).toContain("7,369");
  });
});
