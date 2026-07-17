import Script from "next/script";

/**
 * LinkedIn Insight Tag for the public site. Renders nothing until
 * NEXT_PUBLIC_LINKEDIN_PARTNER_ID is set (Campaign Manager → Analyze →
 * Insight Tag → Partner ID). Once live it builds a retargeting audience of
 * site visitors and powers Website Demographics (needs ~300 tagged visitors
 * before any data shows). No ad spend required to collect this data.
 */
export default function LinkedInInsight() {
  const id = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  if (!id) return null;

  return (
    <>
      <Script id="linkedin-insight-init" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "${id}";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        `}
      </Script>
      <Script id="linkedin-insight" strategy="afterInteractive">
        {`
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://px.ads.linkedin.com/collect/?pid=${id}&fmt=gif`}
        />
      </noscript>
    </>
  );
}
