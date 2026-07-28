import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  Store,
  User,
  Ruler,
  Camera,
  Loader2,
  CheckCircle,
  X,
  FileText,
} from "lucide-react";

interface SalesRep {
  id: string;
  name: string;
  email: string | null;
}

interface StoreWithReps {
  store: string;
  salespeople: SalesRep[];
}

const quickQuoteSchema = z.object({
  storeName: z.string().min(1, "Please select a store"),
  salesRepId: z.string().min(1, "Please select a salesperson"),
  projectType: z.enum(["Kitchen", "Bath", "Other"], {
    errorMap: () => ({ message: "Please select a project type" }),
  }),
  budget: z.string().max(100).optional(),
  timeFrame: z.enum(["0-3 months", "4-6 months", "7+ months"]).optional(),
  brandPreference: z.string().max(255).optional(),
  comments: z.string().max(5000).optional(),
});

type QuickQuoteForm = z.infer<typeof quickQuoteSchema>;

const MAX_FILE_MB = 10;
const MAX_FILES_PER_KIND = 5;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.gif";

function FilePicker({
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
          accept={ACCEPT}
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

export default function QuickQuote() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [measurementFiles, setMeasurementFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { data, isLoading: loadingReps } = useQuery<{ stores: StoreWithReps[] }>({
    queryKey: ["/api/quick-quote/salespeople"],
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
  });

  const form = useForm<QuickQuoteForm>({
    resolver: zodResolver(quickQuoteSchema),
    defaultValues: {
      storeName: "",
      salesRepId: "",
      budget: "",
      brandPreference: "",
      comments: "",
    },
  });

  const selectedStore = form.watch("storeName");
  const reps =
    data?.stores.find((s) => s.store === selectedStore)?.salespeople || [];

  const submitMutation = useMutation({
    mutationFn: async (values: QuickQuoteForm) => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      measurementFiles.forEach((f) => fd.append("measurements", f));
      photoFiles.forEach((f) => fd.append("photos", f));

      const response = await fetch("/api/quick-quote", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Failed to send request");
      return body;
    },
    onSuccess: (body) => {
      setSubmitted(body.message);
      form.reset();
      setMeasurementFiles([]);
      setPhotoFiles([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return <div>Please log in to use Quick Quote</div>;
  }

  return (
    <MobileLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-netsuite-blue" />
          Quick Quote
        </h1>
        <p className="mt-1 text-gray-600">
          Send your project details and measurements straight to a salesperson
          at your preferred store.
        </p>
      </div>

      {submitted ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Request sent!
            </h2>
            <p className="text-gray-600 mb-6">{submitted}</p>
            <Button onClick={() => setSubmitted(null)} variant="outline">
              Send another request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your project</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))}
              className="space-y-6"
            >
              {/* Store */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-gray-500" />
                  Store
                </Label>
                {loadingReps ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Controller
                    control={form.control}
                    name="storeName"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("salesRepId", "");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose your store" />
                        </SelectTrigger>
                        <SelectContent>
                          {data?.stores.map((s) => (
                            <SelectItem key={s.store} value={s.store}>
                              {s.store}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                {form.formState.errors.storeName && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.storeName.message}
                  </p>
                )}
              </div>

              {/* Salesperson */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  Salesperson
                </Label>
                <Controller
                  control={form.control}
                  name="salesRepId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedStore}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedStore
                              ? reps.length > 0
                                ? "Choose a salesperson"
                                : "No salespeople at this store yet"
                              : "Select a store first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {reps.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.salesRepId && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.salesRepId.message}
                  </p>
                )}
              </div>

              {/* Project type */}
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Controller
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <div className="grid grid-cols-3 gap-2">
                      {(["Kitchen", "Bath", "Other"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            field.value === t
                              ? "border-netsuite-blue bg-blue-50 text-netsuite-blue"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                />
                {form.formState.errors.projectType && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.projectType.message}
                  </p>
                )}
              </div>

              {/* Budget + Time frame */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    placeholder="e.g. $15,000 - $25,000"
                    {...form.register("budget")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Frame</Label>
                  <Controller
                    control={form.control}
                    name="timeFrame"
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="When do you want to start?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-3 months">0-3 months</SelectItem>
                          <SelectItem value="4-6 months">4-6 months</SelectItem>
                          <SelectItem value="7+ months">7+ months</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* Brand preference */}
              <div className="space-y-2">
                <Label htmlFor="brandPreference">Brand Preference</Label>
                <Input
                  id="brandPreference"
                  placeholder="e.g. Fabuwood, Wolf, no preference"
                  {...form.register("brandPreference")}
                />
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  rows={4}
                  placeholder="Tell us anything else about your project..."
                  {...form.register("comments")}
                />
              </div>

              {/* Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FilePicker
                  label="Room Measurements"
                  icon={<Ruler className="h-4 w-4 text-gray-500" />}
                  files={measurementFiles}
                  setFiles={setMeasurementFiles}
                  hint={`PDF or photos, up to ${MAX_FILES_PER_KIND} files (${MAX_FILE_MB} MB each)`}
                />
                <FilePicker
                  label="Photos"
                  icon={<Camera className="h-4 w-4 text-gray-500" />}
                  files={photoFiles}
                  setFiles={setPhotoFiles}
                  hint={`Up to ${MAX_FILES_PER_KIND} photos (${MAX_FILE_MB} MB each)`}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="bg-netsuite-blue hover:bg-netsuite-light"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send to Salesperson"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </MobileLayout>
  );
}
