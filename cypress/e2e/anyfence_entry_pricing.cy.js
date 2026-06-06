let browserErrors = [];

const session = {
  access_token: "anyfence-smoke-token",
  refresh_token: "anyfence-smoke-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@glass-outlet.com",
    app_metadata: {},
    user_metadata: {},
  },
};

function mockGoogleMaps() {
  // Mock Google Maps JS SDK script load
  cy.intercept("GET", "https://maps.googleapis.com/maps/api/js*", (req) => {
    const url = new URL(req.url);
    const callbackName = url.searchParams.get("callback") || "";
    req.reply({
      statusCode: 200,
      headers: { "content-type": "application/javascript" },
      body: `
        (() => {
          class LatLng {
            constructor(lat, lng) { this._lat = lat; this._lng = lng; }
            lat() { return this._lat; }
            lng() { return this._lng; }
          }
          class Map {
            constructor(el, opts) {
              this.el = el;
              this.center = opts.center;
              this.zoom = opts.zoom;
              this.mapTypeId = opts.mapTypeId;
              this.options = opts;
              this.render();
            }
            render() {
              this.el.innerHTML =
                '<div style="height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1f3b32,#6f875d 45%,#223048);color:white;font:700 18px system-ui;text-align:center;">' +
                '<div><div>Mock satellite imagery</div><div style="font-size:12px;margin-top:8px;">' +
                this.mapTypeId + ' · zoom ' + this.zoom + '</div></div></div>';
            }
            panTo(position) { this.center = position; this.render(); }
            setCenter(position) { this.center = position; this.render(); }
            setZoom(zoom) { this.zoom = zoom; this.render(); }
            getZoom() { return this.zoom; }
            getCenter() {
              if (this.center && typeof this.center.lat === 'function') return this.center;
              const c = this.center || { lat: -25, lng: 133 };
              return new LatLng(c.lat, c.lng);
            }
            setMapTypeId(mapTypeId) { this.mapTypeId = mapTypeId; this.render(); }
            setOptions(opts) { this.options = { ...this.options, ...opts }; }
          }
          class Marker {
            constructor(opts) {
              this.map = opts.map;
              this.position = opts.position;
              this.listeners = {};
            }
            addListener(name, fn) { this.listeners[name] = fn; return { remove() {} }; }
            getPosition() { return this.position; }
            setPosition(position) { this.position = position; }
            setMap(map) { this.map = map; }
          }
          class AutocompleteSessionToken {}
          class AutocompleteSuggestion {
            static fetchAutocompleteSuggestions() {
              return Promise.resolve({ suggestions: [] });
            }
          }

          // Safety merge to preserve loader properties (like callback targets)
          window.google = window.google || {};
          window.google.maps = window.google.maps || {};
          window.google.maps.LatLng = LatLng;
          window.google.maps.Map = Map;
          window.google.maps.Marker = Marker;
          window.google.maps.importLibrary = (name) => {
            if (name === 'places') {
              return Promise.resolve({ AutocompleteSuggestion, AutocompleteSessionToken });
            }
            return Promise.resolve({});
          };

          const callbackName = "${callbackName}";
          if (callbackName) {
            const parts = callbackName.split(".");
            let obj = window;
            for (let i = 0; i < parts.length - 1; i++) {
              if (obj) obj = obj[parts[i]];
            }
            const lastPart = parts[parts.length - 1];
            if (obj && typeof obj[lastPart] === "function") {
              obj[lastPart]();
            }
          }
        })();
      `,
    });
  });

  // Mock Google Geocoding API response
  cy.intercept("GET", "https://maps.googleapis.com/maps/api/geocode/json*", (req) => {
    req.reply({
      statusCode: 200,
      body: {
        status: "OK",
        results: [
          {
            formatted_address: "1 Macquarie Street, Sydney NSW 2000, Australia",
            geometry: { location: { lat: -33.859972, lng: 151.213245 } },
          },
        ],
      },
    });
  }).as("geocode");

  cy.intercept("GET", /staticmap/, (req) => {
    req.reply({
      statusCode: 200,
      headers: {
        "content-type": "image/png",
        "access-control-allow-origin": "*",
      },
      body: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      encoding: "base64",
    });
  });
}

