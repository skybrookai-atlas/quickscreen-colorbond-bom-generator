# Amazing Fencing — Refined BOM Breakdown by Height (1200mm to 2400mm)

This document provides a height-by-height breakdown of the specific materials required to construct a standard run of **Colorbond Steel Panel** and **Timber Boundary Paling** fences, in 300mm increments from 1200mm to 2400mm. 

PermaSteel modular steel, Timber Slat Screens, Sleepers, and Lattice decorations are excluded from this breakdown per your instructions.

---

## 1. Colorbond Steel Panel Fence (`AF_COLORBOND`)
Standard panels are typically $2.36\text{m}$ or $3.10\text{m}$ wide (bay width). Each standard panel requires 1 top rail, 1 bottom rail, and 3 interlocking sheet profiles.
* **Cap count rule**: 1 cap per 2 C-posts, calculated as `ceil(num_posts / 2)`. (Lattice is left off).
* **Concrete per post**: 1 bag of 30kg Post Mix (`AF-CON-POSTMIX-30`).
* **Fixings per panel**: Tek screws (`AF-CBD-SCREW-TEK-20` or `AF-CBD-SCREW-TEK-35`) and coloured hex sheet screws (`AF-CBD-SCREW-COLOURED-SD10`).

### Breakdown by Height

#### 1200mm High Colorbond
* **Posts**: C Post 1.8m (requires cutting down `AF-CBD-CPOST-2.1` by 300mm).
* **Rails**: Rails in 2.35m (`AF-CBD-RAIL-2.35`) or 3.10m (`AF-CBD-RAIL-3.10`).
* **Sheets**: 1.2m sheets (requires cutting down `AF-CBD-SHEET-1.5` by 300mm).
* **Post Caps**: `AF-CBD-CAP-100x100` (Quantity = `ceil(num_posts / 2)`).

#### 1500mm High Colorbond
* **Posts**: C Post 2.1m (`AF-CBD-CPOST-2.1`).
* **Rails**: Rails in 2.35m (`AF-CBD-RAIL-2.35`) or 3.10m (`AF-CBD-RAIL-3.10`).
* **Sheets**: 1.5m sheets (`AF-CBD-SHEET-1.5`).
* **Post Caps**: `AF-CBD-CAP-100x100` (Quantity = `ceil(num_posts / 2)`).

#### 1800mm High Colorbond
* **Posts**: C Post 2.4m (`AF-CBD-CPOST-2.4`).
* **Rails**: Rails in 2.35m (`AF-CBD-RAIL-2.35`) or 3.10m (`AF-CBD-RAIL-3.10`).
* **Sheets**: 1.8m sheets (`AF-CBD-SHEET-1.8`).
* **Post Caps**: `AF-CBD-CAP-100x100` (Quantity = `ceil(num_posts / 2)`).

#### 2100mm High Colorbond
* **Posts**: C Post 2.7m (`AF-CBD-CPOST-2.7`).
* **Rails**: Rails in 2.35m (`AF-CBD-RAIL-2.35`) or 3.10m (`AF-CBD-RAIL-3.10`).
* **Sheets**: 2.1m sheets (`AF-CBD-SHEET-2.1`).
* **Post Caps**: `AF-CBD-CAP-100x100` (Quantity = `ceil(num_posts / 2)`).

#### 2400mm High Colorbond
* **Posts**: C Post 3.0m (`AF-CBD-CPOST-3.0`).
* **Rails**: Rails in 2.35m (`AF-CBD-RAIL-2.35`) or 3.10m (`AF-CBD-RAIL-3.10`).
* **Sheets**: 2.4m sheets (`AF-CBD-SHEET-2.4`).
* **Post Caps**: `AF-CBD-CAP-100x100` (Quantity = `ceil(num_posts / 2)`).

---

