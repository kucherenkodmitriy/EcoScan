declare namespace google {
  namespace maps {
    interface MapMouseEvent {
      latLng?: google.maps.LatLng;
    }

    class Geocoder {
      geocode(
        request: {
          address?: string;
          location?: { lat: number; lng: number };
        },
        callback: (
          results: google.maps.GeocoderResult[] | null,
          status: string
        ) => void
      ): void;
    }

    interface GeocoderResult {
      geometry: {
        location: google.maps.LatLng;
      };
      formatted_address: string;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
  }
} 