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

  // The source name is the loud, first-glance dimension.
  assert.match(markup, /גוגל מפות/);
  assert.match(markup, /📍/);
});

test("each source tier renders its own label", () => {
  const organic = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "INBOUND",
      sourceKey: "website",
    }),
  );
  const facebook = renderToStaticMarkup(
    createElement(LeadSourceBadge, {
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
    }),
  );
  assert.match(organic, /אורגני/);
  assert.match(organic, /טופס האתר/);
  assert.match(facebook, /פייסבוק/);
});