## 2. Timber Boundary Paling Fence — Butted Style (`AF_TIMBER_PALING`)
Standard paling spacing is $100\text{mm}$ centers. Rails are $4.8\text{m}$ stock lengths spanning two standard $2.4\text{m}$ bays. 
* **Paling Count**: 27 palings per $2.4\text{m}$ bay (including 5% wastage).
* **Nails**: **45mm ring shank coil nails** (`AF-NAIL-COIL-45-250`) $\rightarrow$ 2 nails per paling per rail.
* **Consumables per post**: 1 bag of 30kg concrete (Rapid Set `AF-CON-RAPID-30` for Pine, Post Mix `AF-CON-POSTMIX-30` for Hardwood).
* **Batten Screws**: Batten screws 14g × 100mm (`AF-SCR-BB-14g-100-500`) $\rightarrow$ 2 screws per rail piece.

### Breakdown by Height

#### 1200mm High Butted Timber Paling
* **Posts (100x75mm × 1800mm)**:
  * Pine: `AF-POST-PINE-100x75-1800`
  * Hardwood: `AF-POST-HWD-100x75-1800`
* **Palings (100x16mm × 1200mm)**:
  * Pine: `AF-PAL-100x16-1200` (or `AF-PAL-PP-100x16-1200` rounded top pickets)
* **Rails (75x38mm or 100x38mm, 4.8m stock)**:
  * **2 rails required** (top and bottom).
  * Pine: `AF-RAIL-PINE-75x38-4800`
  * Hardwood: `AF-RAIL-HWD-75x38-4800`
* **Nails**: 45mm Coil Nails (approx. 108 nails per bay $\rightarrow$ 4 nails/paling $\times$ 27 palings).

#### 1500mm High Butted Timber Paling
* **Posts (100x75mm × 2100mm)**:
  * Pine: `AF-POST-PINE-100x75-2400` (cut down to 2.1m)
  * Hardwood: `AF-POST-HWD-100x75-2100`
* **Palings (100x16mm × 1500mm)**:
  * Pine: `AF-PAL-100x16-1500` (or `AF-PAL-PP-100x16-1500` rounded top pickets)
* **Rails (75x38mm or 100x38mm, 4.8m stock)**:
  * **3 rails required** (top, middle, bottom).
  * Pine: `AF-RAIL-PINE-75x38-4800`
  * Hardwood: `AF-RAIL-HWD-75x38-4800`
* **Nails**: 45mm Coil Nails (approx. 162 nails per bay $\rightarrow$ 6 nails/paling $\times$ 27 palings).

#### 1800mm High Butted Timber Paling
* **Posts (100x75mm × 2400mm)**:
  * Pine: `AF-POST-PINE-100x75-2400`
  * Hardwood: `AF-POST-HWD-100x75-2400`
* **Palings (100x16mm × 1800mm)**:
  * Pine: `AF-PAL-100x16-1800`
* **Rails (75x38mm or 100x38mm, 4.8m stock)**:
  * **3 rails required** (top, middle, bottom).
  * Pine: `AF-RAIL-PINE-75x38-4800`
  * Hardwood: `AF-RAIL-HWD-75x38-4800`
* **Nails**: 45mm Coil Nails (approx. 162 nails per bay).

#### 2100mm High Butted Timber Paling
* **Posts (100x75mm × 2700mm)**:
  * Pine: `AF-POST-PINE-100x75-3000` (cut down to 2.7m)
  * Hardwood: `AF-POST-HWD-100x75-2700`
* **Palings (100x16mm × 2100mm)**:
  * Pine: `AF-PAL-100x16-2400` (cut down to 2.1m)
* **Rails (75x38mm or 100x38mm, 4.8m stock)**:
  * **3 rails required** (top, middle, bottom).
  * Pine: `AF-RAIL-PINE-75x38-4800`
  * Hardwood: `AF-RAIL-HWD-75x38-4800`
* **Nails**: 45mm Coil Nails (approx. 162 nails per bay).

#### 2400mm High Butted Timber Paling
* **Posts (100x75mm × 3000mm)**:
  * Pine: `AF-POST-PINE-100x75-3000`
  * Hardwood: `AF-POST-HWD-100x75-3000`
* **Palings (100x16mm × 2400mm)**:
  * Pine: `AF-PAL-100x16-2400`
* **Rails (75x38mm or 100x38mm, 4.8m stock)**:
  * **4 rails required** (top, two middles, bottom).
  * Pine: `AF-RAIL-PINE-75x38-4800`
  * Hardwood: `AF-RAIL-HWD-75x38-4800`