function mockBomCalculator() {
  cy.intercept("POST", "**/functions/v1/bom-calculator", (req) => {
    // Generate run ID dynamically from request if it has runs
    const reqPayload = req.body?.payload;
    const runId = reqPayload?.runs?.[0]?.runId || "run-1";
    const gateSeg = reqPayload?.runs?.[0]?.segments?.find((s) => s.segmentKind === "gate_opening");
    const segmentId = gateSeg?.segmentId || "seg-1";

    req.reply({
      statusCode: 200,
      body: {
        lines: [
          {
            sku: "100x75 Treated Pine Post 2400mm",
            description: "100x75 Treated Pine Post H4 2400mm",
            category: "post",
            quantity: 13,
            unit: "each",
            unitPrice: 39.00,
            lineTotal: 507.00,
            runId,
            sources: [{ scopeKind: "fence_run", scopeId: runId, scopeLabel: "Run 1", qty: 13 }]
          },
          {
            sku: "100x16 Rough Sawn Treated Pine Paling 1800mm",
            description: "100x16 Treated Pine Paling 1800mm",
            category: "paling",
            quantity: 120,
            unit: "each",
            unitPrice: 1.32,
            lineTotal: 158.40,
            runId,
            sources: [{ scopeKind: "fence_run", scopeId: runId, scopeLabel: "Run 1", qty: 120 }]
          },
          {
            sku: "75x38 Treated Pine Rail 4800mm",
            description: "75x38 Treated Pine Rail 4800mm",
            category: "rail",
            quantity: 8,
            unit: "each",
            unitPrice: 22.00,
            lineTotal: 176.00,
            runId,
            sources: [{ scopeKind: "fence_run", scopeId: runId, scopeLabel: "Run 1", qty: 8 }]
          },
          {
            sku: "57mm Ring Shank Gal Nail",
            description: "57mm Ring Shank Gal Nail",
            category: "fixing",
            quantity: 2,
            unit: "pack",
            unitPrice: 47.00,
            lineTotal: 94.00,
            runId,
            sources: [{ scopeKind: "fence_run", scopeId: runId, scopeLabel: "Run 1", qty: 2 }]
          },
          {
            sku: "Rapid Set Concrete 30kg",
            description: "Rapid Set Concrete 30kg",
            category: "concrete",
            quantity: 13,
            unit: "bag",
            unitPrice: 11.04,
            lineTotal: 143.52,
            runId,
            sources: [{ scopeKind: "fence_run", scopeId: runId, scopeLabel: "Run 1", qty: 13 }]
          },
          {
            sku: "Gate kit · 900mm pedestrian",
            description: "Gate kit · 900mm pedestrian",
            category: "gate",
            quantity: 1,
            unit: "each",
            unitPrice: 235.00,
            lineTotal: 235.00,
            runId,
            segmentId,
            sources: [{ scopeKind: "gate", scopeId: segmentId, scopeLabel: "Gate 1", qty: 1 }]
          }
        ],
        runResults: [
          {
            runId,
            items: [
              {
                sku: "100x75 Treated Pine Post 2400mm",
                description: "100x75 Treated Pine Post H4 2400mm",
                category: "post",
                quantity: 13,
                unit: "each",
                unitPrice: 39.00,
                lineTotal: 507.00
              },
              {
                sku: "100x16 Rough Sawn Treated Pine Paling 1800mm",
                description: "100x16 Treated Pine Paling 1800mm",
                category: "paling",
                quantity: 120,
                unit: "each",
                unitPrice: 1.32,
                lineTotal: 158.40
              },
              {
                sku: "75x38 Treated Pine Rail 4800mm",
                description: "75x38 Treated Pine Rail 4800mm",
                category: "rail",
                quantity: 8,
                unit: "each",
                unitPrice: 22.00,
                lineTotal: 176.00
              },
              {
                sku: "57mm Ring Shank Gal Nail",
                description: "57mm Ring Shank Gal Nail",
                category: "fixing",
                quantity: 2,
                unit: "pack",
                unitPrice: 47.00,
                lineTotal: 94.00
              },
              {
                sku: "Rapid Set Concrete 30kg",
                description: "Rapid Set Concrete 30kg",
                category: "concrete",
                quantity: 13,
                unit: "bag",
                unitPrice: 11.04,
                lineTotal: 143.52
              },
              {
                sku: "Gate kit · 900mm pedestrian",
                description: "Gate kit · 900mm pedestrian",
                category: "gate",
                quantity: 1,
                unit: "each",
                unitPrice: 235.00,
                lineTotal: 235.00
              }
            ]
          }
        ],
        totals: {
          subtotal: 1313.92,
          gst: 131.39,
          grandTotal: 1445.31
        },
        warnings: [],
        errors: [],
        assumptions: []
      }
    });
  }).as("calculateBom");
}

