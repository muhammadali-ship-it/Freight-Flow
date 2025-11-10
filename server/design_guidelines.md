# Container Tracking App - Design Guidelines

## Design Approach: Professional Operations Dashboard

**Selected Approach:** Design System - Carbon Design + Modern Logistics Platform Patterns

**Justification:** As an internal operations tool for freight brokerage, this requires a data-focused, efficiency-driven interface. Drawing inspiration from enterprise logistics platforms and Carbon Design System to ensure clarity, scannability, and professional aesthetics suitable for daily operational use.

**Key Design Principles:**
- Information hierarchy for quick scanning
- Status-driven visual feedback
- Efficient workflows for operations staff
- Professional, trustworthy appearance

## Core Design Elements

### A. Color Palette

**Dark Mode Primary:**
- Background: 220 15% 12% (deep slate)
- Surface: 220 15% 16% (card backgrounds)
- Surface Elevated: 220 15% 20% (hover/active states)
- Border: 220 15% 25%

**Light Mode Primary:**
- Background: 220 15% 98%
- Surface: 0 0% 100%
- Border: 220 15% 88%

**Brand & Status Colors:**
- Primary (Brand): 220 90% 56% (professional blue)
- Success (Delivered): 142 76% 45%
- Warning (In Transit): 38 92% 50%
- Error (Delayed): 0 84% 60%
- Info (Processing): 199 89% 48%
- Neutral Text: 220 15% 95% (dark mode) / 220 15% 15% (light mode)

### B. Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - for UI, data, labels
- Monospace: 'JetBrains Mono' - for container IDs, tracking numbers

**Type Scale:**
- Headers: text-2xl font-semibold (dashboard titles)
- Section Headers: text-lg font-semibold
- Body: text-sm font-normal
- Data Labels: text-xs font-medium uppercase tracking-wide
- Large Data: text-base font-semibold (container numbers, status)

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Card spacing: p-6
- Grid gaps: gap-4

**Grid Structure:**
- Dashboard: 12-column grid system
- Container cards: grid-cols-1 md:grid-cols-2 xl:grid-cols-3
- Details layout: Two-column split (8-column main + 4-column sidebar on xl)

### D. Component Library

**Dashboard Layout:**
- Top navigation bar with search, filters, user menu
- Left sidebar (collapsible) with: Overview, Active Shipments, Arrivals, Alerts, Analytics
- Main content area with stats cards and container grid/list
- Sticky filter bar below navigation

**Core Components:**

1. **Stats Cards** (4-column grid on desktop):
   - Total Containers, In Transit, Arriving Today, Delayed
   - Large number (text-3xl font-bold) + label + trend indicator
   - Icon in top-right, colored background subtle tint

2. **Container Cards:**
   - Container number (prominent, monospace font)
   - Status badge (rounded-full, colored with icon)
   - Origin → Destination with arrow icon
   - ETA date and progress bar
   - Quick action buttons (View Details, Track, Update)
   - Carrier logo/name, Reference numbers

3. **Status Badges:**
   - Delivered: green background, check icon
   - In Transit: blue background, truck icon
   - Delayed: red background, alert icon
   - At Port: yellow background, anchor icon
   - Rounded-full, px-3 py-1, text-xs font-medium

4. **Timeline Visualization:**
   - Vertical timeline for container journey
   - Nodes for key events (pickup, port arrival, customs, delivery)
   - Completed: filled circle with check, blue line
   - Current: pulsing ring, blue
   - Pending: outlined circle, gray
   - Timestamps and location for each event

5. **Data Tables:**
   - Compact row height (h-12)
   - Sortable columns with sort indicators
   - Row hover state with elevated background
   - Inline status badges and action buttons
   - Sticky header on scroll

6. **Search & Filters:**
   - Prominent search bar (container #, PO, reference)
   - Dropdown filters: Status, Carrier, Date Range, Origin/Destination
   - Applied filters shown as dismissible chips
   - Quick filter pills above data view

7. **Detail Panel (Slide-over):**
   - Opens from right on container click
   - Header: Container # + status + close button
   - Tabbed content: Overview, Timeline, Documents, Notes
   - Action buttons at bottom

**Navigation:**
- Horizontal top bar (h-16) with logo, global search, notifications, profile
- Vertical sidebar (w-64, collapsible to w-16 icon-only)
- Breadcrumb navigation for detail views

**Forms & Inputs:**
- Consistent height (h-10 for inputs)
- Floating labels or clear placeholder text
- Dark mode: bg-surface with border
- Focus: ring-2 ring-primary
- Error states: ring-error with error message below

### E. Animations

Use sparingly, only for meaningful feedback:
- Page transitions: none (instant for operations speed)
- Loading states: simple spinner or skeleton screens
- Status changes: subtle 200ms color fade
- Slide-over panels: 300ms ease-in-out transform
- Dropdown menus: 150ms ease-out

## Images

**No hero images** - This is a data-focused operations dashboard. Visual elements should be:
- Carrier/shipping line logos (small, 32x32px or 48x48px)
- Status icons from Heroicons (truck, ship, package, check, alert)
- Company logo in navigation header
- Map view integration for container locations (use Leaflet or Mapbox)

## Implementation Notes

**Icons:** Use Heroicons via CDN for consistency
- Navigation icons: outline style
- Status indicators: solid style
- Action buttons: outline style

**Responsive Behavior:**
- Mobile: Stack to single column, collapsible sidebar to bottom nav
- Tablet: 2-column card grid, partial sidebar
- Desktop: Full 3-column layout with sidebar

**Key Interactions:**
- Quick view: Hover over container card shows action buttons
- Bulk actions: Checkbox selection for multi-container operations
- Real-time updates: WebSocket connection for live status changes (subtle badge notification)
- Keyboard shortcuts: "/" for search, "Esc" to close panels