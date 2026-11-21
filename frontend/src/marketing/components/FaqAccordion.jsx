import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "Can I use custom domains for my short links?",
    a: "Yes. With the Team tier, you can configure your own custom branded domain (such as link.yourcompany.com) with automated SSL certificate provisioning and zero-downtime routing."
  },
  {
    q: "How does UTM parameter tracking work?",
    a: "SmartLink allows you to append and manage standard UTM parameters (source, medium, campaign, term, content). Our attribution engine automatically groups traffic by source and medium, providing clean ROI reporting across Google, Twitter, LinkedIn, and email campaigns."
  },
  {
    q: "Is there a limit to how many clicks are tracked?",
    a: "The Free plan provides tracking for up to 50 active links with 7-day history. Pro and Team plans include unlimited links and clicks with 1-year to multi-year analytics retention."
  },
  {
    q: "Can I change a destination URL after creating a link?",
    a: "Yes. You can edit destination URLs, modify access rules, or pause link routing at any time without invalidating printed QR codes or previously shared short links."
  },
  {
    q: "How are QR codes generated and tracked?",
    a: "Dynamic QR codes are generated instantly with high error correction. Scans pass through our low-latency global redirection engine to capture device types, operating systems, browser engines, and geographic locations."
  },
  {
    q: "What analytics are included in the free tier?",
    a: "The Free tier includes real-time click counts, device categorization (mobile vs desktop), browser identification, and a 7-day click trend chart."
  }
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex((prev) => (prev === idx ? -1 : idx));
  };

  return (
    <div className="mkt-faq-list" role="region" aria-label="Frequently Asked Questions">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        const triggerId = `faq-trigger-${idx}`;
        const panelId = `faq-panel-${idx}`;

        return (
          <div key={idx} className={`mkt-faq-item ${isOpen ? "open" : ""}`}>
            <button
              id={triggerId}
              type="button"
              className="mkt-faq-trigger"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              aria-controls={panelId}
            >
              <span>{item.q}</span>
              <ChevronDown
                size={18}
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                  color: "var(--mkt-muted)"
                }}
              />
            </button>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="mkt-faq-content"
              >
                <p style={{ margin: 0 }}>{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