describe("Anyfence entry pricing & variation form — Stages 4-6", () => {
  beforeEach(() => {
    browserErrors = [];
    mockGoogleMaps();
    mockBomCalculator();

    cy.on("window:before:load", (win) => {
      // Mock Image constructor to bypass Google Static Maps loading & CORS issues
      const OriginalImage = win.Image;
      win.Image = function() {
        const img = new OriginalImage();
        Object.defineProperty(img, "naturalWidth", { get: () => 640 });
        Object.defineProperty(img, "naturalHeight", { get: () => 480 });
        Object.defineProperty(img, "src", {
          set(val) {
            if (typeof val === "string" && val.includes("staticmap")) {
              img.setAttribute("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
              setTimeout(() => {
                if (img.onload) img.onload();
              }, 5);
            } else {
              img.setAttribute("src", val);
            }
          },
          get() {
            return img.getAttribute("src") || "";
          }
        });
        return img;
      };

      win.console.error = (...args) => {
        const msg = args.map(a => {
          if (!a) return String(a);
          if (a.stack) return String(a.stack);
          if (a.message) return String(a.message);
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        }).join(" ");
        browserErrors.push("Console Error: " + msg);
      };
      win.addEventListener("error", (event) => {
        browserErrors.push(event.error ? event.error.stack || event.error.message : event.message);
      });
      win.addEventListener("unhandledrejection", (event) => {
        browserErrors.push(event.reason ? event.reason.stack || event.reason.message || event.reason : "Unhandled Promise Rejection");
      });
    });

    cy.visit("/fence-calculator", {
      onBeforeLoad(win) {
        win.localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
      },
    });
  });

  afterEach(() => {
    cy.window().then((win) => {
      const routeErr = win.__route_error;
      if (routeErr) {
        browserErrors.push("Route Error: " + (routeErr.stack || routeErr.message || routeErr));
      }
      if (browserErrors.length > 0) {
        throw new Error("Browser error detected:\n" + browserErrors.join("\n\n"));
      }
    });
  });

  it("performs full variation configuration and price bubble expansion flow", () => {
    // 1. Map Capture Stage
    cy.get('input[placeholder="Start with an Australian street address"]').type("Sydney NSW{enter}");
    cy.wait("@geocode");
    cy.contains("Use this view").click();

    // 2. Select Timber Paling
    cy.contains("Timber Paling").click();

    // 3. Verify Sidebar transitions to variation settings
    cy.get("aside").within(() => {
      cy.contains("Change fence type").should("be.visible");
      cy.contains("Run 1").should("be.visible");
      cy.contains("12.0m").should("be.visible"); // default run length
      cy.contains("Timber Paling · Butted · CCA Pine H4").should("be.visible");

      // Verify Spec Grid exists
      cy.contains("Height").should("be.visible");
      cy.contains("Paling").should("be.visible");
      cy.contains("Rail").should("be.visible");

      // Add gate to the run
      cy.contains("Add gate").click();
    });
    
    // 4. Verify collapsed price bubble is visible
    cy.get("[data-testid='price-bubble-collapsed']").should("be.visible");
    cy.get("[data-testid='price-bubble-collapsed']").contains("Amazing Fencing").should("be.visible");
    cy.get("[data-testid='price-bubble-collapsed']").contains("Supply Only").should("be.visible");

    // 5. Expand price bubble
    cy.get("[data-testid='price-bubble-collapsed']").click();

    // Verify expanded bubble and mode toggles
    cy.get("[data-testid='price-bubble-expanded']").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("Supply only").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("Supply + Install").should("be.visible");

    // 6. Verify itemized BOM lines in Supply Only mode
    cy.get("[data-testid='price-bubble-expanded']").contains("Posts").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("100x75 Treated Pine Post H4 2400mm").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("amf · CCAH4PST-100-75-2400").should("be.visible");

    // 7. Toggle to Supply + Install mode
    cy.get("[data-testid='toggle-supply-install']").click();

    // Verify runs and gates breakdown is shown
    cy.get("[data-testid='price-bubble-expanded']").contains("Run 1 — Side run").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("11.1m boundary fence").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("Gate 1 — Pedestrian gate").should("be.visible");
    cy.get("[data-testid='price-bubble-expanded']").contains("Site Labour & Extras").should("be.visible");
    
    // Check Site Travel checkbox exists and is interactive
    cy.get("[data-testid='price-bubble-expanded']").contains("Site travel & mobilization").should("be.visible");

    // 8. Close the bubble
    cy.get("[aria-label='Collapse pricing details']").click();
    cy.get("[data-testid='price-bubble-collapsed']").should("be.visible"); // collapsed again
  });
});
