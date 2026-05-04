# QuoteFlow - 05: Frontend Design

> Load this file when: working on React apps, UI components, screens, or frontend logic

---

## Two Separate React Applications

QuoteFlow uses two separate React apps:

- `buyer-portal`
- `supplier-portal`

This keeps the buyer workflow complex and operational, while the supplier workflow stays simple and invitation-driven.

---

## Buyer Portal

### Main Screens

- `Dashboard.tsx`
  RFQ list with draft actions and active-event navigation.

- `NewRFQ.tsx`
  AI-assisted RFQ creation flow.

- `RFQDetail.tsx`
  Event detail, supplier invitation status, and shared Q&A.

- `Analysis.tsx`
  Normalization, scoring, eliminated/qualifying views, and response drill-down.

- `Memo.tsx`
  Decision memo display, AI response analyses, and PDF download.

- `Suppliers.tsx`
  Supplier contact management.

### Current Buyer Flow Notes

- The analysis page no longer hosts the AI response-evaluation action.
- The memo page now contains `Generate AI analyses`.
- The memo page highlights a preferred supplier rather than showing an award button.
- Buyer star-rating UI is no longer part of the current analysis flow.

---

## Supplier Portal

### Current Structure

```text
supplier-portal/src/
|-- pages/
|   |-- Home.tsx
|   |-- Dashboard.tsx
|   |-- ResponseForm.tsx
|   |-- Confirmation.tsx
|   `-- InvalidLink.tsx
|-- components/
|   |-- PortalFrame.tsx
|   |-- RFQViewer.tsx
|   |-- FormField.tsx
|   |-- FileUpload.tsx
|   `-- QuestionBox.tsx
`-- lib/
    |-- api.ts
    |-- utils.ts
    `-- session.ts
```

### Current Supplier Flow

The supplier portal is no longer just a one-off form page.

Current behavior:

1. Supplier opens the invitation link.
2. The app loads the supplier inbox route.
3. The inbox shows all RFQs associated with that supplier record.
4. Supplier chooses one RFQ to start or reopen.
5. If already submitted and still open, the supplier can edit the response.
6. Confirmation returns the supplier to the inbox.

### Routes

- `/`
  Entry page or redirect to remembered portal token.

- `/:portalToken`
  Supplier inbox/dashboard.

- `/:portalToken/respond/:inviteToken`
  Response form for one RFQ.

- `/confirmation`
  Post-submit confirmation.

- `/invalid`
  Invalid, expired, or closed-link state.

### Design Principles

- No supplier account creation.
- Minimal navigation.
- Token-first entry.
- Easy re-entry to submitted responses.
- Clear status per RFQ.

### Response Form Behavior

`ResponseForm.tsx` now supports both initial submission and update mode.

On load it:

1. Fetches RFQ/form data using the invitation token.
2. Prefills previously submitted values when present.
3. Shows the RFQ document and shared questions.
4. Offers `Back to inbox`.

Submission behavior:

- `POST /api/response/{token}` for first submission
- `PUT /api/response/{token}` for updates

### Supplier Inbox Behavior

`Dashboard.tsx` shows:

- Supplier name and email
- Count summaries
- RFQ cards
- Status badges
- Ability to open or reopen a response

The portal also remembers the last portal token locally through `session.ts`.

---

## Shared Frontend Notes

- Both apps use React Router.
- Both apps use Axios-based API utilities.
- Both apps are static builds served through nginx.
- Supplier and buyer UIs intentionally do not share navigation or auth state.

---

*See 00-INDEX.md for the full file map*
