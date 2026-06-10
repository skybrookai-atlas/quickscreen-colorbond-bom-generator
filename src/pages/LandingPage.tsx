import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Loader2, ArrowRight } from "lucide-react";
import { AmazingFencingLogo } from "../components/brand/AmazingFencingLogo";
import { GlassOutletLogo } from "../components/brand/GlassOutletLogo";
import { ByronBeyondFencingLogo } from "../components/brand/ByronBeyondFencingLogo";
import { toast } from "sonner";

interface GooglePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}


function googleMapsKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_KEY ?? "";
}

function loadGooglePlaces(key: string) {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__quickScreenGoogleMapsPromise) {
    return window.__quickScreenGoogleMapsPromise;
  }

  window.__quickScreenGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return window.__quickScreenGoogleMapsPromise;
}

export function LandingPage() {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const placesAttributionRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<GooglePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingAutocomplete, setFetchingAutocomplete] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Map
  useEffect(() => {
    const key = googleMapsKey();
    if (!key) return;

    loadGooglePlaces(key)
      .then(() => {
        if (!mapContainerRef.current) return;
        const initializedMap = new window.google!.maps!.Map(mapContainerRef.current, {
          center: { lat: -27.4698, lng: 153.0251 }, // Brisbane default center
          zoom: 12,
          mapTypeId: "satellite",
          disableDefaultUI: true,
          gestureHandling: "none", // pure underlay background
        });
        setMap(initializedMap);
      })
      .catch((err) => {
        console.error("Failed to load Google Maps:", err);
      });
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    const key = googleMapsKey();
    if (!key || query.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setFetchingAutocomplete(true);
    try {
      await loadGooglePlaces(key);
      const service = new window.google!.maps!.places!.AutocompleteService();
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "au" },
          types: ["address"],
        },
        (predictions, status) => {
          const ok = window.google?.maps?.places?.PlacesServiceStatus.OK;
          if (status !== ok || !predictions?.length) {
            setSuggestions([]);
            setShowDropdown(false);
            setActiveIndex(-1);
            return;
          }
          setSuggestions(predictions);
          setShowDropdown(true);
          setActiveIndex(-1);
        },
      );
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setFetchingAutocomplete(false);
    }
  }, []);

  const handleAddressChange = (value: string) => {
    setAddress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 250);
  };

  const selectSuggestion = async (prediction: GooglePrediction) => {
    const key = googleMapsKey();
    if (!key) return;

    setLoading(true);
    try {
      await loadGooglePlaces(key);
      const attribution = placesAttributionRef.current ?? document.createElement("div");
      const service = new window.google!.maps!.places!.PlacesService(attribution);

      service.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["formatted_address", "geometry"],
        },
        (place, status) => {
          const ok = window.google?.maps?.places?.PlacesServiceStatus.OK;
          if (status !== ok || !place?.geometry?.location) {
            toast.error("Address coordinates not found.");
            setLoading(false);
            return;
          }

          const label = place.formatted_address ?? prediction.description;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          setAddress(label);
          setSelectedCoords({ lat, lng });
          setSuggestions([]);
          setShowDropdown(false);
          setActiveIndex(-1);

          // Fly Map to selected location
          if (map) {
            map.panTo({ lat, lng });
            map.setZoom(20);
          }

          toast.success("Location set!", {
            description: label,
          });
          setLoading(false);
        },
      );
    } catch {
      toast.error("Failed to fetch address details.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        void selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSupplier = (supplierSlug: string, calculatorSlug?: string) => {
    const routingState = selectedCoords
      ? {
          address,
          lat: selectedCoords.lat,
          lng: selectedCoords.lng,
        }
      : undefined;

    if (calculatorSlug) {
      navigate(`/s/${supplierSlug}/calculator/${calculatorSlug}`, { state: routingState });
    } else {
      navigate(`/s/${supplierSlug}`, { state: routingState });
    }
  };

  const suppliers = [
    {
      slug: "glass-outlet",
      calcSlug: "qshs",
      name: "Glass Outlet",
      description: "QuickScreen horizontal slat screening & pedestrian gates. Sourced from the premium GO catalogue.",
      logo: <GlassOutletLogo showThe={false} className="scale-75 origin-left" textClassName="text-white" />,
      color: "#5a8a32",
    },
    {
      slug: "amazing-fencing",
      name: "Amazing Fencing",
      description: "Premium Colorbond steel, treated pine paling, slat screening, and timber sleeper retaining walls.",
      logo: <AmazingFencingLogo className="scale-50 origin-left -my-2" />,
      color: "#0d8ecf",
    },
    {
      slug: "byron-and-beyond-fencing",
      name: "Byron & Beyond Fencing",
      description: "Colorbond, timber paling, slat, pool fencing, and custom automatic driveway gates in Northern Rivers.",
      logo: <ByronBeyondFencingLogo className="scale-75 origin-left" textClassName="text-white" />,
      color: "#1b4332",
    },
    {
      slug: "discount-fencing",
      name: "Discount Fencing",
      description: "CCA Pine paling, aluminium pool, frameless glass pool fencing, Colorbond, and aluminium slat gates.",
      logo: (
        <div className="flex flex-col text-left font-sans">
          <span className="text-xs font-black uppercase tracking-wider text-[#cbd2ce]">Discount</span>
          <span className="text-base font-black tracking-wide text-white uppercase -mt-1">Fencing</span>
        </div>
      ),
      color: "#1f3b5c",
    },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-white">
      {/* 1. Full screen Map Container Background */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full opacity-60" />

      {/* Subtle overlay gradient on top of map to ensure text legibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/70 pointer-events-none" />

      <div ref={placesAttributionRef} className="hidden" />

      {/* 2. Centered Interactive Card */}
      <div className="relative z-20 flex h-full w-full items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <span className="text-xs font-black uppercase tracking-[0.35em] text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Anyfence Platform
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-[0.2em] text-white uppercase leading-none">
              ANY<span className="text-emerald-400 font-black">FENCE</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
              Draw layouts on satellite maps, calculate exact bills of materials, and connect with Australian suppliers.
            </p>
          </div>

          {/* Address Autocomplete Input */}
          <div className="relative mb-8">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              1. Type your project address
            </label>
            <div className="relative flex items-center">
              {loading ? (
                <Loader2 className="absolute left-4 animate-spin text-emerald-400 h-5 w-5 pointer-events-none" />
              ) : (
                <Search className="absolute left-4 text-slate-400 h-5 w-5 pointer-events-none" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder="Enter address to locate property..."
                className="w-full pl-12 pr-12 py-3.5 bg-slate-900/90 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 text-sm shadow-inner transition-all"
                autoComplete="off"
              />
              {fetchingAutocomplete && (
                <Loader2
                  size={18}
                  className="absolute right-4 animate-spin text-emerald-400 pointer-events-none"
                />
              )}
              {selectedCoords && !fetchingAutocomplete && (
                <MapPin className="absolute right-4 text-emerald-400 h-5 w-5" />
              )}
            </div>

            {/* Predictions List */}
            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto backdrop-blur-lg animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {suggestions.map((prediction, idx) => {
                  const line1 = prediction.structured_formatting?.main_text ?? prediction.description;
                  const line2 = prediction.structured_formatting?.secondary_text ?? "";
                  return (
                    <button
                      key={prediction.place_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void selectSuggestion(prediction);
                      }}
                      className={`w-full text-left px-5 py-3 transition-colors border-b border-white/5 last:border-0 ${
                        idx === activeIndex
                          ? "bg-slate-800"
                          : "hover:bg-slate-800/60"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold truncate ${
                          idx === activeIndex
                            ? "text-emerald-400"
                            : "text-white"
                        }`}
                      >
                        {line1}
                      </div>
                      {line2 && (
                        <div className="text-[11px] truncate text-slate-500 mt-0.5">
                          {line2}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supplier Grid */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              {selectedCoords ? "2. Choose your fencing supplier" : "2. Choose a supplier (or type address first to pre-load map)"}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suppliers.map((supplier) => (
                <button
                  key={supplier.slug}
                  onClick={() => handleSelectSupplier(supplier.slug, supplier.calcSlug)}
                  className="group relative flex flex-col text-left p-5 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-emerald-500/40 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className="h-10 flex items-center">{supplier.logo}</div>
                    <span 
                      className="h-2 w-2 rounded-full shadow-lg shrink-0" 
                      style={{ backgroundColor: supplier.color }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed min-h-[2.5rem] line-clamp-2">
                    {supplier.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-emerald-400 pt-3 border-t border-white/5 w-full">
                    <span>Configure Fence</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
