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
          class LatLngBounds {
            constructor(sw, ne) { this._sw = sw; this._ne = ne; }
            getSouthWest() { return this._sw; }
            getNorthEast() { return this._ne; }
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
            fitBounds() {}
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
          window.google.maps.LatLngBounds = LatLngBounds;
          window.google.maps.Map = Map;
          window.google.maps.Marker = Marker;
          window.google.maps.event = {
            addListener(instance, eventName, handler) {
              return { remove() {} };
            },
            addListenerOnce(instance, eventName, handler) {
              return { remove() {} };
            },
            removeListener(listener) {}
          };
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

describe("Anyfence booking flow", () => {
  beforeEach(() => {
    browserErrors = [];
    mockGoogleMaps();
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
  });

  afterEach(() => {
    cy.window().then((win) => {
      const routeErr = win.__route_error;
      if (routeErr) {
        browserErrors.push("Route Error: " + (routeErr.stack || routeErr.message || routeErr));
      }
      // We allow minor react key/prop warnings, but block on actual errors
      const criticalErrors = browserErrors.filter(err => !err.includes("React does not recognize the") && !err.includes("styled-safe-css"));
      if (criticalErrors.length > 0) {
        throw new Error("Browser error detected:\n" + criticalErrors.join("\n\n"));
      }
    });
  });

  it("handles the full supply + install booking flow successfully", () => {
    cy.visit("/book/q_4f9a2c", {
      onBeforeLoad(win) {
        win.localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
      },
    });

    // Step 1: Your Details
    cy.contains("Tell us a bit about you").should("be.visible");
    cy.contains("Step 1 of 5", { matchCase: false }).should("be.visible");
    
    // Address is prefilled and read-only
    cy.get('input[value="42 Greenway Drive, Currimundi QLD 4551"]').should("have.attr", "readonly");

    // Click submit empty to trigger validation
    cy.get('[data-testid="details-submit-btn"]').click();
    cy.contains("Full name is required").should("be.visible");
    cy.contains("Email is required").should("be.visible");
    cy.contains("Phone number is required").should("be.visible");

    // Fill contact details
    cy.get('[data-testid="full-name-input"]').type("Liam Test");
    cy.get('[data-testid="phone-input"]').type("412 345 678");
    cy.get('[data-testid="email-input"]').type("liam@example.com");

    cy.get('[data-testid="details-submit-btn"]').click();

    // Step 2: Walkthrough Video
    cy.contains("Walk your fence line on video").should("be.visible");
    cy.get('[data-testid="video-drop-zone"]').should("be.visible");
    
    // Check that caveat is displayed
    cy.contains("won't confirm the install").should("be.visible");

    // Click Record Now to upload mock video
    cy.contains("Record now").click();
    cy.contains("Uploading video...").should("be.visible");
    cy.contains("recorded-walkthrough.mp4", { timeout: 10000 }).should("be.visible");

    // Click continue
    cy.contains("Upload a video to continue").click();

    // Step 3: Pick Install Date
    cy.contains("When should we start?").should("be.visible");
    cy.contains("June 2026").should("be.visible");

    // Click weekend (e.g. day 14 is Sunday) - should not change date to Sunday
    cy.get('[data-testid="day-14"]').click();
    cy.get('[data-testid="tentative-date-readout"]').should("not.contain", "Sunday");

    // Select available day 16
    cy.get('[data-testid="day-16"]').click();
    cy.get('[data-testid="tentative-date-readout"]').should("contain", "Tue 16 June, finishing Thu 18 June");

    cy.contains("Continue to review + deposit").click();

    // Step 4: Review + 10% Deposit
    cy.contains("Review & secure with a 10% deposit").should("exist");
    
    // Check Deposit Banner
    cy.contains("10% deposit today").should("be.visible");
    cy.contains("$461").should("be.visible");
    cy.contains("refundable until 48h before install").should("be.visible");

    // Check review cards
    cy.contains("Liam Test").should("be.visible");
    cy.contains("liam@example.com").should("be.visible");
    cy.contains("412 345 678").should("be.visible");
    cy.contains("recorded-walkthrough.mp4").should("be.visible");
    cy.contains("16 Jun").should("be.visible");

    // Fill Payment Form
    cy.get('[data-testid="card-number-input"]').type("4242 4242 4242 4242");
    cy.get('[data-testid="expiry-input"]').type("12/28");
    cy.get('[data-testid="cvc-input"]').type("123");
    cy.get('[data-testid="name-on-card-input"]').type("Liam Test");

    cy.get('[data-testid="pay-submit-btn"]').click();

    // Step 5: Booked!
    cy.contains("Booked!", { timeout: 6000 }).should("be.visible");
    cy.contains("Q-4F9A2C").should("be.visible");
    cy.contains("locked in for Tuesday 16 June 2026", { matchCase: false }).should("be.visible");
    
    // Check Next Steps (should have 4 cards for install)
    cy.contains("Amazing Fencing reviews your video").should("be.visible");
    cy.contains("Two days before").should("be.visible");
    cy.contains("Day of install").should("be.visible");
    cy.contains("View your booking").should("be.visible");
  });

  it("handles the supply-only booking flow successfully", () => {
    cy.visit("/book/q_4f9a2c?mode=supply-only", {
      onBeforeLoad(win) {
        win.localStorage.setItem("sb-localhost-auth-token", JSON.stringify(session));
      },
    });

    // Step 1: Your Details
    cy.contains("Tell us a bit about you").should("be.visible");
    cy.get('[data-testid="full-name-input"]').type("Liam Supply");
    cy.get('[data-testid="phone-input"]').type("412 987 654");
    cy.get('[data-testid="email-input"]').type("supply@example.com");

    cy.get('[data-testid="details-submit-btn"]').click();

    // Verify Step 2 is skipped and we are on Step 3
    cy.contains("When can you pick up?").should("exist");
    cy.get('[data-testid="step-2-skipped"]').should("exist");

    // Select available day 8 for pickup
    cy.get('[data-testid="day-8"]').click();
    cy.get('[data-testid="tentative-date-readout"]').should("contain", "Mon 8 June · 9:00am pickup");

    cy.contains("Continue to review + deposit").click();

    // Step 4: Review + 10% Deposit
    cy.contains("Review & secure with a 10% deposit").should("exist");
    
    // Check Deposit Banner
    cy.contains("refundable until 24h before pickup").should("be.visible");

    // Review card check (no video card should be visible)
    cy.contains("Liam Supply").should("be.visible");
    cy.contains("supply@example.com").should("be.visible");
    cy.contains("recorded-walkthrough.mp4").should("not.exist");
    cy.contains("8 Jun").should("be.visible");

    // Fill Payment Form
    cy.get('[data-testid="card-number-input"]').type("4242 4242 4242 4242");
    cy.get('[data-testid="expiry-input"]').type("12/28");
    cy.get('[data-testid="cvc-input"]').type("123");
    cy.get('[data-testid="name-on-card-input"]').type("Liam Supply");

    cy.get('[data-testid="pay-submit-btn"]').click();

    // Step 5: Booked!
    cy.contains("Booked!", { timeout: 6000 }).should("be.visible");
    cy.contains("Q-4F9A2C").should("be.visible");
    cy.contains("locked in for Monday 8 June 2026", { matchCase: false }).should("be.visible");
    
    // Check Next Steps (should have 2 cards for supply only, no installer review/ETA)
    cy.contains("Day of pickup").should("be.visible");
    cy.contains("Amazing Fencing reviews your video").should("not.exist");
    cy.contains("Two days before").should("not.exist");
  });
});
