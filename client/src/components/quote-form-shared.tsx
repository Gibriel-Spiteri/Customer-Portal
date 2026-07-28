import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, X } from "lucide-react";

export const BUDGET_OPTIONS = [
  "Under $5,000",
  "$5,000 - $10,000",
  "$10,000 - $15,000",
  "$15,000 - $20,000",
  "$20,000 - $25,000",
  "$25,000 - $30,000",
  "$30,000 - $40,000",
  "$40,000 - $50,000",
  "$50,000 +",
  "Undecided",
];

export const BRAND_OPTIONS = [
  "Avance",
  "Covered Bridge",
  "Fabuwood",
  "Kraftmaid",
  "Nova South",
  "Pivot by Mid-Continent",
  "Starmark",
  "Ultracraft",
  "Wellborn Forest",
  "No Preference",
];

export const MAX_FILE_MB = 10;
export const MAX_FILES_PER_KIND = 5;
export const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif";

export function FilePicker({
  label,
  icon,
  files,
  setFiles,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  files: File[];
  setFiles: (f: File[]) => void;
  hint: string;
}) {
  const { toast } = useToast();

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES_PER_KIND) {
        toast({ title: `Maximum ${MAX_FILES_PER_KIND} files`, variant: "destructive" });
        break;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast({
          title: `${f.name} is too large`,
          description: `Files must be under ${MAX_FILE_MB} MB.`,
          variant: "destructive",
        });
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-netsuite-blue hover:bg-blue-50/50 transition-colors">
        <span className="text-sm text-gray-600">Tap to choose files</span>
        <span className="text-xs text-gray-400">{hint}</span>
        <input
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 shrink-0 ml-2"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
