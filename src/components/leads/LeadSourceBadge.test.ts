import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import LeadSourceBadge from "./LeadSourceBadge";

test("renders the temperature separately from the canonical acquisition channel", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
    }),
  );

  // Temperature is the loud, first-glance dimension; source is secondary.
  assert.match(markup, /ליד קר/);
  assert.match(markup, /🧊/);
  assert.match(markup, /Google Maps/);
});

test("each temperature tier renders its own label", () => {
  const hot = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "INBOUND",
      sourceKey: "website",
    }),
  );
  const medium = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
    }),
  );
  assert.match(hot, /ליד חם/);
  assert.match(medium, /ליד בינוני/);
});
