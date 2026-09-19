# CHECKPOINT: Checkout Delivery Location UI Fix (Input Readability & Autocomplete Stacking)

**File Reference:** `CHECKPOINTS/checkout-location-autocomplete-ui-fix-01.md`  
**Timestamp:** 2026-09-19 20:00:00 IST  
**Branch:** task/dev  
**Status:** 100% COMPLETE & VERIFIED IN REAL BROWSER (Desktop & Mobile 375x812)  

---

## 1. Problem Description
On the `/checkout` page under **Step 2: "Delivery Location & Address Snapshot"**:
1. **Search Input Invisible Text:**
   When typing into the *"Search Area, Landmark, or Complex"* field (e.g. `ffhhffgh`), the text was rendered in default dark/black color against the dark obsidian background (`#07090E`), making typed characters almost invisible.
2. **Autocomplete Dropdown Behind Map:**
   The search suggestions dropdown (`"Suggested Delivery Localities"`) rendered *under* the interactive Leaflet map canvas and overlays. The user was unable to view or click autocomplete search results.

---

## 2. Root Cause Analysis

### Invisible Text Root Cause:
`@medusajs/ui`'s `Input` component defaults to light-mode text color `text-ui-fg-base` (`#111827`, dark gray/black). In `checkout-form.tsx`, the search input had `className="pl-10 text-xs sm:text-sm bg-obsidian-base "` applied without an explicit text color or caret color. The dark text on `#07090E` (pitch black) resulted in near-zero contrast.

### Autocomplete Dropdown Behind Map Root Cause:
1. The search input container was `<div className="relative">` with no explicit `z-index` (default `z-index: auto`), so it did not establish a localized stacking context above its siblings.
2. The autocomplete dropdown had `z-40` (`z-index: 40`).
3. Sibling element `CheckoutMap` initializes Leaflet panes (`.leaflet-pane` with `z-index: 400`, `.leaflet-marker-pane` with `z-index: 600`, Leaflet controls with `z-index: 1000`) and has overlays with `z-[400]` and `z-[500]`.
4. `CheckoutMap` did not have an isolated stacking context (`isolate` / `z-0`). Consequently, Leaflet's high internal z-indexes (400, 500, 600, 1000) bled into the common ancestor's stacking context, placing the map on top of the search dropdown (`z-40`).

---

## 3. Files Changed
1. `frontend/src/components/store/checkout/checkout-map.tsx`
2. `frontend/src/components/store/checkout/checkout-form.tsx`

---

## 4. Exact UI Fix Applied

### In `frontend/src/components/store/checkout/checkout-map.tsx`:
- Added `z-0 isolate` to the outer relative wrapper:
  ```tsx
  <div className="relative z-0 isolate w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height }}>
  ```
  This creates a CSS isolated stacking context that strictly confines all internal Leaflet layers (`z-400`, `z-600`, `z-1000`) and map status overlays inside the map at level `0`.

### In `frontend/src/components/store/checkout/checkout-form.tsx`:
- Wrapped the search section in `searchContainerRef` with `relative z-30`:
  ```tsx
  <div ref={searchContainerRef} className="relative z-30">
  ```
- Styled the search `Input` with explicit high-contrast theme tokens:
  - Text color: `text-pearl` (`#F4F5F8`) and `style={{ color: "#F4F5F8", caretColor: "#D4AF37" }}`
  - Placeholder: `placeholder:text-ash/70` (`#8B95A5`)
  - Border & focus: `border border-navy-accent/80 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 focus:outline-none`
  - Caret: `caret-[#D4AF37]`
  - Autofill: `[&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#07090E_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#F4F5F8]`
  - Padding: `pl-10 pr-10`
- Configured autocomplete suggestions dropdown:
  - Stacking: `z-50` with `bg-navy-surface/98 backdrop-blur-md border border-navy-accent/80 shadow-[0_16px_40px_rgba(0,0,0,0.6)]`
  - Fixed typo in item hover class: `hover:bg-obsidian-base hover:bg-navy-accent/80 active:bg-navy-accent`
  - Added empty/loading state handling
- Added click-outside listener to dismiss the dropdown when clicking elsewhere:
  ```tsx
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  ```
- Positioned map section container explicitly at `relative z-0`:
  ```tsx
  <div className="space-y-1.5 relative z-0">
  ```

---

## 5. Verification Performed (Real Browser Testing)
Browser testing executed via subagent on `http://localhost:3000/checkout`:

1. **Step 1 Contact Details & Step 2 Progression:**
   - Added item to cart, entered purchaser contact details in Step 1, advanced to Step 2.
2. **Search Input Text Visibility:**
   - Typed arbitrary query `ffhhffgh`.
   - Verified that text renders in bright `#F4F5F8` (pearl) with clear contrast against `#07090E` (obsidian).
3. **Dropdown Stacking Above Map:**
   - Typed `"Indiranagar"`.
   - Dropdown appeared floating directly below the input field.
   - Visually verified that suggestions appear cleanly **ABOVE** the Leaflet map container without being obscured by map tiles, controls, or markers.
4. **Dropdown Hover & Click Interactivity:**
   - Hover state highlighted suggestion items smoothly.
   - Clicked "Indiranagar" suggestion:
     - Dropdown closed immediately.
     - Delivery coordinates updated to `(12.97160, 77.64120)`.
     - Status updated to `"✓ Search Selected"`.
     - Serviceability and pricing updated to `"✓ We deliver here (Delivery Fee: ₹49)"`.
     - Leaflet map dynamically centered on Indiranagar with delivery pin locked.
5. **Map Drag & Zoom:**
   - Dragged map tiles and zoomed; map responded interactively.
6. **Mobile Viewport (375x812):**
   - Resized browser to mobile dimensions.
   - Typed `"Koramangala"`.
   - Suggestions dropdown, search input, and map rendered responsively with zero horizontal overflow.

---

## 6. Business Logic Invariance Confirmation
- Strictly **ZERO** changes made to:
  - Cart calculations
  - Item prices
  - GST calculations
  - Delivery fees & slot surcharges
  - Order creation logic
  - Branch routing & kitchen availability logic
  - Geocoding/search APIs
