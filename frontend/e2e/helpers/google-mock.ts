import { type Page } from '@playwright/test';

export async function mockGoogleApis(page: Page): Promise<void> {
  // Block Google Analytics / Tag Manager
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await page.route('**/google-analytics.com/**', (route) => route.abort());

  // Mock Google Maps JS API
  await page.route('**/maps.googleapis.com/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.google = window.google || {};
        window.google.maps = {
          Map: class {
            constructor() {}
            setCenter() {}
            setZoom() {}
            addListener() {}
            fitBounds() {}
          },
          LatLng: class {
            constructor(lat, lng) { this.lat = () => lat; this.lng = () => lng; }
          },
          LatLngBounds: class {
            constructor() {}
            extend() { return this; }
            isEmpty() { return true; }
          },
          Marker: class {
            constructor() {}
            setMap() {}
            addListener() {}
            setPosition() {}
          },
          InfoWindow: class {
            constructor() {}
            open() {}
            close() {}
            setContent() {}
          },
          DirectionsService: class {
            route(request, callback) { callback(null, 'ZERO_RESULTS'); }
          },
          DirectionsRenderer: class {
            constructor() {}
            setMap() {}
            setDirections() {}
          },
          Size: class {
            constructor(w, h) { this.width = w; this.height = h; }
          },
          Point: class {
            constructor(x, y) { this.x = x; this.y = y; }
          },
          event: {
            addListener() {},
            removeListener() {},
            clearListeners() {},
          },
          places: {
            Autocomplete: class {
              constructor() {}
              addListener() {}
              getPlace() { return { geometry: { location: { lat: () => 50.08, lng: () => 14.42 } } }; }
              setBounds() {}
            },
            AutocompleteService: class {
              getPlacePredictions(req, cb) { cb([], 'OK'); }
            },
          },
          marker: {
            AdvancedMarkerElement: class {
              constructor() { this.position = null; this.map = null; this.content = null; }
              addListener() {}
            },
            PinElement: class {
              constructor() { this.element = document.createElement('div'); }
            },
          },
          DirectionsStatus: { OK: 'OK' },
          TravelMode: { DRIVING: 'DRIVING' },
          MapTypeId: { ROADMAP: 'roadmap' },
          ControlPosition: { TOP_RIGHT: 0 },
        };
      `,
    });
  });

  // Mock reCAPTCHA
  await page.route('**/www.google.com/recaptcha/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.grecaptcha = {
          ready: function(cb) { cb(); },
          execute: function() { return Promise.resolve('test-recaptcha-token'); },
          render: function() { return 0; },
        };
      `,
    });
  });

  // Mock reCAPTCHA enterprise
  await page.route('**/www.gstatic.com/recaptcha/**', (route) => route.abort());
}