* **Nails**: 45mm Coil Nails (approx. 216 nails per bay $\rightarrow$ 8 nails/paling $\times$ 27 palings).

---

## 3. Timber Boundary Paling Fence — Lapped & Capped Style (`AF_TIMBER_PALING`)
This style uses overlapping layers (15 palings per linear metre total: split 19 front, 19 back per 2.4m bay) and includes a capping rail (`AF-CAP-75x50-4800`) across the top.
* **Nails**: 
  * Back/First layer: **45mm ring shank coil nails** (`AF-NAIL-COIL-45-250`) $\rightarrow$ **1 nail per paling per rail**.
  * Front/Overlapping layer: **57mm ring shank coil nails** (`AF-NAIL-COIL-57-250`) $\rightarrow$ **2 nails per paling per rail**.
* **Capping Rail**: 1 length of `AF-CAP-75x50-4800` spans two standard $2.4\text{m}$ bays.

### Breakdown by Height

#### 1200mm High Lapped & Capped Timber Paling
* **Posts & Rails**: Identical to 1200mm Butted (2 rails).
* **Palings**: 1200mm palings (`AF-PAL-100x16-1200` $\times$ 38 per bay).
* **Capping**: `AF-CAP-75x50-4800` (0.5 lengths per bay).
* **Nails**:
  * Front/Overlapping: 57mm Coil Nails (approx. 76 nails per bay $\rightarrow$ 2 nails/paling/rail $\times$ 19 palings $\times$ 2 rails).
  * Back/First: 45mm Coil Nails (approx. 38 nails per bay $\rightarrow$ 1 nail/paling/rail $\times$ 19 palings $\times$ 2 rails).

#### 1500mm High Lapped & Capped Timber Paling
* **Posts & Rails**: Identical to 1500mm Butted (3 rails).
* **Palings**: 1500mm palings (`AF-PAL-100x16-1500` $\times$ 38 per bay).
* **Capping**: `AF-CAP-75x50-4800` (0.5 lengths per bay).
* **Nails**:
  * Front/Overlapping: 57mm Coil Nails (approx. 114 nails per bay $\rightarrow$ 2 nails/paling/rail $\times$ 19 palings $\times$ 3 rails).
  * Back/First: 45mm Coil Nails (approx. 57 nails per bay $\rightarrow$ 1 nail/paling/rail $\times$ 19 palings $\times$ 3 rails).

#### 1800mm High Lapped & Capped Timber Paling
* **Posts & Rails**: Identical to 1800mm Butted (3 rails).
* **Palings**: 1800mm palings (`AF-PAL-100x16-1800` $\times$ 38 per bay).
* **Capping**: `AF-CAP-75x50-4800` (0.5 lengths per bay).
* **Nails**:
  * Front/Overlapping: 57mm Coil Nails (approx. 114 nails per bay).
  * Back/First: 45mm Coil Nails (approx. 57 nails per bay).

#### 2100mm High Lapped & Capped Timber Paling
* **Posts & Rails**: Identical to 2100mm Butted (3 rails).
* **Palings**: 2400mm palings cut to 2.1m (`AF-PAL-100x16-2400` $\times$ 38 per bay).
* **Capping**: `AF-CAP-75x50-4800` (0.5 lengths per bay).
* **Nails**:
  * Front/Overlapping: 57mm Coil Nails (approx. 114 nails per bay).
  * Back/First: 45mm Coil Nails (approx. 57 nails per bay).

#### 2400mm High Lapped & Capped Timber Paling
* **Posts & Rails**: Identical to 2400mm Butted (4 rails).
* **Palings**: 2400mm palings (`AF-PAL-100x16-2400` $\times$ 38 per bay).
* **Capping**: `AF-CAP-75x50-4800` (0.5 lengths per bay).
* **Nails**:
  * Front/Overlapping: 57mm Coil Nails (approx. 152 nails per bay $\rightarrow$ 2 nails/paling/rail $\times$ 19 palings $\times$ 4 rails).
  * Back/First: 45mm Coil Nails (approx. 76 nails per bay $\rightarrow$ 1 nail/paling/rail $\times$ 19 palings $\times$ 4 rails).
