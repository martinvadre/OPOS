# Project rules

## Zero-cost operation

- Payment processing and settlement fees are separate from the POS operating costs: the user accepts that payment providers may charge these fees. Keep the POS software and infrastructure free, disclose provider fees before integration, and do not enroll in paid plans or initiate charges without explicit authorization.
- This project must cost the user no money to develop, deploy, or operate. This applies to hosting, databases, APIs, authentication, storage, bandwidth, scheduled jobs, integrations, and any other service.
- Use free software, local tools, and free service plans within their free allowances. Do not rely on a time-limited trial or promotional credits for ongoing operation.
- Before adding a service or changing infrastructure, verify its current pricing, free limits, and overage behavior. Do not assume an existing account or integration is free.
- Do not start a paid subscription, upgrade a plan, enable paid features, or allow automatic paid overages. Prefer hard spending limits or configurations that stop at the free allowance.
- If a requested feature or expected usage could incur a charge, explain the cost and its trigger to the user before taking the step that creates that cost. Provide a practical zero-cost alternative and use it by default when it meets the request.
- If the request cannot be completed for free, explain the limitation and offer the closest free solution. Do not incur a charge without the user's explicit approval of that specific exception.
- For free tiers with usage limits, disclose relevant limits and what happens when they are reached. Do not promise unlimited free operation.

## UI spacing

- Report navigation cards use a 6pt icon-to-title gap and 12pt padding (16 CSS px) on all four sides. Size their height from the content and padding rather than adding excess minimum height.
- Use the shared 3pt spacing scale: 6pt for labels and adjacent controls, 9pt for related rows or icon/title gaps, and 12pt for card content and section gaps.
- Card headers must only allocate rows for content that exists; do not leave an empty description row after removing descriptions.
- Desktop uses a blue sidebar without a top navigation bar. Its header has a square toggle button and an OPOS title that is visible only when expanded. Mobile retains its top bar and original navigation colors.
- In the mobile top bar, align the toggle icon's left edge with the page heading: 6pt left padding, a 30pt button containing an 18pt icon, and a 6pt gap before OPOS.

- Report navigation rows match Settings’ Sign out row: 12pt titles, 18pt icons, and a 27pt content-row height.
