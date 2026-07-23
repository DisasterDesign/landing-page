import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LeadSourceBadge from "./LeadSourceBadge";

test("renders intent separately from the canonical acquisition channel", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
      sourceLabel: "פנייה קרה",
    }),
  );

  assert.match(markup, /פנייה קרה/);
  assert.match(markup, /Google Maps/);
});
