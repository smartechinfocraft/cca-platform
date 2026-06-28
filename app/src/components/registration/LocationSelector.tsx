interface LocationSelectorProps {
  selectedLocation: string;
  onSelectLocation: (location: string) => void;
}

const locations: string[] = ["Dublin", "Fremont", "San Jose", "Sunnyvale", "Cupertino"];

function LocationSelector({ selectedLocation, onSelectLocation }: LocationSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {locations.map((location) => {
        const isActive = selectedLocation === location;
        return (
          <button
            key={location}
            type="button"
            onClick={() => onSelectLocation(location)}
            className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
              isActive
                ? "border-[#A33B2B] bg-[#A33B2B]/10 text-[#0F172A] shadow-md"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            <span className="text-lg font-semibold">{location}</span>
            <p className="mt-2 text-sm text-gray-500">CCA training location</p>
          </button>
        );
      })}
    </div>
  );
}

export default LocationSelector;
